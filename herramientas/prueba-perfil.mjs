/* Las cuatro razones por las que alguien puede no quedar como administrador */
/* Requiere jsdom:  npm install --no-save jsdom
   Uso:            node herramientas/prueba-perfil.mjs */
import { JSDOM, VirtualConsole } from 'jsdom';
import { readFile } from 'node:fs/promises';
import { crearFirebaseFalso } from './firebase-falso.mjs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const errores=[];
const dom=new JSDOM(await readFile(RAIZ+'/index.html','utf8'),{url:'https://local.test/',virtualConsole:new VirtualConsole()});
Object.assign(globalThis,{window:dom.window,document:dom.window.document,
  localStorage:dom.window.localStorage,sessionStorage:dom.window.sessionStorage,
  CustomEvent:dom.window.CustomEvent,Event:dom.window.Event});

const fake=crearFirebaseFalso();
globalThis.__SDK_FIREBASE=fake.sdk;
globalThis.fetch=async u=>{
  const k=String(u).replace(/^https?:\/\/[^/]+\//,'').replace(/^\.?\//,'');
  if(k==='datos/firebase.json') return new Response(JSON.stringify({apiKey:'x',projectId:'p'}),{status:200});
  try{return new Response(await readFile(RAIZ+'/'+k,'utf8'),{status:200})}catch{return new Response('',{status:404})}
};
const fb=await import(RAIZ+'/js/firebase.js');
const auth=await import(RAIZ+'/js/auth.js');
const cfg=await import(RAIZ+'/js/config.js');
await fb.iniciarFirebase();

const pasoA=async(n,f)=>{try{await f();console.log('  ok  '+n)}catch(e){console.log('  MAL '+n+' → '+e.message);errores.push(n)}};
const correo = 'mica@'+cfg.DOMINIO_USUARIOS;
const uid = fake.sembrarCuenta(correo, auth.claveDe('1190'));

console.log('== por qué no queda como admin ==');

await pasoA('sin documento de perfil: lo detecta', async()=>{
  fake.base.delete('usuarios/'+uid);
  await auth.salir();
  const r = await auth.entrar('mica','1190');
  if(r.error) throw new Error(r.error);
  if(auth.esAdmin()) throw new Error('lo dejó pasar como admin');
  const d = auth.diagnosticoPerfil();
  if(d.existe !== false) throw new Error('existe: '+d.existe);
  if(d.uid !== uid) throw new Error('uid mal: '+d.uid);
});

await pasoA('documento con rol vendedor: lo dice', async()=>{
  fake.poner('usuarios', uid, {usuario:'mica', nombre:'Mica', rol:'vendedor'});
  await auth.salir();
  await auth.entrar('mica','1190');
  if(auth.esAdmin()) throw new Error('lo tomó como admin');
  const d = auth.diagnosticoPerfil();
  if(d.existe !== true) throw new Error('no vio el documento');
  if(d.rol !== 'vendedor') throw new Error('rol: '+d.rol);
});

await pasoA('rol mal escrito no cuenta como admin', async()=>{
  fake.poner('usuarios', uid, {usuario:'mica', rol:'Admin '});
  await auth.salir();
  await auth.entrar('mica','1190');
  if(auth.esAdmin()) throw new Error('aceptó "Admin " con mayúscula y espacio');
  if(auth.diagnosticoPerfil().rol !== 'Admin ') throw new Error('no informa el valor real');
});

await pasoA('documento sin campo rol', async()=>{
  fake.poner('usuarios', uid, {usuario:'mica', nombre:'Mica'});
  await auth.salir();
  await auth.entrar('mica','1190');
  if(auth.esAdmin()) throw new Error('lo tomó como admin');
  const d = auth.diagnosticoPerfil();
  if(d.existe !== true) throw new Error('no vio el documento');
  if(d.rol !== null) throw new Error('rol: '+d.rol);
});

await pasoA('con rol admin correcto, entra', async()=>{
  fake.poner('usuarios', uid, {usuario:'mica', nombre:'Mica', rol:'admin'});
  await auth.salir();
  const r = await auth.entrar('mica','1190');
  if(!auth.esAdmin()) throw new Error('no lo reconoció');
  if(r.usuario.nombre!=='Mica') throw new Error('nombre: '+r.usuario.nombre);
  const d = auth.diagnosticoPerfil();
  if(d.error) throw new Error('reportó error igual');
});

await pasoA('documento con el id equivocado no sirve', async()=>{
  fake.base.delete('usuarios/'+uid);
  fake.poner('usuarios', 'mica', {usuario:'mica', rol:'admin'});   // id = nombre, no uid
  await auth.salir();
  await auth.entrar('mica','1190');
  if(auth.esAdmin()) throw new Error('lo aceptó con el id equivocado');
  if(auth.diagnosticoPerfil().existe !== false) throw new Error('no avisa que falta');
});

console.log('\n'+(errores.length?'FALLOS: '+errores.join(', '):'sin errores'));
process.exit(errores.length?1:0);
