/* La planilla de importación, con precios por forma de cobro.
   Requiere jsdom:  npm install --no-save jsdom
   Uso:            node herramientas/prueba-importacion.mjs */
import { JSDOM, VirtualConsole } from 'jsdom';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const errores = [];
const dom = new JSDOM(await readFile(RAIZ+'/index.html','utf8'), { url:'https://local.test/',
  virtualConsole:new VirtualConsole().on('jsdomError', e=>errores.push(e.message)) });
Object.assign(globalThis,{window:dom.window,document:dom.window.document,
  localStorage:dom.window.localStorage,sessionStorage:dom.window.sessionStorage,
  CustomEvent:dom.window.CustomEvent,Event:dom.window.Event,Blob:dom.window.Blob});
globalThis.fetch = async u => {
  const k = String(u).replace(/^https?:\/\/[^/]+\//,'').replace(/^\.?\//,'');
  if (k === 'datos/firebase.json' || k.startsWith('api/base')) return new Response('',{status:404});
  try{ return new Response(await readFile(RAIZ+'/'+k,'utf8'),{status:200}); }
  catch{ return new Response('',{status:404}); }
};

const alm = await import(RAIZ+'/js/almacen.js');
const neg = await import(RAIZ+'/js/negocio.js');
const est = await import(RAIZ+'/js/estado.js');
await import(RAIZ+'/js/app.js');
await new Promise(r=>setTimeout(r,500));
const d = document;
const paso=(n,f)=>{try{f();console.log('  ok  '+n)}catch(e){console.log('  MAL '+n+' → '+e.message);errores.push(n)}};

d.getElementById('ing-usuario').value='mica';
d.getElementById('ing-clave').value='1190';
d.getElementById('ing-entrar').click();
await new Promise(r=>setTimeout(r,700));
const primera=d.querySelector('[data-elegido]'); if(primera) primera.click();
await new Promise(r=>setTimeout(r,700));

const irAImportar = () => {
  d.querySelector('#nav button[data-vista="productos"]').click();
  d.querySelector('#acciones [data-ir="importar"]').click();
};
const pegar = texto => {
  irAImportar();
  d.getElementById('pegado').value = texto;
  d.getElementById('revisar').click();
  return est.ui.previo;
};

console.log('== las columnas de precio NO son talles ==');
paso('efectivo y credito se leen como precios', ()=>{
  const p = pegar('nombre\tcosto\tmargen\tS\tM\tefectivo\tcredito\n' +
                  'Remera\t8200\t120\t6\t9\t18040\t20746');
  if(p.talles.join(',') !== 'S,M') throw new Error('talles: '+p.talles.join(','));
  const f = p.filas[0];
  if(f.talles.efectivo !== undefined) throw new Error('creó un talle "efectivo" con stock');
  if(f.precios.credito !== 2074600) throw new Error('precio crédito: '+f.precios.credito);
});
paso('también con el prefijo "precio"', ()=>{
  const p = pegar('nombre\tcosto\tprecio credito\tprecio debito\tM\n' +
                  'Buzo\t19500\t45000\t42000\t4');
  if(p.talles.join(',') !== 'M') throw new Error('talles: '+p.talles.join(','));
  const f = p.filas[0];
  if(f.precios.credito !== 4500000) throw new Error('credito: '+f.precios.credito);
  if(f.precios.debito !== 4200000) throw new Error('debito: '+f.precios.debito);
});
paso('acepta acentos, guiones bajos y mayúsculas', ()=>{
  const p = pegar('Nombre\tCosto\tPrecio_Crédito\tPrecio Mercado Pago\tTarjeta\tL\n' +
                  'Campera\t31000\t70000\t65000\t72000\t2');
  if(p.talles.join(',') !== 'L') throw new Error('talles: '+p.talles.join(','));
  const f = p.filas[0];
  if(!f.precios.credito) throw new Error('no leyó Precio_Crédito');
  if(!f.precios.mercadopago) throw new Error('no leyó Precio Mercado Pago');
});
paso('un talle que se llama como un número sigue siendo talle', ()=>{
  const p = pegar('nombre\tcosto\t38\t40\t42\n Jean\t24500\t4\t6\t5');
  if(p.talles.join(',') !== '38,40,42') throw new Error('talles: '+p.talles.join(','));
});

console.log('== precio y costo ==');
paso('con costo y margen, el precio se calcula', ()=>{
  const f = pegar('nombre\tcosto\tmargen\tM\nRemera\t10000\t100\t5').filas[0];
  if(f.precioC !== 2000000) throw new Error('precio: '+f.precioC);
});
paso('con costo y precio, el margen se deduce', ()=>{
  const f = pegar('nombre\tcosto\tprecio\tM\nRemera\t10000\t25000\t5').filas[0];
  if(f.precioC !== 2500000) throw new Error('precio: '+f.precioC);
  if(f.margen !== 150) throw new Error('margen: '+f.margen);
});
paso('solo con precio también entra, sin ganancia', ()=>{
  const f = pegar('nombre\tprecio\tM\nRemera\t25000\t5').filas[0];
  if(f.precioC !== 2500000) throw new Error('precio: '+f.precioC);
  if(f.costoC !== 0) throw new Error('inventó un costo');
  if(f.problema) throw new Error('la rechazó: '+f.problema);
});
paso('sin costo ni precio, la fila se marca', ()=>{
  const p = pegar('nombre\tcosto\tM\nRemera\tabc\t5');
  if(!p.filas[0].problema) throw new Error('la dejó pasar');
});
paso('sin nombre ni costo ni precio, avisa', ()=>{
  const p = pegar('a\tb\nc\td');
  if(!p.error) throw new Error('no avisó');
});

console.log('== mínimos de stock ==');
paso('lee minimo y reponer', ()=>{
  const f = pegar('nombre\tcosto\tminimo\treponer\tM\nRemera\t8200\t4\t12\t5').filas[0];
  if(f.umbral !== 4) throw new Error('umbral: '+f.umbral);
  if(f.reponerHasta !== 12) throw new Error('reponer: '+f.reponerHasta);
});

console.log('== importar de verdad ==');
paso('el producto queda con todo cargado', ()=>{
  pegar('nombre\tcategoria\tcosto\tmargen\tminimo\tprecio credito\tS\tM\n' +
        'Remera prueba\tRemeras\t10000\t100\t4\t25000\t6\t9');
  d.getElementById('confirmar-import').click();
  const p = alm.datos.productos.find(x => x.nombre === 'Remera prueba');
  if(!p) throw new Error('no lo importó');
  if(p.precioC !== 2000000) throw new Error('precio base: '+p.precioC);
  if(neg.precioPara(p,'credito') !== 2500000) throw new Error('precio crédito: '+neg.precioPara(p,'credito'));
  if(neg.precioPara(p,'efectivo') !== 2000000) throw new Error('precio efectivo: '+neg.precioPara(p,'efectivo'));
  if(neg.umbralDe(p) !== 4) throw new Error('mínimo: '+neg.umbralDe(p));
  if(p.talles.S !== 6 || p.talles.M !== 9) throw new Error('stock: '+JSON.stringify(p.talles));
});
paso('reimportar suma stock y no duplica el producto', ()=>{
  const antes = alm.datos.productos.filter(x=>x.nombre==='Remera prueba').length;
  pegar('nombre\tcosto\tmargen\tS\nRemera prueba\t10000\t100\t4');
  d.getElementById('confirmar-import').click();
  const iguales = alm.datos.productos.filter(x=>x.nombre==='Remera prueba');
  if(iguales.length !== antes) throw new Error('duplicó el producto');
  if(iguales[0].talles.S !== 10) throw new Error('stock S: '+iguales[0].talles.S);
});
paso('el ejemplo que trae el botón importa sin errores', ()=>{
  irAImportar();
  d.getElementById('usar-ejemplo').click();
  const p = est.ui.previo;
  if(p.error) throw new Error(p.error);
  if(p.filas.some(f=>f.problema)) throw new Error('alguna fila quedó marcada');
  if(!p.talles.includes('S')) throw new Error('no detectó los talles: '+p.talles);
  if(!p.precios.length) throw new Error('no detectó la columna de precio');
});

console.log('\n'+(errores.length?'FALLOS: '+errores.join(', '):'sin errores'));
process.exit(errores.length?1:0);
