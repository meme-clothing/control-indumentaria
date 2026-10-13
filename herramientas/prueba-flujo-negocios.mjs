/* Quién ve qué: la dueña con dos emprendimientos y cada vendedora con el suyo.
   Requiere jsdom:  npm install --no-save jsdom
   Uso:            node herramientas/prueba-flujo-negocios.mjs */
import { JSDOM, VirtualConsole } from 'jsdom';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearFirebaseFalso } from './firebase-falso.mjs';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const errores = [];
const dom = new JSDOM(await readFile(RAIZ+'/index.html','utf8'), { url:'https://local.test/',
  virtualConsole: new VirtualConsole().on('jsdomError', e=>errores.push(e.message)) });
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
const cfg  = await import(RAIZ+'/js/config.js');
await import(RAIZ+'/js/app.js');
await new Promise(r=>setTimeout(r,500));

const d = document;
const paso  = (n,f)=>{try{f();console.log('  ok  '+n)}catch(e){console.log('  MAL '+n+' → '+e.message);errores.push(n)}};
const pasoA = async(n,f)=>{try{await f();console.log('  ok  '+n)}catch(e){console.log('  MAL '+n+' → '+e.message);errores.push(n)}};
const esperar = (ms=700)=>new Promise(r=>setTimeout(r,ms));

async function ingresar(usuario, pin){
  d.getElementById('ing-usuario').value = usuario;
  d.getElementById('ing-clave').value = pin;
  d.getElementById('ing-entrar').click();
  await esperar(900);
}
async function salirDeTodo(){
  if (!d.getElementById('app').hidden) d.getElementById('salir').click();
  else if (!d.getElementById('elegir').hidden) d.getElementById('elegir-salir').click();
  await esperar(400);
}

/* Mica: dueña de los dos. Brenda: Morta. Paola: Lima. */
const uMica   = fake.sembrarCuenta('mica@'+cfg.DOMINIO_USUARIOS,   auth.claveDe('1190'));
const uBrenda = fake.sembrarCuenta('brenda@'+cfg.DOMINIO_USUARIOS, auth.claveDe('2222'));
const uPaola  = fake.sembrarCuenta('paola@'+cfg.DOMINIO_USUARIOS,  auth.claveDe('3333'));
fake.poner('usuarios', uMica,   {usuario:'mica',  nombre:'Mica',   rol:'admin',    negocios:['meme','kids']});
fake.poner('usuarios', uBrenda, {usuario:'brenda',nombre:'Brenda', rol:'vendedor', negocios:['meme']});
fake.poner('usuarios', uPaola,  {usuario:'paola', nombre:'Paola',  rol:'vendedor', negocios:['kids']});

console.log('== la pantalla de ingreso no revela nada ==');
paso('el ingreso es neutro: sin marca y sin nombres', ()=>{
  if(d.getElementById('elegir-negocio')) throw new Error('quedó el selector previo');
  if(d.querySelector('#ingreso .marca-logo')) throw new Error('tiene logo');
  const texto = d.getElementById('ingreso').textContent;
  if(/Memé/.test(texto)) throw new Error('nombra un emprendimiento');
  if(!texto.includes('Control de Indumentaria')) throw new Error('no dice Control de Indumentaria');
});

console.log('== Paola, vendedora de Memé Kids ==');
await pasoA('ve una sola opción, la suya', async()=>{
  await ingresar('paola','3333');
  if(d.getElementById('elegir').hidden) throw new Error('no apareció la elección');
  const op = d.querySelectorAll('[data-elegido]');
  if(op.length!==1) throw new Error('opciones: '+op.length);
  if(op[0].dataset.elegido!=='kids') throw new Error('le ofrece: '+op[0].dataset.elegido);
  op[0].click();
  await esperar(800);
  if(d.getElementById('app').hidden) throw new Error('no entró');
  if(alm.negocio!=='kids') throw new Error('entró a: '+alm.negocio);
});
paso('no ve el botón de cambiar de emprendimiento', ()=>{
  if(d.getElementById('cambiar-negocio')) throw new Error('puede cambiarse al otro');
});
paso('no hay ninguna vía hacia el otro emprendimiento', ()=>{
  /* Los dos se llaman parecido, así que buscar el texto "Memé" no sirve:
     se controlan los elementos que permitirían llegar al otro. */
  if(d.querySelector('[data-ir-negocio="meme"]')) throw new Error('hay un acceso a Memé');
  if(d.getElementById('negocio-actual').querySelector('button'))
    throw new Error('el bloque del emprendimiento es accionable');
  if(!d.getElementById('negocio-actual').textContent.includes('Kids'))
    throw new Error('no dice en cuál está');
});
paso('la marca es la de Memé Kids', ()=>{
  if(d.documentElement.dataset.negocio!=='kids') throw new Error(d.documentElement.dataset.negocio);
});

