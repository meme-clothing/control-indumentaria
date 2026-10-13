/* Logo, favicon, tema y colores fijos.
   Requiere jsdom:  npm install --no-save jsdom
   Uso:            node herramientas/prueba-marca.mjs */
import { JSDOM, VirtualConsole } from 'jsdom';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const errores=[];
const dom=new JSDOM(await readFile(RAIZ+'/index.html','utf8'),
  {url:'https://local.test/',virtualConsole:new VirtualConsole(),runScripts:'dangerously'});
Object.assign(globalThis,{window:dom.window,document:dom.window.document,
  localStorage:dom.window.localStorage,sessionStorage:dom.window.sessionStorage,
  CustomEvent:dom.window.CustomEvent,Event:dom.window.Event});
globalThis.fetch=async u=>{const k=String(u).replace(/^https?:\/\/[^/]+\//,'').replace(/^\.?\//,'');
  if(k==='datos/firebase.json'||k==='api/base') return new Response('',{status:404});
  try{return new Response(await readFile(RAIZ+'/'+k,'utf8'),{status:200})}catch{return new Response('',{status:404})}};
const tema=await import(RAIZ+'/js/tema.js');
await import(RAIZ+'/js/app.js');
await new Promise(r=>setTimeout(r,400));
const d=document;
const paso=(n,f)=>{try{f();console.log('  ok  '+n)}catch(e){console.log('  MAL '+n+' → '+e.message);errores.push(n)}};

console.log('== marca ==');
paso('el acceso NO lleva marca', ()=>{
  if(d.querySelector('#ingreso .marca-logo'))
    throw new Error('hay logo en el ingreso: antes de saber quién entra no se sabe cuál mostrar');
  if(!d.getElementById('ingreso').textContent.includes('Control de Indumentaria'))
    throw new Error('no dice Control de Indumentaria');
});
paso('la barra lateral sí lleva el logo', ()=>{
  if(!d.querySelector('.rail-tope .marca-logo')) throw new Error('falta en la barra lateral');
});
paso('el de la barra está encima de "Control de stock"', ()=>{
  const tope=d.querySelector('.rail-tope');
  const hijos=[...tope.children];
  if(hijos.indexOf(tope.querySelector('.marca-logo')) > hijos.indexOf(tope.querySelector('h2')))
    throw new Error('quedó debajo del título');
});
paso('hay un logo por emprendimiento', ()=>{
  ['meme','kids'].forEach(n=>{
    if(!d.querySelector(`.logo-negocio[data-de="${n}"] img`)) throw new Error('falta el de '+n);
  });
});
paso('cada logo trae medidas propias', ()=>{
  d.querySelectorAll('.logo').forEach(l=>{
    if(l.tagName.toLowerCase()==='svg' && !l.getAttribute('viewBox'))
      throw new Error('un SVG sin viewBox no escala');
    if(!l.getAttribute('width') || !l.getAttribute('height'))
      throw new Error('sin width/height: si el CSS no carga, se dibuja enorme');
  });
});
paso('está el logo de cada emprendimiento', ()=>{
  ['meme','kids'].forEach(n=>{
    if(!d.querySelector(`.logo-negocio[data-de="${n}"]`)) throw new Error('falta el de '+n);
  });
});
paso('el favicon sigue al emprendimiento', ()=>{
  const i=d.querySelector('link[rel="icon"]');
  if(!i) throw new Error('sin favicon');
  if(!/favicon-(meme|kids)\.png/.test(i.href)) throw new Error('href: '+i.href);
});

console.log('== tema ==');
paso('arranca en claro aunque el sistema esté en oscuro', ()=>{
  if(tema.temaActual()!=='claro') throw new Error('arrancó en '+tema.temaActual());
  if(tema.preferencia()!=='claro') throw new Error('preferencia: '+tema.preferencia());
});
paso('el botón alterna a oscuro', ()=>{
  d.getElementById('cambiar-tema').click();
  if(d.documentElement.dataset.tema!=='oscuro') throw new Error('no cambió');
});
paso('y vuelve a claro', ()=>{
  d.getElementById('cambiar-tema').click();
  if(d.documentElement.dataset.tema!=='claro') throw new Error('no volvió');
});
paso('el botón de la barra lateral también', ()=>{
  d.getElementById('cambiar-tema-2').click();
  if(d.documentElement.dataset.tema!=='oscuro') throw new Error('no cambió');
});
paso('queda recordado', ()=>{
  if(localStorage.getItem('indumentaria.tema')!=='oscuro') throw new Error('no lo guardó');
});
paso('se puede elegir seguir al sistema', ()=>{
  tema.aplicarTema('sistema');
  if(tema.preferencia()!=='sistema') throw new Error('no guardó la preferencia');
  if(!['claro','oscuro'].includes(tema.temaActual())) throw new Error('no resolvió a ninguno');
});
paso('un valor raro cae en claro', ()=>{
  tema.aplicarTema('violeta');
  if(tema.temaActual()!=='claro') throw new Error('quedó en '+tema.temaActual());
});
paso('la barra del navegador acompaña', ()=>{
  const m=d.querySelector('meta[name="theme-color"]');
  tema.aplicarTema('oscuro');
  if(m.content!=='#140A0C') throw new Error('en oscuro: '+m.content);
  tema.aplicarTema('claro');
  if(m.content!=='#FEEFDA') throw new Error('en claro: '+m.content);
});
paso('avisa el cambio a quien escuche', ()=>{
  let visto=null;
  d.addEventListener('tema:cambiado', e=>visto=e.detail);
  tema.alternarTema();
  if(visto!=='oscuro') throw new Error('no avisó');
  tema.aplicarTema('claro');
});

console.log('== colores fijos ==');

console.log('== paleta ==');
paso('no quedan colores del tema anterior', async()=>{});
{
  const css=await readFile(RAIZ+'/css/estilos.css','utf8');
  paso('ningún color fijo fuera de la paleta', ()=>{
    /* Esto es lo que dejó pasar la barra superior gris en tema oscuro: la
       prueba anterior buscaba colores concretos en vez de mirar si quedaba
       alguno suelto. */
    const ini=css.indexOf(':root{'), fin=css.indexOf('html{ scroll-padding');
    const resto=css.slice(0,ini)+css.slice(fin);
    const sueltos=(resto.match(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g)||[])
      .filter(c=>c!=='#fff');
    if(sueltos.length) throw new Error('fuera de la paleta: '+[...new Set(sueltos)].join(', '));
  });
  paso('el tema oscuro define todas las variables del claro', ()=>{
    const claro=[...css.matchAll(/^\s*(--[a-z0-9-]+):/gmi)].map(m=>m[1]);
    const bloqueOscuro=css.slice(css.indexOf('[data-tema="oscuro"]'), css.indexOf('html{ scroll-padding'));
    const faltan=[...new Set(claro)].filter(v=>
      !['--r-ch','--r','--r-gr','--rail'].includes(v) && !bloqueOscuro.includes(v+':'));
    if(faltan.length) throw new Error('sin variante oscura: '+faltan.join(', '));
  });
}

console.log('\n'+(errores.length?'FALLOS: '+errores.join(', '):'sin errores'));
process.exit(errores.length?1:0);
