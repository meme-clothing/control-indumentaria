/* Colores por talle: stock, venta, pedidos, importación e informe.
   Requiere jsdom:  npm install --no-save jsdom
   Uso:            node herramientas/prueba-colores.mjs */
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
const esperar=(ms=250)=>new Promise(r=>setTimeout(r,ms));

d.getElementById('ing-usuario').value='mica';
d.getElementById('ing-clave').value='1190';
d.getElementById('ing-entrar').click();
await esperar(700);
const pr=d.querySelector('[data-elegido]'); if(pr) pr.click();
await esperar(700);

const ver = v => d.querySelector(`#nav button[data-vista="${v}"]`).click();
const irAImportar = () => { ver('productos'); d.querySelector('#acciones [data-ir="importar"]').click(); };
const pegar = texto => { irAImportar(); d.getElementById('pegado').value = texto;
  d.getElementById('revisar').click(); return est.ui.previo; };

alm.datos.productos.length = 0;
const SIN = { id:'s1', nombre:'Buzo liso', categoria:'Buzos', costoC:100000, margen:100,
  precioC:200000, talles:{ S:3, M:7, L:2 }, activo:true, umbral:2 };
const CON = { id:'c1', nombre:'Remera oversize', categoria:'Remeras', costoC:82000, margen:120,
  precioC:180400, activo:true, umbral:2,
  colores:{ Negro:{ S:4, M:6, L:5, XL:2 }, Blanco:{ S:2, M:3, L:0, XL:1 }, Verde:{ S:0, M:2, L:4, XL:3 } } };
alm.datos.productos.push(SIN, CON);

console.log('== las dos formas conviven ==');
paso('un producto sin colores sigue andando', ()=>{
  if(neg.tieneColores(SIN)) throw new Error('lo cree con colores');
  if(neg.stockDe(SIN) !== 12) throw new Error('stock: '+neg.stockDe(SIN));
  const v = neg.variantes(SIN);
  if(v.length !== 3) throw new Error('variantes: '+v.length);
  if(v[0].color !== null) throw new Error('inventó un color');
});
paso('uno con colores suma todas las combinaciones', ()=>{
  if(!neg.tieneColores(CON)) throw new Error('no los reconoce');
  if(neg.stockDe(CON) !== 32) throw new Error('stock: '+neg.stockDe(CON));
  if(neg.coloresDe(CON).join(',') !== 'Negro,Blanco,Verde') throw new Error(neg.coloresDe(CON));
  if(neg.tallesDe(CON).join(',') !== 'S,M,L,XL') throw new Error(neg.tallesDe(CON));
});
paso('cantidadDe lee la casilla correcta', ()=>{
  if(neg.cantidadDe(CON,'Negro','M') !== 6) throw new Error('Negro M');
  if(neg.cantidadDe(CON,'Blanco','L') !== 0) throw new Error('Blanco L');
  if(neg.cantidadDe(SIN,null,'M') !== 7) throw new Error('sin color M');
});
paso('conStock deja afuera lo agotado', ()=>{
  const v = neg.conStock(CON);
  if(v.length !== 10) throw new Error('con stock: '+v.length);
  if(v.some(x => x.cant === 0)) throw new Error('coló una casilla en cero');
});

console.log('== un talle con barra no rompe nada ==');
paso('medias 3/4 en dos colores', ()=>{
  const medias = { id:'m1', nombre:'Media 3/4', categoria:'Medias', costoC:32000, margen:120,
    precioC:70400, activo:true, colores:{ Negro:{ '3/4':6 }, Blanco:{ '3/4':4 } } };
  alm.datos.productos.push(medias);
  if(neg.tallesDe(medias).join(',') !== '3/4') throw new Error(neg.tallesDe(medias));
  if(neg.cantidadDe(medias,'Negro','3/4') !== 6) throw new Error('no lo encuentra');
  neg.ajustarStock(medias,'Negro','3/4',-2);
  if(neg.cantidadDe(medias,'Negro','3/4') !== 4) throw new Error('no lo descontó');
  if(neg.cantidadDe(medias,'Blanco','3/4') !== 4) throw new Error('tocó el otro color');
});

