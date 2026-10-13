/* Protecciones que solo importan con la base real conectada.
   Requiere jsdom:  npm install --no-save jsdom
   Uso:            node herramientas/prueba-produccion.mjs */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile } from 'node:fs/promises';
import { JSDOM, VirtualConsole } from 'jsdom';
import { crearFirebaseFalso } from './firebase-falso.mjs';
const correr = promisify(execFile);
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, '..');
const errores=[];
const pasoA=async(n,f)=>{try{await f();console.log('  ok  '+n)}catch(e){console.log('  MAL '+n+' → '+e.message);errores.push(n)}};

console.log('== modo estricto ==');
const orig = await readFile(RAIZ+'/js/config.js','utf8');
try{
  await writeFile(RAIZ+'/js/config.js', orig.replace('MODO_ESTRICTO = false','MODO_ESTRICTO = true'));
  const { stdout } = await correr('node',[resolve(AQUI,'prueba-estricto-hijo.mjs'),'estricto']);
  const r = JSON.parse(stdout);
  await pasoA('sin Firebase, en estricto NO entra', async()=>{
    if(r.entro) throw new Error('entró al modo prototipo igual');
    if(!/conexión/i.test(r.error||'')) throw new Error('mensaje poco claro: '+r.error);
  });
}finally{
  await writeFile(RAIZ+'/js/config.js', orig);
}
{
  const { stdout } = await correr('node',[resolve(AQUI,'prueba-estricto-hijo.mjs'),'normal']);
  const r = JSON.parse(stdout);
  await pasoA('sin Firebase, en desarrollo SÍ entra', async()=>{
    if(!r.entro) throw new Error('no dejó entrar: '+r.error);
  });
}

console.log('== botones destructivos con la base en la nube ==');
{
  const dom=new JSDOM(await readFile(RAIZ+'/index.html','utf8'),{url:'https://local.test/',virtualConsole:new VirtualConsole()});
  Object.assign(globalThis,{window:dom.window,document:dom.window.document,
    localStorage:dom.window.localStorage,sessionStorage:dom.window.sessionStorage,
    CustomEvent:dom.window.CustomEvent,Event:dom.window.Event,Blob:dom.window.Blob});
  const fake=crearFirebaseFalso();
  globalThis.__SDK_FIREBASE=fake.sdk;
  globalThis.fetch=async u=>{
    const k=String(u).replace(/^https?:\/\/[^/]+\//,'').replace(/^\.?\//,'');
    if(k==='datos/firebase.json') return new Response(JSON.stringify({apiKey:'x',projectId:'p'}),{status:200});
    if(k==='api/base') return new Response('',{status:404});
    try{return new Response(await readFile(RAIZ+'/'+k,'utf8'),{status:200})}catch{return new Response('',{status:404})}
  };
  const fb=await import(RAIZ+'/js/firebase.js');
  const auth=await import(RAIZ+'/js/auth.js');
  const alm=await import(RAIZ+'/js/almacen.js');
  const cfg=await import(RAIZ+'/js/config.js');
  await fb.iniciarFirebase();
  const uid=fake.sembrarCuenta('mica@'+cfg.DOMINIO_USUARIOS, auth.claveDe('1190'));
  fake.poner('usuarios',uid,{usuario:'mica',nombre:'Mica',rol:'admin',negocios:['meme']});
  await import(RAIZ+'/js/app.js');
  await new Promise(r=>setTimeout(r,400));
  const d=document;
  d.getElementById('ing-usuario').value='mica';
  d.getElementById('ing-clave').value='1190';
  d.getElementById('ing-entrar').click();
  await new Promise(r=>setTimeout(r,700));

  /* La elección de emprendimiento va siempre después de autenticarse. */
  const primera = d.querySelector('[data-elegido]');
  if (primera) primera.click();
  await new Promise(r=>setTimeout(r,800));

  await pasoA('entró en modo nube', async()=>{
    if(d.getElementById('app').hidden) throw new Error('no entró');
    if(alm.modo!=='firestore') throw new Error('modo: '+alm.modo);
  });
  d.querySelector('#nav button[data-vista="ajustes"]').click();
  await pasoA('no ofrece volver a la demostración', async()=>{
    if(d.getElementById('a-resembrar'))
      throw new Error('el botón está: reemplazaría el negocio por datos inventados');
    if(!d.getElementById('hoja').textContent.includes('no aparece con la base'))
      throw new Error('no explica por qué');
  });
  await pasoA('vaciar pide escribir BORRAR', async()=>{
    d.getElementById('a-vaciar').click();
    if(!d.getElementById('v-palabra')) throw new Error('no pidió confirmación escrita');
    if(!d.getElementById('v-si').disabled) throw new Error('el botón arranca habilitado');
  });
  await pasoA('una palabra equivocada no habilita', async()=>{
    const c=d.getElementById('v-palabra');
    c.value='borra'; c.dispatchEvent(new Event('input'));
    if(!d.getElementById('v-si').disabled) throw new Error('lo habilitó igual');
  });
  await pasoA('BORRAR habilita y vacía', async()=>{
    alm.datos.productos.push({id:'x',nombre:'Test',costoC:1,margen:1,precioC:2,talles:{M:1},activo:true});
    const c=d.getElementById('v-palabra');
    c.value='BORRAR'; c.dispatchEvent(new Event('input'));
    if(d.getElementById('v-si').disabled) throw new Error('sigue apagado');
    d.getElementById('v-si').click();
    await new Promise(r=>setTimeout(r,800));
    if(alm.datos.productos.length) throw new Error('no vació: '+alm.datos.productos.length);
  });
  await pasoA('en modo local sí ofrece la demostración', async()=>{
    /* Comprobación de que la protección es por modo y no un borrado general */
    const txt = await readFile(RAIZ+'/js/vistas/ajustes.js','utf8');
    if(!txt.includes('Volver a la demostración')) throw new Error('se perdió el botón');
  });
}

console.log('\n'+(errores.length?'FALLOS: '+errores.join(', '):'sin errores'));
process.exit(errores.length?1:0);
