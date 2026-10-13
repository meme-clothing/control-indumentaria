/* Requiere jsdom:  npm install --no-save jsdom
   Uso:            node herramientas/prueba-diagnostico.mjs */
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
const pasoA=async(n,f)=>{try{await f();console.log('  ok  '+n)}catch(e){console.log('  MAL '+n+' → '+e.message);errores.push(n)}};

const base = async u => {
  const k=String(u).replace(/^https?:\/\/[^/]+\//,'').replace(/^\.?\//,'');
  try{return new Response(await readFile(RAIZ+'/'+k,'utf8'),{status:200})}catch{return new Response('',{status:404})}
};

async function probar(nombre, respuesta, sdk, esperado){
  const mod = await import(RAIZ+'/js/firebase.js?c='+Math.random());
  globalThis.__SDK_FIREBASE = sdk;
  globalThis.fetch = async u => {
    const k=String(u).replace(/^https?:\/\/[^/]+\//,'').replace(/^\.?\//,'');
    if(k==='datos/firebase.json') return respuesta();
    return base(u);
  };
  await mod.iniciarFirebase();
  await pasoA(nombre, ()=>{
    if(mod.codigoDeFalla()!==esperado)
      throw new Error(`dio "${mod.codigoDeFalla()}" y esperaba "${esperado}"`);
    if(esperado && !mod.porQueNo()) throw new Error('sin texto explicativo');
  });
}

console.log('== diagnóstico de conexión ==');
const fake = crearFirebaseFalso();
const CFG = {apiKey:'AIza',projectId:'p'};

await probar('archivo ausente', ()=>new Response('',{status:404}), fake.sdk, 'sin-archivo');
await probar('el servidor devuelve index.html para todo',
  ()=>new Response('<!DOCTYPE html>\n<html lang="es"><head><title>Control</title>',{status:200}),
  fake.sdk, 'html-en-vez-de-json');
await probar('fragmento de JavaScript',
  ()=>new Response('const firebaseConfig = {\n apiKey: "x", projectId: "p"\n};',{status:200}),
  fake.sdk, 'config-javascript');
await probar('JSON roto', ()=>new Response('{roto',{status:200}), fake.sdk, 'json-invalido');
await probar('credenciales incompletas', ()=>new Response(JSON.stringify({apiKey:'x'}),{status:200}), fake.sdk, 'credenciales-incompletas');
await probar('SDK inalcanzable', ()=>new Response(JSON.stringify(CFG),{status:200}), null, 'sdk-bloqueado');
await probar('todo bien', ()=>new Response(JSON.stringify(CFG),{status:200}), fake.sdk, null);

console.log('\n'+(errores.length?'FALLOS: '+errores.join(', '):'sin errores'));
process.exit(errores.length?1:0);
