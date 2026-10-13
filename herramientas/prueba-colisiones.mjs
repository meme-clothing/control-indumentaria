/* Busca colisiones de nombres de clase: elementos del contenido que enganchan
   por accidente una regla de posicionamiento pensada para otra cosa.
   Es lo que produjo el círculo verde gigante en la caja. */
/* Requiere jsdom:  npm install --no-save jsdom
   Uso:            node herramientas/prueba-colisiones.mjs */
import { JSDOM, VirtualConsole } from 'jsdom';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dom=new JSDOM(await readFile(RAIZ+'/index.html','utf8'),{url:'http://localhost:4173/',virtualConsole:new VirtualConsole()});
Object.assign(globalThis,{window:dom.window,document:dom.window.document,
  localStorage:dom.window.localStorage,sessionStorage:dom.window.sessionStorage,
  CustomEvent:dom.window.CustomEvent,Event:dom.window.Event,Blob:dom.window.Blob});
globalThis.fetch=async u=>{const k=String(u).replace(/^https?:\/\/[^/]+\//,'').replace(/^\.?\//,'');
  if(k==='api/base') return new Response('',{status:404});
  try{return new Response(await readFile(RAIZ+'/'+k,'utf8'),{status:200})}catch{return new Response('',{status:404})}};

/* Se quitan los comentarios: pegados al selector, hacen que la regla pase
   desapercibida y la prueba dé un falso verde. */
const css = (await readFile(RAIZ+'/css/estilos.css','utf8')).replace(/\/\*[\s\S]*?\*\//g, '');

const PELIGROSAS = new Set();
for (const m of css.matchAll(/(^|\}|\{)\s*([^{}@]+?)\s*\{([^{}]*)\}/g)){
  const selector = m[2].trim(), cuerpo = m[3];
  if (!/^\.[a-z0-9-]+$/i.test(selector)) continue;
  if (/position\s*:\s*(fixed|absolute)|inset\s*:\s*0|z-index\s*:\s*[5-9]\d/.test(cuerpo))
    PELIGROSAS.add(selector.slice(1));
}
console.log('clases que sacan al elemento del flujo:', [...PELIGROSAS].sort().join(', ') || 'ninguna');

await import(RAIZ+'/js/app.js');
await new Promise(r=>setTimeout(r,300));
const d=document;

/* Importar no está en el menú: se entra desde el botón de Productos. */
function irA(v){
  if (v === 'importar'){
    document.querySelector('#nav button[data-vista="productos"]').click();
    document.querySelector('#acciones [data-ir="importar"]').click();
  } else {
    document.querySelector('#nav button[data-vista="' + v + '"]').click();
  }
}

d.getElementById('ing-usuario').value='mica'; d.getElementById('ing-clave').value='1190';
d.getElementById('ing-entrar').click();
await new Promise(r=>setTimeout(r,300));

const LEGITIMOS = new Set(['ingreso','velo','aviso','app']);
const VISTAS = ['panel','vender','productos','importar','caja','informes','ajustes'];
const fallos=[];

for (const v of VISTAS){
  irA(v);
  for (const el of d.querySelectorAll('#hoja *')){
    if (LEGITIMOS.has(el.id)) continue;
    for (const c of el.classList){
      if (PELIGROSAS.has(c))
        fallos.push(`  vista ${v}: <${el.tagName.toLowerCase()} class="${el.className.trim()}"> engancha la regla .${c}`);
    }
  }
}
const unicos=[...new Set(fallos)];
console.log(unicos.length ? '\nCOLISIONES:\n'+unicos.join('\n') : '\nsin colisiones');
process.exit(unicos.length?1:0);
