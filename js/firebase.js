/* --------------------------------------------------------------------------
   CONEXIÓN CON FIREBASE

   El SDK se carga desde la CDN de Google y solo si hay credenciales en
   datos/firebase.json. Si el archivo no está, si la red falla o si el entorno
   bloquea la carga, `disponible()` devuelve false y el resto del programa
   sigue funcionando contra el servidor local o contra el navegador.

   Esa degradación no es un adorno: permite desarrollar sin tocar la base real
   del negocio, y permite que la demostración de un solo archivo siga andando.
   -------------------------------------------------------------------------- */

import { RUTAS, SDK } from './config.js';

let estado = 'sin-iniciar';   // sin-iniciar | listo | ausente
let motivo = null;            // por qué no se pudo conectar
let detalle = null;           // qué dirección se pidió, qué respondió y qué vino
let app = null, auth = null, db = null, api = null, config = null;

/* Diagnóstico para la persona que está mirando la pantalla. Sin esto, un
   "no hay conexión" obliga a abrir la consola para saber qué pasó. */
const MOTIVOS = {
  'sin-archivo':
    'No encontré el archivo de credenciales en la dirección que pide la aplicación.',
  'credenciales-incompletas':
    'datos/firebase.json existe pero le faltan apiKey o projectId. Copiá de nuevo el objeto firebaseConfig completo desde la consola de Firebase.',
  'json-invalido':
    'La dirección respondió, pero lo que vino no es JSON válido.',
  'config-javascript':
    'El archivo tiene el fragmento de JavaScript de la consola de Firebase, no JSON. Convertilo con: node herramientas/firebase-config.mjs',
  'html-en-vez-de-json':
    'La dirección devolvió una página HTML en lugar del archivo. Casi siempre es el servidor respondiendo con index.html para todo lo que no encuentra, o la aplicación colgando de un subdirectorio distinto al que creés.',
  'sdk-bloqueado':
    'No se pudo descargar el SDK de Firebase. Puede ser falta de internet, o que estés abriendo el archivo con doble clic o dentro de una vista previa que bloquea scripts externos. Hace falta servir el sitio por http://localhost o por https.',
  'error':
    'Firebase respondió con un error al conectar.'
};

export async function iniciarFirebase(){
  if (estado !== 'sin-iniciar') return estado === 'listo';

  try{
    /* La dirección se resuelve a absoluta antes de pedirla: si el sitio cuelga
       de un subdirectorio, saber cuál se pidió de verdad es la mitad del
       diagnóstico. */
    const direccion = new URL(RUTAS.firebase, window.location.href).href;
    detalle = { direccion, estado: null, vino: null };

    let r;
    try{
      r = await fetch(direccion);
    }catch(e){
      detalle.vino = e.message;
      throw Object.assign(new Error('sin-archivo'), { motivo: 'sin-archivo' });
    }
    detalle.estado = r.status;
    if (!r.ok) throw Object.assign(new Error('sin-archivo'), { motivo: 'sin-archivo' });

    /* Se lee como texto y se parsea a mano para poder mirar qué vino y dar un
       diagnóstico útil. El error más común es pegar el fragmento de
       JavaScript que muestra la consola de Firebase, que no es JSON. */
    const crudo = await r.text();
    detalle.vino = crudo.slice(0, 120).replace(/\s+/g, ' ').trim();
    try{
      config = JSON.parse(crudo);
    }catch(e){
      const pareceHTML = /^\s*(<!doctype|<html|<\?xml)/i.test(crudo);
      const pareceJS = /\b(const|let|var|export)\b|firebaseConfig|^\s*\{\s*[A-Za-z_$][\w$]*\s*:/m.test(crudo);
      const codigo = pareceHTML ? 'html-en-vez-de-json'
                   : pareceJS  ? 'config-javascript'
                   : 'json-invalido';
      throw Object.assign(new Error(codigo), { motivo: codigo });
    }
    if (!config.projectId || !config.apiKey)
      throw Object.assign(new Error('incompletas'), { motivo: 'credenciales-incompletas' });

    /* Punto de inyección para las pruebas: si hay un SDK puesto acá, se usa
       ese en lugar de bajar el de Google. En el navegador nunca existe, así
       que el camino normal no cambia. Es la única forma de probar el ingreso
       y la sincronización sin pegarle a un proyecto real. */
    let apps, autenticacion, firestore;
    try{
      [apps, autenticacion, firestore] = globalThis.__SDK_FIREBASE
      ? [globalThis.__SDK_FIREBASE.apps,
         globalThis.__SDK_FIREBASE.auth,
         globalThis.__SDK_FIREBASE.db]
      : await Promise.all([
          import(`${SDK}/firebase-app.js`),
          import(`${SDK}/firebase-auth.js`),
          import(`${SDK}/firebase-firestore.js`)
        ]);
    }catch(e){
      throw Object.assign(new Error('sdk'), { motivo: 'sdk-bloqueado' });
    }

    app  = apps.initializeApp(config);
    auth = autenticacion.getAuth(app);
    db   = firestore.getFirestore(app);

    /* La caché en disco evita volver a cobrar lecturas por lo mismo y deja la
       aplicación utilizable con la conexión intermitente del local. */
    try{
      await firestore.enableIndexedDbPersistence(db);
    }catch(e){
      /* Falla si hay otra pestaña abierta o el navegador no lo soporta.
         Sin caché anda igual, solo consume más lecturas. */
    }

    api = { apps, auth: autenticacion, db: firestore };
    estado = 'listo';
    return true;

  }catch(e){
    estado = 'ausente';
    motivo = e.motivo || 'error';
    return false;
  }
}

export const disponible = () => estado === 'listo';

/* Qué pasó, en castellano, para mostrarlo en pantalla. */
export const porQueNo = () => estado === 'listo' ? null : (MOTIVOS[motivo] || MOTIVOS.error);
export const codigoDeFalla = () => motivo;

/* Qué dirección se pidió, qué respondió y los primeros caracteres de lo que
   vino. Con esos tres datos se cierra el diagnóstico sin adivinar. */
export const detalleDeFalla = () => estado === 'listo' ? null : detalle;
export const conexion   = () => ({ app, auth, db, api, config });

/* Segunda instancia de la aplicación, con su propia sesión.
   Sirve para dar de alta un usuario sin perder la sesión del administrador:
   createUserWithEmailAndPassword inicia sesión con la cuenta recién creada,
   así que hecho sobre la instancia principal echaría a quien lo está usando. */
export function instanciaAparte(nombre = 'alta'){
  if (!disponible()) return null;
  const existente = api.apps.getApps().find(a => a.name === nombre);
  const segunda = existente || api.apps.initializeApp(config, nombre);
  return { app: segunda, auth: api.auth.getAuth(segunda) };
}

export async function cerrarInstanciaAparte(nombre = 'alta'){
  if (!disponible()) return;
  const existente = api.apps.getApps().find(a => a.name === nombre);
  if (existente) await api.apps.deleteApp(existente);
}
