/* Cuánto cobrar: el total siempre visible y el precio con cada forma de pago.
   Requiere jsdom:  npm install --no-save jsdom
   Uso:            node herramientas/prueba-cobro.mjs */
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
const est = await import(RAIZ+'/js/estado.js');
await import(RAIZ+'/js/app.js');
await new Promise(r=>setTimeout(r,500));
const d = document;
const paso=(n,f)=>{try{f();console.log('  ok  '+n)}catch(e){console.log('  MAL '+n+' → '+e.message);errores.push(n)}};
const esperar=(ms=200)=>new Promise(r=>setTimeout(r,ms));

d.getElementById('ing-usuario').value='mica';
d.getElementById('ing-clave').value='1190';
d.getElementById('ing-entrar').click();
await new Promise(r=>setTimeout(r,700));
const pr=d.querySelector('[data-elegido]'); if(pr) pr.click();
await new Promise(r=>setTimeout(r,700));

alm.datos.productos.length = 0;
alm.datos.productos.push({id:'c1',nombre:'Remera',costoC:50000,margen:100,precioC:100000,talles:{M:10},activo:true});
alm.datos.recargos = { efectivo:0, transferencia:0, mercadopago:8, debito:10, credito:15, otro:0 };
est.ui.medioPago = 'efectivo';
est.ui.carrito.length = 0;
d.querySelector('#nav button[data-vista="vender"]').click();

console.log('== el importe está a la vista ==');
paso('con el carrito vacío no hay barra de cobro', ()=>{
  if(d.querySelector('.barra-cobro')) throw new Error('aparece sin nada cargado');
});
paso('al sumar un producto aparece el total', ()=>{
  d.querySelector('[data-sumar="c1"]').click();
  const barra = d.querySelector('.barra-cobro');
  if(!barra) throw new Error('no apareció');
  if(!barra.textContent.includes('1.000')) throw new Error('el importe no se lee: '+barra.textContent.trim());
  if(!barra.querySelector('#cobrar-rapido')) throw new Error('sin botón de confirmar');
});
paso('dice de qué forma de cobro es ese importe', ()=>{
  if(!d.querySelector('.barra-cobro').textContent.includes('Efectivo'))
    throw new Error('no aclara la forma de cobro');
});
paso('sumar más actualiza el importe', ()=>{
  d.querySelector('[data-sumar="c1"]').click();
  if(!d.querySelector('.barra-cobro').textContent.includes('2.000'))
    throw new Error('no se actualizó');
});
paso('se puede confirmar desde la barra', ()=>{
  const antes = alm.datos.ventas.length;
  d.getElementById('cobrar-rapido').click();
  if(alm.datos.ventas.length !== antes+1) throw new Error('no registró la venta');
});

console.log('== cuánto sale con cada forma de pago ==');
paso('el carrito lista todas', ()=>{
  d.querySelector('#nav button[data-vista="vender"]').click();
  d.querySelector('[data-sumar="c1"]').click();
  const otros = d.querySelector('.otros-totales');
  if(!otros) throw new Error('no está el detalle');
  const filas = otros.querySelectorAll('.otros-lista div');
  if(filas.length !== 6) throw new Error('formas listadas: '+filas.length);
});
paso('cada una muestra su importe correcto', ()=>{
  const texto = d.querySelector('.otros-lista').textContent;
  if(!texto.includes('1.000')) throw new Error('falta el de efectivo');
  if(!texto.includes('1.150')) throw new Error('falta el de crédito con 15%');
  if(!texto.includes('1.080')) throw new Error('falta el de Mercado Pago con 8%');
});
paso('marca cuál es la elegida', ()=>{
  const actual = d.querySelector('.otros-lista .actual');
  if(!actual) throw new Error('no marca ninguna');
  if(!actual.textContent.includes('Efectivo')) throw new Error('marca: '+actual.textContent);
});
paso('al cambiar la forma, cambia lo marcado y el total', ()=>{
  const sel = d.getElementById('medio-pago');
  sel.value = 'credito';
  sel.dispatchEvent(new Event('change'));
  const actual = d.querySelector('.otros-lista .actual');
  if(!actual.textContent.includes('Tarjeta de crédito')) throw new Error('marca: '+actual.textContent);
  if(!d.querySelector('.barra-cobro').textContent.includes('1.150'))
    throw new Error('la barra no acompañó');
});
paso('un precio propio del producto también se refleja', ()=>{
  alm.datos.productos[0].precios = { credito: 130000 };
  d.querySelector('#nav button[data-vista="vender"]').click();
  const texto = d.querySelector('.otros-lista').textContent;
  if(!texto.includes('1.300')) throw new Error('no usa el precio propio: '+texto);
});

console.log('\n'+(errores.length?'FALLOS: '+errores.join(', '):'sin errores'));
process.exit(errores.length?1:0);
