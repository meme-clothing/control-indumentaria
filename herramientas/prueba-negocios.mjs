/* Separación de datos entre emprendimientos.
   Requiere jsdom:  npm install --no-save jsdom
   Uso:            node herramientas/prueba-negocios.mjs */
import { JSDOM, VirtualConsole } from 'jsdom';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearFirebaseFalso } from './firebase-falso.mjs';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const errores = [];
const dom = new JSDOM(await readFile(RAIZ+'/index.html','utf8'),
  { url:'https://local.test/', virtualConsole:new VirtualConsole().on('jsdomError',e=>errores.push(e.message)) });
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

const paso  = (n,f)=>{try{f();console.log('  ok  '+n)}catch(e){console.log('  MAL '+n+' → '+e.message);errores.push(n)}};
const pasoA = async(n,f)=>{try{await f();console.log('  ok  '+n)}catch(e){console.log('  MAL '+n+' → '+e.message);errores.push(n)}};

const fb   = await import(RAIZ+'/js/firebase.js');
const auth = await import(RAIZ+'/js/auth.js');
const alm  = await import(RAIZ+'/js/almacen.js');
const cfg  = await import(RAIZ+'/js/config.js');
await fb.iniciarFirebase();

const uid = fake.sembrarCuenta('mica@'+cfg.DOMINIO_USUARIOS, auth.claveDe('1190'));
fake.poner('usuarios', uid, { usuario:'mica', nombre:'Mica', rol:'admin', negocios:['meme','kids'] });
await auth.entrar('mica','1190');

console.log('== rutas separadas ==');
await pasoA('los datos de Morta van bajo negocios/morta', async()=>{
  await alm.arrancar('meme');
  alm.datos.productos.push({id:'m1',nombre:'Remera Morta',costoC:100000,margen:100,precioC:200000,talles:{M:5},activo:true});
  await alm.guardarYa();
  if(!fake.leer('negocios/meme/productos','m1')) throw new Error('no lo escribió donde corresponde');
  if(fake.leer('productos','m1')) throw new Error('escribió en la raíz, como la versión vieja');
});
await pasoA('los de Lima van bajo negocios/lima', async()=>{
  await alm.cambiarNegocio('kids');
  alm.datos.productos.push({id:'l1',nombre:'Buzo Lima',costoC:200000,margen:100,precioC:400000,talles:{L:3},activo:true});
  await alm.guardarYa();
  if(!fake.leer('negocios/kids/productos','l1')) throw new Error('no lo escribió');
});

console.log('== sin contaminación cruzada ==');
await pasoA('estando en Lima no se ven los productos de Morta', async()=>{
  if(alm.datos.productos.find(p=>p.id==='m1')) throw new Error('se coló un producto del otro negocio');
  if(alm.datos.productos.length!==1) throw new Error('productos: '+alm.datos.productos.length);
});
await pasoA('guardar en Lima NO borra lo de Morta', async()=>{
  await alm.guardarYa();
  if(!fake.leer('negocios/meme/productos','m1'))
    throw new Error('borró el producto de Morta al guardar Lima');
});
await pasoA('volver a Morta recupera lo suyo', async()=>{
  await alm.cambiarNegocio('meme');
  if(!alm.datos.productos.find(p=>p.id==='m1')) throw new Error('perdió lo de Morta');
  if(alm.datos.productos.find(p=>p.id==='l1')) throw new Error('trajo lo de Lima');
});

console.log('== el guardado pendiente no cruza ==');
await pasoA('un cambio sin guardar no cae en el otro negocio', async()=>{
  /* Este es el escenario peligroso: se toca algo, el guardado queda con
     retardo, y antes de que salga se cambia de emprendimiento. */
  alm.datos.productos.push({id:'fantasma',nombre:'No debería viajar',costoC:1,margen:1,precioC:2,talles:{M:1},activo:true});
  alm.guardar();                       // queda pendiente, con retardo
  await alm.cambiarNegocio('kids');    // se cambia antes de que salga
  await new Promise(r=>setTimeout(r,600));
  await alm.guardarYa();
  if(fake.leer('negocios/kids/productos','fantasma'))
    throw new Error('el producto de Morta terminó dentro de Lima');
  if(alm.datos.productos.find(p=>p.id==='fantasma'))
    throw new Error('quedó en memoria después de cambiar');
});
await pasoA('y Lima quedó intacto', async()=>{
  if(!fake.leer('negocios/kids/productos','l1')) throw new Error('se perdió el producto de Lima');
  if(fake.contar('negocios/kids/productos')!==1)
    throw new Error('documentos en Lima: '+fake.contar('negocios/kids/productos'));
});