console.log('== Brenda, vendedora de Memé ==');
await salirDeTodo();
await pasoA('ve una sola opción, la suya', async()=>{
  await ingresar('brenda','2222');
  const op = d.querySelectorAll('[data-elegido]');
  if(op.length!==1) throw new Error('opciones: '+op.length);
  if(op[0].dataset.elegido!=='meme') throw new Error('le ofrece: '+op[0].dataset.elegido);
  op[0].click();
  await esperar(800);
  if(alm.negocio!=='meme') throw new Error('entró a: '+alm.negocio);
});
paso('no ve Memé Kids por ningún lado', ()=>{
  if(d.getElementById('cambiar-negocio')) throw new Error('puede cambiarse');
  if(d.querySelector('[data-ir-negocio="kids"]')) throw new Error('hay un acceso a Kids');
  if(/Memé Kids/.test(d.getElementById('app').textContent))
    throw new Error('el otro emprendimiento está a la vista');
});

console.log('== Mica, dueña de los dos ==');
await salirDeTodo();
await pasoA('le preguntan dónde quiere trabajar', async()=>{
  await ingresar('mica','1190');
  if(d.getElementById('elegir').hidden) throw new Error('no apareció la pantalla');
  if(!d.getElementById('app').hidden) throw new Error('entró sin elegir');
  const op = d.querySelectorAll('[data-elegido]');
  if(op.length!==2) throw new Error('opciones: '+op.length);
  if(!d.getElementById('elegir-saludo').textContent.includes('Mica')) throw new Error('sin saludo');
});
await pasoA('elige Morta y entra ahí', async()=>{
  d.querySelector('[data-elegido="meme"]').click();
  await esperar(800);
  if(d.getElementById('app').hidden) throw new Error('no entró');
  if(alm.negocio!=='meme') throw new Error('negocio: '+alm.negocio);
  if(d.documentElement.dataset.negocio!=='meme') throw new Error('la marca no acompañó');
});
paso('ella sí tiene el botón de cambio', ()=>{
  if(!d.getElementById('cambiar-negocio')) throw new Error('no se lo ofrece');
});
await pasoA('cambia a Lima sin cerrar sesión', async()=>{
  d.getElementById('cambiar-negocio').click();
  d.querySelector('[data-ir-negocio="kids"]').click();
  await esperar(800);
  if(alm.negocio!=='kids') throw new Error('negocio: '+alm.negocio);
  if(!d.getElementById('negocio-actual').textContent.includes('Kids')) throw new Error('la barra no dice dónde está');
});
await pasoA('desde la elección puede volver atrás', async()=>{
  await salirDeTodo();
  await ingresar('mica','1190');
  if(d.getElementById('elegir').hidden) throw new Error('no apareció');
  d.getElementById('elegir-salir').click();
  await esperar(400);
  if(d.getElementById('ingreso').hidden) throw new Error('no volvió al ingreso');
  if(!d.getElementById('elegir').hidden) throw new Error('quedó la pantalla de elección');
});

console.log('== un usuario sin emprendimientos ==');
await pasoA('no entra y se le dice por qué', async()=>{
  const uNadie = fake.sembrarCuenta('nadie@'+cfg.DOMINIO_USUARIOS, auth.claveDe('9999'));
  fake.poner('usuarios', uNadie, {usuario:'nadie', nombre:'Nadie', rol:'vendedor', negocios:[]});
  await ingresar('nadie','9999');
  if(!d.getElementById('app').hidden) throw new Error('entró igual');
  if(d.getElementById('ing-error').hidden) throw new Error('sin mensaje');
  if(!d.getElementById('ing-error').textContent.includes('ningún')) throw new Error(d.getElementById('ing-error').textContent);
});

paso('sin errores de consola', ()=>{ if(errores.filter(e=>!e.includes(' ')).length) throw new Error(errores[0]); });
console.log('\n'+(errores.length?'FALLOS: '+errores.join(', '):'sin errores'));
process.exit(errores.length?1:0);