console.log('== mover stock ==');
paso('ajustar no deja negativos', ()=>{
  neg.ajustarStock(CON,'Blanco','XL',-99);
  if(neg.cantidadDe(CON,'Blanco','XL') !== 0) throw new Error('quedó en '+neg.cantidadDe(CON,'Blanco','XL'));
  neg.ajustarStock(CON,'Blanco','XL',1);
});
paso('ajustar un color no toca a los otros', ()=>{
  const antes = neg.cantidadDe(CON,'Verde','L');
  neg.ajustarStock(CON,'Negro','L',-3);
  if(neg.cantidadDe(CON,'Verde','L') !== antes) throw new Error('se movió el verde');
  neg.ajustarStock(CON,'Negro','L',3);
});

console.log('== vender ==');
paso('la tarjeta del que no tiene colores muestra talles', ()=>{
  ver('vender');
  const tarjeta = [...d.querySelectorAll('.item')].find(x => x.textContent.includes('Buzo liso'));
  if(!tarjeta.querySelector('[data-sumar]')) throw new Error('no se puede vender de un toque');
  if(tarjeta.querySelector('[data-grilla]')) throw new Error('le pide elegir color');
});
paso('la del que tiene colores muestra las muestras', ()=>{
  const tarjeta = [...d.querySelectorAll('.item')].find(x => x.textContent.includes('Remera oversize'));
  const botones = tarjeta.querySelectorAll('[data-grilla]');
  if(botones.length !== 3) throw new Error('muestras: '+botones.length);
  if(tarjeta.querySelector('[data-sumar]')) throw new Error('deja vender sin elegir color');
});
paso('la grilla tiene una fila por color y una columna por talle', ()=>{
  d.querySelector('[data-grilla="c1"]').click();
  const filas = d.querySelectorAll('.grilla tbody tr').length;
  const cols = d.querySelectorAll('.grilla thead th').length - 1;
  if(filas !== 3 || cols !== 4) throw new Error(filas+'x'+cols);
});
paso('las casillas en cero no se pueden tocar', ()=>{
  const ceros = [...d.querySelectorAll('.casilla')].filter(b => b.textContent.trim()==='0');
  if(!ceros.length) throw new Error('no hay ninguna en cero');
  if(ceros.some(b => !b.disabled)) throw new Error('una en cero quedó habilitada');
});
paso('al tocar una casilla entra al carrito con su color', ()=>{
  est.ui.carrito.length = 0;
  d.querySelector('.casilla[data-color="Negro"][data-talle="M"]').click();
  const i = est.ui.carrito[0];
  if(!i) throw new Error('no entró');
  if(i.color !== 'Negro') throw new Error('color: '+i.color);
  if(i.talle !== 'M') throw new Error('talle: '+i.talle);
});
paso('el mismo talle en otro color es otra línea', ()=>{
  d.querySelector('[data-grilla="c1"]').click();
  d.querySelector('.casilla[data-color="Verde"][data-talle="M"]').click();
  if(est.ui.carrito.length !== 2) throw new Error('líneas: '+est.ui.carrito.length);
});
paso('no deja vender más de lo que hay de ese color', ()=>{
  est.ui.carrito.length = 0;
  d.querySelector('[data-grilla="c1"]').click();
  for (let i=0;i<4;i++) d.querySelector('.casilla[data-color="Verde"][data-talle="M"]')?.click();
  const linea = est.ui.carrito.find(x => x.color === 'Verde' && x.talle === 'M');
  if(linea.cant > neg.cantidadDe(CON,'Verde','M'))
    throw new Error('dejó cargar '+linea.cant+' con '+neg.cantidadDe(CON,'Verde','M')+' en stock');
});
paso('confirmar descuenta del color correcto', ()=>{
  est.ui.carrito.length = 0;
  est.ui.medioPago = 'efectivo';
  d.querySelector('[data-grilla="c1"]').click();
  d.querySelector('.casilla[data-color="Negro"][data-talle="S"]').click();
  const antesNegro = neg.cantidadDe(CON,'Negro','S');
  const antesBlanco = neg.cantidadDe(CON,'Blanco','S');
  d.getElementById('cobrar').click();
  if(neg.cantidadDe(CON,'Negro','S') !== antesNegro-1) throw new Error('no descontó del negro');
  if(neg.cantidadDe(CON,'Blanco','S') !== antesBlanco) throw new Error('descontó del blanco');
});
paso('la venta guarda el color', ()=>{
  const v = alm.datos.ventas[alm.datos.ventas.length-1];
  if(v.items[0].color !== 'Negro') throw new Error('color guardado: '+v.items[0].color);
});