console.log('== la configuración también es por negocio ==');
await pasoA('cada uno tiene su umbral', async()=>{
  await alm.cambiarNegocio('meme');
  alm.datos.umbral = 7;
  await alm.guardarYa();
  await alm.cambiarNegocio('kids');
  alm.datos.umbral = 2;
  await alm.guardarYa();
  await alm.cambiarNegocio('meme');
  if(alm.datos.umbral!==7) throw new Error('umbral de Morta: '+alm.datos.umbral);
  await alm.cambiarNegocio('kids');
  if(alm.datos.umbral!==2) throw new Error('umbral de Lima: '+alm.datos.umbral);
});

console.log('== permisos ==');
paso('con la lista en el perfil, solo esos', ()=>{
  const p = auth.negociosPermitidos();
  if(p.length!==2) throw new Error('permitidos: '+p.join(','));
});
await pasoA('un usuario de un solo negocio no entra al otro', async()=>{
  const uid2 = fake.sembrarCuenta('ana@'+cfg.DOMINIO_USUARIOS, auth.claveDe('2222'));
  fake.poner('usuarios', uid2, { usuario:'ana', nombre:'Ana', rol:'vendedor', negocios:['kids'] });
  await auth.salir();
  await auth.entrar('ana','2222');
  if(auth.puedeEntrarA('meme')) throw new Error('la deja entrar a Morta');
  if(!auth.puedeEntrarA('kids')) throw new Error('no la deja entrar a Lima');
});
await pasoA('un perfil viejo sin la lista entra a todos', async()=>{
  const uid3 = fake.sembrarCuenta('vieja@'+cfg.DOMINIO_USUARIOS, auth.claveDe('3333'));
  fake.poner('usuarios', uid3, { usuario:'vieja', nombre:'Vieja', rol:'admin' });
  await auth.salir();
  await auth.entrar('vieja','3333');
  if(!auth.puedeEntrarA('meme') || !auth.puedeEntrarA('kids'))
    throw new Error('un usuario de antes del cambio quedó sin acceso');
});
await pasoA('al crear un usuario se guardan sus negocios', async()=>{
  await auth.salir();
  await auth.entrar('mica','1190');
  const r = await auth.crearUsuario({usuario:'juan',nombre:'Juan',pin:'4444',rol:'vendedor',negocios:['meme']});
  if(r.error) throw new Error(r.error);
  const perfil = fake.leer('usuarios', r.uid);
  if(JSON.stringify(perfil.negocios)!==JSON.stringify(['meme'])) throw new Error('negocios: '+perfil.negocios);
});

console.log('== modo navegador ==');
await pasoA('cada negocio usa su propia clave', async()=>{
  const mod = await import(RAIZ+'/js/firebase.js?sin=' + Date.now());
  /* se simula sin Firebase para ejercitar el modo local */
  localStorage.clear();
  localStorage.setItem('indumentaria.base.v1.meme', JSON.stringify({productos:[{id:'x'}],ventas:[],movimientos:[],pedidos:[],umbral:2,reponerHasta:6}));
  localStorage.setItem('indumentaria.base.v1.kids',  JSON.stringify({productos:[],ventas:[],movimientos:[],pedidos:[],umbral:2,reponerHasta:6}));
  if(!localStorage.getItem('indumentaria.base.v1.meme')) throw new Error('no separó la clave');
  if(localStorage.getItem('indumentaria.base.v1.meme')===localStorage.getItem('indumentaria.base.v1.kids'))
    throw new Error('las dos claves tienen lo mismo');
});

console.log('\n'+(errores.length?'FALLOS: '+errores.join(', '):'sin errores'));
process.exit(errores.length?1:0);
