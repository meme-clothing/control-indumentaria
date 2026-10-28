/* Qué le llega realmente a Firestore cuando un producto gana o pierde colores.
   Existe para respaldar una afirmación concreta: los colores no obligan a tocar
   nada en Firebase. Ni reglas, ni índices, ni migración.

   Requiere jsdom:  npm install --no-save jsdom
   Uso:            node herramientas/prueba-firestore-colores.mjs */
import { JSDOM, VirtualConsole } from 'jsdom';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { crearFirebaseFalso } from './firebase-falso.mjs';
const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dom=new JSDOM(await readFile(RAIZ+'/index.html','utf8'),{url:'https://local.test/',virtualConsole:new VirtualConsole()});
Object.assign(globalThis,{window:dom.window,document:dom.window.document,
  localStorage:dom.window.localStorage,sessionStorage:dom.window.sessionStorage,
  CustomEvent:dom.window.CustomEvent,Event:dom.window.Event,Blob:dom.window.Blob});
const fake=crearFirebaseFalso(); globalThis.__SDK_FIREBASE=fake.sdk;
globalThis.fetch=async u=>{const k=String(u).replace(/^https?:\/\/[^/]+\//,'').replace(/^\.?\//,'');
  if(k==='datos/firebase.json') return new Response(JSON.stringify({apiKey:'x',projectId:'p'}),{status:200});
  if(k.startsWith('api/base')) return new Response('',{status:404});
  try{return new Response(await readFile(RAIZ+'/'+k,'utf8'),{status:200})}catch{return new Response('',{status:404})}};
const fb=await import(RAIZ+'/js/firebase.js');
const auth=await import(RAIZ+'/js/auth.js');
const alm=await import(RAIZ+'/js/almacen.js');
const neg=await import(RAIZ+'/js/negocio.js');
const cfg=await import(RAIZ+'/js/config.js');
await fb.iniciarFirebase();
const uid=fake.sembrarCuenta('mica@'+cfg.DOMINIO_USUARIOS, auth.claveDe('1190'));
fake.poner('usuarios',uid,{usuario:'mica',nombre:'Mica',rol:'admin',negocios:['meme']});
await auth.entrar('mica','1190');
await alm.arrancar('meme');

const err=[];
const paso=(n,f)=>{try{f();console.log('  ok  '+n)}catch(e){console.log('  MAL '+n+' → '+e.message);err.push(n)}};
const pasoA=async(n,f)=>{try{await f();console.log('  ok  '+n)}catch(e){console.log('  MAL '+n+' → '+e.message);err.push(n)}};

console.log('== un producto que gana colores ==');
await pasoA('primero se guarda sin colores', async()=>{
  alm.datos.productos.push({id:'x1',nombre:'Remera',costoC:1000,margen:100,precioC:2000,
    talles:{S:3,M:5},activo:true});
  await alm.guardarYa();
  const g=fake.leer('negocios/meme/productos','x1');
  if(!g) throw new Error('no se guardó');
  if(!g.talles || g.talles.M!==5) throw new Error('talles: '+JSON.stringify(g.talles));
  if(g.colores) throw new Error('escribió colores donde no los hay');
});
await pasoA('al agregarle colores, el campo talles queda vacío y aparece colores', async()=>{
  const p=alm.datos.productos.find(x=>x.id==='x1');
  p.colores={Negro:{S:3,M:5}}; p.talles={};
  await alm.guardarYa();
  const g=fake.leer('negocios/meme/productos','x1');
  if(!g.colores || g.colores.Negro.M!==5) throw new Error('colores: '+JSON.stringify(g.colores));
  if(Object.keys(g.talles||{}).length) throw new Error('quedó stock viejo en talles: '+JSON.stringify(g.talles));
});
await pasoA('al sacarle los colores, el campo colores desaparece del documento', async()=>{
  const p=alm.datos.productos.find(x=>x.id==='x1');
  delete p.colores; p.talles={S:3,M:5};
  await alm.guardarYa();
  const g=fake.leer('negocios/meme/productos','x1');
  if('colores' in g) throw new Error('el campo colores sobrevivió: '+JSON.stringify(g.colores));
  if(g.talles.M!==5) throw new Error('talles: '+JSON.stringify(g.talles));
});

console.log('== la lista de colores viaja en la configuración ==');
await pasoA('se guarda y se vuelve a leer', async()=>{
  alm.datos.colores=[{nombre:'Negro',tono:'#111111'},{nombre:'Oro',tono:'#C9A227'}];
  await alm.guardarYa();
  const c=fake.leer('negocios/meme/config','general');
  if(!c.colores || c.colores.length!==2) throw new Error('config: '+JSON.stringify(c));
  await alm.arrancar('meme');
  if(alm.datos.colores.length!==2) throw new Error('al releer quedó: '+alm.datos.colores.length);
  if(alm.datos.colores[1].nombre!=='Oro') throw new Error('se perdió el color agregado');
});

console.log('== no hacen falta colecciones ni consultas nuevas ==');
paso('se siguen usando las mismas colecciones', ()=>{
  const rutas=new Set([...fake.base.keys()].map(k=>k.split('/').slice(0,3).join('/')));
  const esperadas=['negocios/meme/productos','negocios/meme/config','usuarios'];
  for(const r of rutas){
    const base=r.startsWith('usuarios')?'usuarios':r;
    if(!esperadas.some(e=>base.startsWith(e.split('/').slice(0,3).join('/'))||base==='usuarios'))
      throw new Error('apareció una colección nueva: '+r);
  }
});
console.log('\n'+(err.length?'FALLOS: '+err.join(', '):'sin errores'));
process.exit(err.length?1:0);