console.log('== deshacer repone donde corresponde ==');
paso('la devolución vuelve al mismo color', ()=>{
  const antes = neg.cantidadDe(CON,'Negro','S');
  ver('caja');
  const btn = d.querySelector('[data-deshacer]');
  if(btn){ btn.click(); const si = d.getElementById('conf-si'); if(si) si.click(); }
  if(neg.cantidadDe(CON,'Negro','S') !== antes+1)
    throw new Error('quedó en '+neg.cantidadDe(CON,'Negro','S')+', esperaba '+(antes+1));
});

console.log('== reponer y pedir ==');
paso('el aviso de stock bajo dice el color', ()=>{
  const bajos = neg.tallesBajos(CON);
  if(!bajos.length) throw new Error('no detecta ninguno');
  if(bajos.some(v => v.color === undefined)) throw new Error('alguna variante no trae color');
  const blancoL = bajos.find(v => v.color === 'Blanco' && v.talle === 'L');
  if(!blancoL) throw new Error('no marcó Blanco L, que está en cero');
});
paso('la sugerencia de pedido separa por color', ()=>{
  const s = neg.sugerenciasDePedido().filter(l => l.productoId === 'c1');
  if(!s.length) throw new Error('no sugiere nada');
  if(s.some(l => !('color' in l))) throw new Error('una línea no trae color');
  const colores = new Set(s.map(l => l.color));
  if(colores.size < 2) throw new Error('junta todos los colores en uno');
});
paso('recibir mercadería suma al color pedido', ()=>{
  const antes = neg.cantidadDe(CON,'Verde','S');
  alm.datos.pedidos.push({ id:'ped1', fecha:'2026-10-23', estado:'pendiente', usuario:'mica',
    items:[{ productoId:'c1', nombre:'Remera oversize', talle:'S', color:'Verde', cant:5, costoC:82000 }] });
  neg.recibirPedidos(['ped1'], { actualizarCostos:false, usuario:'mica' });
  if(neg.cantidadDe(CON,'Verde','S') !== antes+5)
    throw new Error('quedó en '+neg.cantidadDe(CON,'Verde','S'));
  if(neg.cantidadDe(CON,'Negro','S') === antes+5) throw new Error('lo sumó al color equivocado');
});

console.log('== importar ==');
paso('la columna color no se toma como talle', ()=>{
  const p = pegar('nombre\tcolor\tcosto\tmargen\tS\tM\nCampera\tNegro\t30000\t100\t3\t4');
  if(p.talles.join(',') !== 'S,M') throw new Error('talles: '+p.talles.join(','));
  if(p.filas[0].color !== 'Negro') throw new Error('color: '+p.filas[0].color);
});
paso('varias filas del mismo artículo se juntan en uno', ()=>{
  pegar('nombre\tcategoria\tcolor\tcosto\tmargen\tS\tM\n' +
        'Camisa lino\tCamisas\tNegro\t40000\t100\t3\t4\n' +
        'Camisa lino\tCamisas\tBeige\t40000\t100\t2\t5');
  d.getElementById('confirmar-import').click();
  const iguales = alm.datos.productos.filter(x => x.nombre === 'Camisa lino');
  if(iguales.length !== 1) throw new Error('creó '+iguales.length+' productos');
  const c = iguales[0];
  if(neg.coloresDe(c).join(',') !== 'Negro,Beige') throw new Error(neg.coloresDe(c));
  if(neg.cantidadDe(c,'Beige','M') !== 5) throw new Error('Beige M: '+neg.cantidadDe(c,'Beige','M'));
  if(neg.stockDe(c) !== 14) throw new Error('stock: '+neg.stockDe(c));
});
paso('el nombre del color se normaliza contra la lista', ()=>{
  pegar('nombre\tcolor\tcosto\tmargen\tM\nPantalón\tNEGRO\t50000\t100\t4');
  d.getElementById('confirmar-import').click();
  const p = alm.datos.productos.find(x => x.nombre === 'Pantalón');
  if(neg.coloresDe(p)[0] !== 'Negro') throw new Error('guardó: '+neg.coloresDe(p)[0]);
});
paso('sin columna color, el artículo queda sin colores', ()=>{
  pegar('nombre\tcosto\tmargen\tM\tL\nGorra\t12000\t100\t6\t4');
  d.getElementById('confirmar-import').click();
  const p = alm.datos.productos.find(x => x.nombre === 'Gorra');
  if(neg.tieneColores(p)) throw new Error('le puso colores');
  if(neg.stockDe(p) !== 10) throw new Error('stock: '+neg.stockDe(p));
});
paso('el ejemplo del botón importa bien', ()=>{
  irAImportar();
  d.getElementById('usar-ejemplo').click();
  const p = est.ui.previo;
  if(p.error) throw new Error(p.error);
  if(!p.traeColor) throw new Error('no detectó la columna color');
  if(p.filas.some(f => f.problema)) throw new Error('alguna fila quedó marcada');
});

