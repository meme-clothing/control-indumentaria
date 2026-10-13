/* Requiere jsdom:  npm install --no-save jsdom
   Uso:            node herramientas/prueba-firebase.mjs

   Corre contra un SDK falso en memoria: no toca ningún proyecto real.
   Las Security Rules no se evalúan acá; para eso está el emulador. */
import { JSDOM, VirtualConsole } from 'jsdom';
import { readFile } from 'node:fs/promises';
import { crearFirebaseFalso } from './firebase-falso.mjs';

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const errores=[];
const dom=new JSDOM(await readFile(RAIZ+'/index.html','utf8'),{url:'https://local.test/',
  virtualConsole:new VirtualConsole().on('jsdomError',e=>errores.push(e.message))});
Object.assign(globalThis,{window:dom.window,document:dom.window.document,
  localStorage:dom.window.localStorage,sessionStorage:dom.window.sessionStorage,
  CustomEvent:dom.window.CustomEvent,Event:dom.window.Event,Blob:dom.window.Blob});

const fake = crearFirebaseFalso();
globalThis.__SDK_FIREBASE = fake.sdk;

const CONFIG = { apiKey:'AIzaFalsa', projectId:'proyecto-falso', authDomain:'x.firebaseapp.com' };
globalThis.fetch=async u=>{
  const k=String(u).replace(/^https?:\/\/[^/]+\//,'').replace(/^\.?\//,'');
  if(k==='datos/firebase.json') return new Response(JSON.stringify(CONFIG),{status:200});
  if(k==='api/base') return new Response('',{status:404});
  try{return new Response(await readFile(RAIZ+'/'+k,'utf8'),{status:200})}catch{return new Response('',{status:404})}
};

const paso=(n,f)=>{try{f();console.log('  ok  '+n)}catch(e){console.log('  MAL '+n+' → '+e.message);errores.push(n+': '+e.message)}};
const pasoA=async(n,f)=>{try{await f();console.log('  ok  '+n)}catch(e){console.log('  MAL '+n+' → '+e.message);errores.push(n+': '+e.message)}};

const fb   = await import(RAIZ+'/js/firebase.js');
const auth = await import(RAIZ+'/js/auth.js');
const alm  = await import(RAIZ+'/js/almacen.js');
const cfg  = await import(RAIZ+'/js/config.js');

console.log('== conexión ==');
await pasoA('inicia con credenciales', async()=>{
  const ok = await fb.iniciarFirebase();
  if(!ok) throw new Error('no inició');
  if(!fb.disponible()) throw new Error('no queda disponible');
});

console.log('== nombre y PIN → cuenta ==');
paso('el nombre se convierte en correo interno', ()=>{
  if(auth.correoDe('Mica')!=='mica@'+cfg.DOMINIO_USUARIOS) throw new Error(auth.correoDe('Mica'));
  if(auth.correoDe('  Ana Maria ')!=='ana.maria@'+cfg.DOMINIO_USUARIOS) throw new Error(auth.correoDe(' Ana Maria '));
});
paso('el PIN se valida por largo y por ser numérico', ()=>{
  if(!auth.pinValido('1190')) throw new Error('rechaza uno válido');
  if(auth.pinValido('119')) throw new Error('acepta uno corto');
  if(auth.pinValido('11900')) throw new Error('acepta uno largo');
  if(auth.pinValido('11a0')) throw new Error('acepta letras');
  if(auth.pinValido('')) throw new Error('acepta vacío');
});
paso('la clave derivada cumple el mínimo de Firebase', ()=>{
  if(auth.claveDe('1190').length < 6) throw new Error('Firebase la rechazaría');
});

console.log('== entrar ==');
const uidMica = fake.sembrarCuenta('mica@'+cfg.DOMINIO_USUARIOS, auth.claveDe('1190'));
fake.poner('usuarios', uidMica, { usuario:'mica', nombre:'Mica', rol:'admin' });

await pasoA('PIN incorrecto no entra', async()=>{
  const r = await auth.entrar('mica','0000');
  if(!r.error) throw new Error('entró igual');
  if(auth.sesionActiva()) throw new Error('quedó sesión');
});
await pasoA('usuario inexistente da el MISMO mensaje', async()=>{
  const a = await auth.entrar('mica','0000');
  const b = await auth.entrar('nadie','0000');
  if(a.error !== b.error) throw new Error('revela si el usuario existe');
});
await pasoA('PIN mal formado se rechaza sin pegarle al servidor', async()=>{
  const antes = fake.cuenta.lecturas;
  const r = await auth.entrar('mica','12');
  if(!r.error) throw new Error('lo aceptó');
  if(fake.cuenta.lecturas !== antes) throw new Error('consultó igual');
});
await pasoA('mica / 1190 entra y trae su rol', async()=>{
  const r = await auth.entrar('mica','1190');
  if(r.error) throw new Error(r.error);
  if(r.usuario.nombre!=='Mica') throw new Error('nombre: '+r.usuario.nombre);
  if(r.usuario.rol!=='admin') throw new Error('rol: '+r.usuario.rol);
  if(!auth.esAdmin()) throw new Error('no reconoce admin');
});

console.log('== alta de usuarios ==');
await pasoA('crea un vendedor', async()=>{
  const r = await auth.crearUsuario({usuario:'Juan', nombre:'Juan P', pin:'4321', rol:'vendedor'});
  if(r.error) throw new Error(r.error);
  const perfil = fake.leer('usuarios', r.uid);
  if(perfil.rol!=='vendedor') throw new Error('rol: '+perfil.rol);
  if(perfil.creadoPor!=='Mica') throw new Error('sin quién lo creó');
});
paso('NO echó al administrador de su sesión', ()=>{
  const s = auth.sesionActiva();
  if(!s) throw new Error('perdió la sesión');
  if(s.nombre!=='Mica') throw new Error('quedó logueado como: '+s.nombre);
  if(!auth.esAdmin()) throw new Error('perdió el rol admin');
});
await pasoA('el usuario nuevo puede entrar con su PIN', async()=>{
  const r = await auth.entrar('juan','4321');
  if(r.error) throw new Error(r.error);
  if(r.usuario.rol!=='vendedor') throw new Error('rol: '+r.usuario.rol);
  if(auth.esAdmin()) throw new Error('un vendedor no puede ser admin');
});
await pasoA('un vendedor NO puede crear usuarios', async()=>{
  const r = await auth.crearUsuario({usuario:'colado', pin:'1111', rol:'admin'});
  if(!r.error) throw new Error('lo dejó crear');
});
await pasoA('no se repite un nombre de usuario', async()=>{
  await auth.entrar('mica','1190');
  const r = await auth.crearUsuario({usuario:'juan', pin:'9999', rol:'vendedor'});
  if(!r.error) throw new Error('permitió el duplicado');
});
await pasoA('rechaza PIN de largo incorrecto', async()=>{
  const r = await auth.crearUsuario({usuario:'otro', pin:'12', rol:'vendedor'});
  if(!r.error) throw new Error('lo aceptó');
});

console.log('== cambiar PIN ==');
await pasoA('con el PIN viejo mal, no cambia', async()=>{
  const r = await auth.cambiarMiPin('0000','5555');
  if(!r.error) throw new Error('lo cambió igual');
});
await pasoA('con el PIN correcto, cambia y sirve para entrar', async()=>{
  const r = await auth.cambiarMiPin('1190','5555');
  if(r.error) throw new Error(r.error);
  await auth.salir();
  const viejo = await auth.entrar('mica','1190');
  if(!viejo.error) throw new Error('el PIN viejo sigue andando');
  const nuevo = await auth.entrar('mica','5555');
  if(nuevo.error) throw new Error('el PIN nuevo no anda');
  await auth.cambiarMiPin('5555','1190');
});

console.log('== sesión ==');
await pasoA('restaurar devuelve la sesión viva', async()=>{
  const u = await auth.restaurarSesion();
  if(!u) throw new Error('la perdió');
  if(u.rol!=='admin') throw new Error('sin rol');
});
await pasoA('salir la corta de verdad', async()=>{
  await auth.salir();
  const u = await auth.restaurarSesion();
  if(u) throw new Error('sigue viva');
});

console.log('== Firestore: lectura y escritura ==');
await auth.entrar('mica','1190');
await pasoA('arranca en modo firestore', async()=>{
  await alm.arrancar();
  if(alm.modo!=='firestore') throw new Error('modo: '+alm.modo);
});
await pasoA('una base vacía no rompe', async()=>{
  if(!Array.isArray(alm.datos.productos)) throw new Error('sin productos');
  if(alm.datos.productos.length) throw new Error('inventó datos');
});
await pasoA('guarda solo lo que cambió', async()=>{
  alm.datos.productos.push({id:'p1',nombre:'Remera',costoC:100000,margen:100,precioC:200000,talles:{M:5},activo:true});
  await alm.guardarYa();
  if(fake.contar('negocios/meme/productos')!==1) throw new Error('docs: '+fake.contar('negocios/meme/productos'));
  fake.reiniciarContador();
  await alm.guardarYa();
  if(fake.cuenta.escrituras!==0) throw new Error('reescribió sin cambios: '+fake.cuenta.escrituras);
});
await pasoA('una modificación escribe un solo documento', async()=>{
  alm.datos.productos.push({id:'p2',nombre:'Buzo',costoC:200000,margen:100,precioC:400000,talles:{L:3},activo:true});
  fake.reiniciarContador();
  await alm.guardarYa();
  if(fake.cuenta.escrituras!==1) throw new Error('escrituras: '+fake.cuenta.escrituras);
});
await pasoA('borrar de la memoria borra en la nube', async()=>{
  alm.datos.productos = alm.datos.productos.filter(p=>p.id!=='p2');
  fake.reiniciarContador();
  await alm.guardarYa();
  if(fake.cuenta.borrados!==1) throw new Error('borrados: '+fake.cuenta.borrados);
  if(fake.contar('negocios/meme/productos')!==1) throw new Error('quedaron: '+fake.contar('negocios/meme/productos'));
});
await pasoA('la configuración va a su propio documento', async()=>{
  alm.datos.umbral = 5;
  await alm.guardarYa();
  if(fake.leer('negocios/meme/config','general').umbral!==5) throw new Error('no la guardó');
});

console.log('== ventana de fechas ==');
const hoy = new Date();
const vieja = new Date(hoy); vieja.setDate(vieja.getDate()-300);
const reciente = new Date(hoy); reciente.setDate(reciente.getDate()-5);
fake.poner('negocios/meme/ventas','v-vieja',{fecha:vieja.toISOString(),totalC:100000,gananciaC:50000,items:[],usuario:'Mica'});
fake.poner('negocios/meme/ventas','v-nueva',{fecha:reciente.toISOString(),totalC:200000,gananciaC:90000,items:[],usuario:'Mica'});

await pasoA('al abrir trae solo la ventana reciente', async()=>{
  await alm.arrancar();
  const ids = alm.datos.ventas.map(v=>v.id);
  if(!ids.includes('v-nueva')) throw new Error('no trajo la reciente');
  if(ids.includes('v-vieja')) throw new Error('trajo todo el historial');
});
await pasoA('NO borra de la nube lo que no cargó', async()=>{
  fake.reiniciarContador();
  await alm.guardarYa();
  if(fake.cuenta.borrados!==0) throw new Error('borró '+fake.cuenta.borrados+' documentos que no había leído');
  if(!fake.leer('negocios/meme/ventas','v-vieja')) throw new Error('la venta vieja desapareció de la nube');
});
await pasoA('asegurarDesde trae el historial viejo', async()=>{
  const desde = new Date(hoy); desde.setDate(desde.getDate()-400);
  const trajo = await alm.asegurarDesde(desde.toISOString());
  if(!trajo) throw new Error('no fue a buscar');
  if(!alm.datos.ventas.find(v=>v.id==='v-vieja')) throw new Error('no la trajo');
});
await pasoA('no la trae dos veces', async()=>{
  const antes = alm.datos.ventas.length;
  const desde = new Date(hoy); desde.setDate(desde.getDate()-400);
  await alm.asegurarDesde(desde.toISOString());
  if(alm.datos.ventas.length!==antes) throw new Error('duplicó');
});
await pasoA('lo traído después tampoco se borra al guardar', async()=>{
  fake.reiniciarContador();
  await alm.guardarYa();
  if(fake.cuenta.borrados!==0) throw new Error('borró '+fake.cuenta.borrados);
});

console.log('== degradación sin Firebase ==');
await pasoA('sin credenciales cae a modo navegador', async()=>{
  const mod = await import(RAIZ+'/js/firebase.js?limpio=' + Date.now());
  const fetchViejo = globalThis.fetch;
  globalThis.fetch = async u => {
    const k=String(u).replace(/^https?:\/\/[^/]+\//,'').replace(/^\.?\//,'');
    if(k==='datos/firebase.json') return new Response('',{status:404});
    return fetchViejo(u);
  };
  const ok = await mod.iniciarFirebase();
  globalThis.fetch = fetchViejo;
  if(ok) throw new Error('dijo que había Firebase');
  if(mod.disponible()) throw new Error('quedó disponible');
});

console.log('\n'+(errores.length?'FALLOS:\n'+errores.join('\n'):'sin errores'));
process.exit(errores.length?1:0);
