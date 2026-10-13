/* Precio por forma de cobro: recargo general y precio propio por producto.
   Requiere jsdom:  npm install --no-save jsdom
   Uso:            node herramientas/prueba-precios.mjs */
import { JSDOM, VirtualConsole } from 'jsdom';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearFirebaseFalso } from './firebase-falso.mjs';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const errores = [];
const dom = new JSDOM(await readFile(RAIZ+'/index.html','utf8'), { url:'https://local.test/',
  virtualConsole:new VirtualConsole().on('jsdomError', e=>errores.push(e.message)) });
Object.assign(globalThis,{window:dom.window,document:dom.window.document,
  localStorage:dom.window.localStorage,sessionStorage:dom.window.sessionStorage,
  CustomEvent:dom.window.CustomEvent,Event:dom.window.Event,Blob:dom.window.Blob});
const fake = crearFirebaseFalso();
globalThis.__SDK_FIREBASE = fake.sdk;
globalThis.fetch = async u => {
  const k = String(u).replace(/^https?:\/\/[^/]+\//,'').replace(/^\.?\//,'');
  if (k === 'datos/firebase.json') return new Response(JSON.stringify({apiKey:'x',projectId:'p'}),{status:200});
  if (k.startsWith('api/base')) return new Response('',{status:404});
  try{ return new Response(await readFile(RAIZ+'/'+k,'utf8'),{status:200}); }
  catch{ return new Response('',{status:404}); }
};

const auth = await import(RAIZ+'/js/auth.js');
const alm  = await import(RAIZ+'/js/almacen.js');
const neg  = await import(RAIZ+'/js/negocio.js');
const est  = await import(RAIZ+'/js/estado.js');
const cfg  = await import(RAIZ+'/js/config.js');
await import(RAIZ+'/js/app.js');
await new Promise(r=>setTimeout(r,500));

const d = document;
const paso  = (n,f)=>{try{f();console.log('  ok  '+n)}catch(e){console.log('  MAL '+n+' → '+e.message);errores.push(n)}};
const pasoA = async(n,f)=>{try{await f();console.log('  ok  '+n)}catch(e){console.log('  MAL '+n+' → '+e.message);errores.push(n)}};
const esperar = (ms=600)=>new Promise(r=>setTimeout(r,ms));

const uid = fake.sembrarCuenta('mica@'+cfg.DOMINIO_USUARIOS, auth.claveDe('1190'));
fake.poner('usuarios', uid, {usuario:'mica',nombre:'Mica',rol:'admin',negocios:['meme']});
d.getElementById('ing-usuario').value='mica';
d.getElementById('ing-clave').value='1190';
d.getElementById('ing-entrar').click();
await esperar(700);
const primera = d.querySelector('[data-elegido]');
if (primera) primera.click();
await esperar(800);

/* Producto de 1000 pesos en efectivo */
alm.datos.productos.push({ id:'p1', nombre:'Remera', categoria:'Remeras',
  costoC:50000, margen:100, precioC:100000, talles:{M:10}, activo:true });
alm.datos.recargos = { efectivo:0, transferencia:0, mercadopago:8, debito:10, credito:15, otro:0 };

console.log('== el recargo manda sobre el precio base ==');
paso('en efectivo es el precio base', ()=>{
  const p = alm.datos.productos[0];
  if(neg.precioPara(p,'efectivo') !== 100000) throw new Error(neg.precioPara(p,'efectivo'));
});
paso('con 15% de recargo, 1000 pasa a 1150', ()=>{
  const p = alm.datos.productos[0];
  if(neg.precioPara(p,'credito') !== 115000) throw new Error(neg.precioPara(p,'credito'));
});
paso('un recargo de 8% redondea al centavo', ()=>{
  const p = alm.datos.productos[0];
  if(neg.precioPara(p,'mercadopago') !== 108000) throw new Error(neg.precioPara(p,'mercadopago'));
  if(!Number.isInteger(neg.precioPara(p,'mercadopago'))) throw new Error('quedó con decimales');
});
paso('cambiar el recargo cambia todos los precios', ()=>{
  alm.datos.recargos.credito = 25;
  const p = alm.datos.productos[0];
  if(neg.precioPara(p,'credito') !== 125000) throw new Error(neg.precioPara(p,'credito'));
  alm.datos.recargos.credito = 15;
});

console.log('== precio propio del producto ==');
paso('el precio fijado gana sobre el recargo', ()=>{
  const p = alm.datos.productos[0];
  p.precios = { credito: 130000 };
  if(neg.precioPara(p,'credito') !== 130000) throw new Error(neg.precioPara(p,'credito'));
  if(neg.precioFijado(p,'credito') !== 130000) throw new Error('no lo reporta como fijado');
});
paso('los demás medios siguen con el recargo', ()=>{
  const p = alm.datos.productos[0];
  if(neg.precioPara(p,'debito') !== 110000) throw new Error(neg.precioPara(p,'debito'));
});
paso('un precio en cero o negativo se ignora', ()=>{
  const p = alm.datos.productos[0];
  p.precios = { credito: 0, debito: -500 };
  if(neg.precioPara(p,'credito') !== 115000) throw new Error('tomó el cero como precio');
  if(neg.precioPara(p,'debito') !== 110000) throw new Error('tomó el negativo');
  p.precios = { credito: 130000 };
});

console.log('== la venta usa el precio correcto ==');
await pasoA('al sumar al carrito toma el precio del medio elegido', async()=>{
  est.ui.medioPago = 'credito';
  d.querySelector('#nav button[data-vista="vender"]').click();
  const b = d.querySelector('[data-sumar="p1"]');
  if(!b) throw new Error('no aparece el producto');
  b.click();
  if(est.ui.carrito[0].precioC !== 130000) throw new Error('precio: '+est.ui.carrito[0].precioC);
});
await pasoA('cambiar el medio recalcula lo que ya está en el carrito', async()=>{
  const sel = d.getElementById('medio-pago');
  sel.value = 'efectivo';
  sel.dispatchEvent(new Event('change'));
  await esperar(150);
  if(est.ui.carrito[0].precioC !== 100000)
    throw new Error('quedó con el precio viejo: '+est.ui.carrito[0].precioC);
});
await pasoA('no quedan precios mezclados en una misma venta', async()=>{
  alm.datos.productos.push({ id:'p2', nombre:'Buzo', costoC:100000, margen:100,
    precioC:200000, talles:{L:5}, activo:true });
  d.querySelector('#nav button[data-vista="vender"]').click();
  d.querySelector('[data-sumar="p2"]').click();
  const sel = d.getElementById('medio-pago');
  sel.value = 'debito';
  sel.dispatchEvent(new Event('change'));
  await esperar(150);
  const esperados = { p1: 110000, p2: 220000 };
  est.ui.carrito.forEach(i => {
    if(i.precioC !== esperados[i.productoId])
      throw new Error(`${i.nombre} quedó en ${i.precioC}, esperaba ${esperados[i.productoId]}`);
  });
});
await pasoA('la venta guarda el precio y el medio con que se cobró', async()=>{
  const antes = alm.datos.ventas.length;
  d.getElementById('cobrar').click();
  await esperar(300);
  const v = alm.datos.ventas[alm.datos.ventas.length-1];
  if(alm.datos.ventas.length !== antes+1) throw new Error('no registró');
  if(v.medioPago !== 'debito') throw new Error('medio: '+v.medioPago);
  if(v.totalC !== 330000) throw new Error('total: '+v.totalC);
  const i = v.items.find(x=>x.productoId==='p1');
  if(i.precioC !== 110000) throw new Error('congeló otro precio: '+i.precioC);
});
await pasoA('cambiar el recargo después no toca las ventas viejas', async()=>{
  const v = alm.datos.ventas[alm.datos.ventas.length-1];
  const total = v.totalC;
  alm.datos.recargos.debito = 40;
  if(v.totalC !== total) throw new Error('se reescribió el histórico');
  alm.datos.recargos.debito = 10;
});

console.log('== configuración ==');
paso('los recargos se guardan con la base', ()=>{
  if(typeof alm.datos.recargos !== 'object') throw new Error('no están');
  cfg.MEDIOS_PAGO.forEach(m => {
    if(!(m.id in alm.datos.recargos)) throw new Error('falta '+m.id);
  });
});
await pasoA('una base vieja sin recargos se completa sola', async()=>{
  const copia = JSON.parse(JSON.stringify(alm.datos));
  delete copia.recargos;
  await alm.reemplazar(copia);
  if(typeof alm.datos.recargos !== 'object') throw new Error('no los completó');
  if(alm.datos.recargos.efectivo !== 0) throw new Error('valor raro');
});
paso('Ajustes muestra un campo por forma de cobro', ()=>{
  d.querySelector('#nav button[data-vista="ajustes"]').click();
  const campos = d.querySelectorAll('[data-recargo]');
  if(campos.length !== cfg.MEDIOS_PAGO.length) throw new Error('campos: '+campos.length);
});
paso('editarlo ahí cambia el precio', ()=>{
  const campo = d.querySelector('[data-recargo="credito"]');
  campo.value = '30';
  campo.dispatchEvent(new Event('change'));
  if(alm.datos.recargos.credito !== 30) throw new Error('no guardó: '+alm.datos.recargos.credito);
  const p = alm.datos.productos.find(x=>x.id==='p2');
  if(neg.precioPara(p,'credito') !== 260000) throw new Error('precio: '+neg.precioPara(p,'credito'));
});
paso('no acepta un recargo absurdo', ()=>{
  const campo = d.querySelector('[data-recargo="credito"]');
  campo.value = '-50';
  campo.dispatchEvent(new Event('change'));
  if(alm.datos.recargos.credito < 0) throw new Error('aceptó un recargo negativo');
});

console.log('\n'+(errores.length?'FALLOS: '+errores.join(', '):'sin errores'));
process.exit(errores.length?1:0);