console.log('== informe de colores ==');
paso('ordena por unidades vendidas', ()=>{
  const ventas = [
    { items:[{ productoId:'c1', color:'Negro', cant:5, precioC:180400 }] },
    { items:[{ productoId:'c1', color:'Verde', cant:2, precioC:180400 }] },
    { items:[{ productoId:'c1', color:'Negro', cant:3, precioC:180400 }] },
    { items:[{ productoId:'s1', color:null,    cant:9, precioC:200000 }] }
  ];
  const r = neg.porColor(ventas);
  if(r[0].color !== 'Negro' || r[0].unidades !== 8) throw new Error(JSON.stringify(r[0]));
  if(r.length !== 2) throw new Error('colores: '+r.length);
});
paso('deja afuera lo que no tiene color', ()=>{
  const r = neg.porColor([{ items:[{ productoId:'s1', color:null, cant:9, precioC:1 }] }]);
  if(r.length) throw new Error('contó un artículo sin color');
});
paso('filtra por categoría', ()=>{
  const ventas = [
    { items:[{ productoId:'c1', color:'Negro', cant:5, precioC:1 }] },
    { items:[{ productoId:'m1', color:'Blanco', cant:7, precioC:1 }] }
  ];
  const soloRemeras = neg.porColor(ventas, 'Remeras');
  if(soloRemeras.length !== 1) throw new Error('trajo '+soloRemeras.length);
  if(soloRemeras[0].color !== 'Negro') throw new Error(soloRemeras[0].color);
});

console.log('== la lista de colores ==');
paso('viene cargada de arranque', ()=>{
  if(!Array.isArray(alm.datos.colores) || alm.datos.colores.length < 4)
    throw new Error('colores: '+(alm.datos.colores||[]).length);
});
paso('no se puede quitar un color en uso', ()=>{
  ver('ajustes');
  const ix = alm.datos.colores.findIndex(c => c.nombre === 'Negro');
  const antes = alm.datos.colores.length;
  d.querySelector(`[data-quitar-color="${ix}"]`).click();
  if(alm.datos.colores.length !== antes) throw new Error('lo quitó igual');
});
paso('renombrar un color lo renombra en los productos', ()=>{
  ver('ajustes');
  const ix = alm.datos.colores.findIndex(c => c.nombre === 'Verde');
  const campo = d.querySelector(`[data-nombre-color="${ix}"]`);
  campo.value = 'Verde militar';
  campo.dispatchEvent(new Event('change'));
  if(!neg.coloresDe(CON).includes('Verde militar'))
    throw new Error('el producto quedó con: '+neg.coloresDe(CON).join(','));
  if(neg.coloresDe(CON).includes('Verde')) throw new Error('quedó el nombre viejo');
});
paso('no entran dos colores con el mismo nombre', ()=>{
  ver('ajustes');
  const antes = alm.datos.colores.length;
  d.getElementById('color-nuevo').value = 'negro';
  d.getElementById('color-mas').click();
  if(alm.datos.colores.length !== antes) throw new Error('aceptó un duplicado');
});
paso('buscar por color encuentra el producto', ()=>{
  const r = neg.buscar('blanco');
  if(!r.find(p => p.id === 'c1')) throw new Error('no lo encuentra');
});

console.log('\n'+(errores.length?'FALLOS: '+errores.join(', '):'sin errores'));
process.exit(errores.length?1:0);
