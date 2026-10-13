/* Corre en su propio proceso: cambiar MODO_ESTRICTO obliga a reimportar
   config.js, y Node lo cachea aunque se le ponga otra query a quien lo importa. */
import { JSDOM, VirtualConsole } from 'jsdom';
import { readFile } from 'node:fs/promises';
import { crearFirebaseFalso } from './firebase-falso.mjs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, '..');
const estricto = process.argv[2] === 'estricto';

const dom=new JSDOM(await readFile(RAIZ+'/index.html','utf8'),{url:'https://local.test/',virtualConsole:new VirtualConsole()});
Object.assign(globalThis,{window:dom.window,document:dom.window.document,
  localStorage:dom.window.localStorage,sessionStorage:dom.window.sessionStorage,
  CustomEvent:dom.window.CustomEvent,Event:dom.window.Event});
const fake=crearFirebaseFalso();
globalThis.__SDK_FIREBASE=fake.sdk;
globalThis.fetch=async u=>{
  const k=String(u).replace(/^https?:\/\/[^/]+\//,'').replace(/^\.?\//,'');
  if(k==='datos/firebase.json') return new Response('',{status:404});
  if(k==='api/base') return new Response('',{status:404});
  try{return new Response(await readFile(RAIZ+'/'+k,'utf8'),{status:200})}catch{return new Response('',{status:404})}
};
const fb=await import(RAIZ+'/js/firebase.js');
const auth=await import(RAIZ+'/js/auth.js');
await fb.iniciarFirebase();
const r=await auth.entrar('mica','1190');
console.log(JSON.stringify({estricto, error: r.error || null, entro: !!r.usuario}));
