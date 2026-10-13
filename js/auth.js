/* --------------------------------------------------------------------------
   INGRESO

   Hacia afuera: un nombre y un PIN. Hacia adentro: Firebase Authentication.

   La traducción es deliberada. Quien usa el sistema no tiene por qué saber
   qué es un correo de Firebase, pero los datos sí tienen que estar detrás de
   una autenticación real: las Security Rules de Firestore solo pueden mirar
   `request.auth`, y sin eso la única regla que deja funcionar la aplicación
   es "que entre cualquiera". Un login propio dejaría la base abierta a quien
   escriba directo contra ella, sin pasar nunca por la pantalla de ingreso.

   Sin Firebase configurado, cae al modo de prototipo: valida contra
   datos/usuarios.json con hash SHA-256. Eso no es seguridad, y está dicho en
   el README y en la pantalla.
   -------------------------------------------------------------------------- */

import { RUTAS, CLAVE_SESION, DOMINIO_USUARIOS, LARGO_PIN, RELLENO_PIN,
         MODO_ESTRICTO } from './config.js';
import { disponible, conexion, instanciaAparte, cerrarInstanciaAparte } from './firebase.js';
import { NEGOCIOS, esNegocioValido } from './negocios.js';

/* --------------------------------------------------------------------------
   TRADUCCIÓN NOMBRE/PIN → CUENTA
   -------------------------------------------------------------------------- */

export const normalizarUsuario = u =>
  String(u || '').trim().toLowerCase().replace(/\s+/g, '.');

export const correoDe = u => `${normalizarUsuario(u)}@${DOMINIO_USUARIOS}`;

/* Firebase pide seis caracteres como mínimo. El relleno no es un secreto ni
   agrega seguridad: solo cumple el formato. La fuerza real está en el largo
   del PIN y en el bloqueo por intentos fallidos. */
export const claveDe = pin => `${pin}${RELLENO_PIN}`;

export function pinValido(pin){
  return new RegExp(`^\\d{${LARGO_PIN}}$`).test(String(pin || ''));
}

/* --------------------------------------------------------------------------
   SESIÓN
   -------------------------------------------------------------------------- */

let sesion = null;   // { uid, usuario, nombre, rol, negocios }

export const sesionActiva = () => sesion;
export const esAdmin = () => !!sesion && sesion.rol === 'admin';

/* A qué emprendimientos puede entrar quien inició sesión.

   Hay que distinguir dos cosas que parecen iguales:

   - El perfil NO tiene el campo `negocios`: es un usuario creado antes de que
     existiera más de uno. Se le da acceso a todos, porque dejarlo afuera de
     golpe sería peor que el riesgo de darle de más.
   - El perfil tiene `negocios: []`: alguien le sacó el acceso a propósito.
     Entonces no entra a ninguno.

   Confundirlos deja al programa más permisivo que las Security Rules, que
   para una lista vacía niegan todo. El resultado sería alguien que entra y se
   encuentra con una pantalla vacía y errores de permisos, sin saber por qué. */
export function negociosPermitidos(){
  if (!sesion) return [];
  if (!Array.isArray(sesion.negocios)) return NEGOCIOS.map(n => n.id);
  return sesion.negocios.filter(esNegocioValido);
}

export const puedeEntrarA = id => negociosPermitidos().includes(id);

function recordar(u){
  sesion = u;
  try{ sessionStorage.setItem(CLAVE_SESION, JSON.stringify(u)); }catch(e){}
}

function recuperarDeSesion(){
  try{
    const c = sessionStorage.getItem(CLAVE_SESION);
    return c ? JSON.parse(c) : null;
  }catch(e){ return null; }
}

/* --------------------------------------------------------------------------
   ENTRAR
   -------------------------------------------------------------------------- */

export async function entrar(usuario, pin){
  if (!normalizarUsuario(usuario)) return { error: 'Escribí tu nombre de usuario.' };
  if (!pinValido(pin)) return { error: `El PIN son ${LARGO_PIN} números.` };

  if (disponible()) return entrarConFirebase(usuario, pin);

  /* En una instalación de cliente no hay puerta de atrás: si la nube no
     responde, no se entra. Ver MODO_ESTRICTO en config.js. */
  if (MODO_ESTRICTO)
    return { error: 'No hay conexión con la base. No se puede entrar hasta que se restablezca.' };

  return entrarModoPrototipo(usuario, pin);
}

async function entrarConFirebase(usuario, pin){
  const { auth, db, api } = conexion();
  try{
    const cred = await api.auth.signInWithEmailAndPassword(auth, correoDe(usuario), claveDe(pin));
    const perfil = await leerPerfil(db, api, cred.user.uid);
    const u = {
      uid: cred.user.uid,
      usuario: normalizarUsuario(usuario),
      nombre: (perfil && perfil.nombre) || normalizarUsuario(usuario),
      rol: (perfil && perfil.rol) || 'vendedor',
      negocios: (perfil && Array.isArray(perfil.negocios)) ? perfil.negocios : null
    };
    recordar(u);
    return { usuario: u };
  }catch(e){
    return { error: mensajeDeError(e) };
  }
}

/* Por qué el rol quedó como quedó. Sin esto, un perfil faltante y unas reglas
   que bloquean la lectura se ven exactamente igual: como "vendedor". */
let diagPerfil = { uid: null, existe: null, rol: null, error: null };

export const diagnosticoPerfil = () => diagPerfil;

async function leerPerfil(db, api, uid){
  diagPerfil = { uid, existe: null, rol: null, error: null };
  try{
    const ref = api.db.doc(db, 'usuarios', uid);
    const snap = await api.db.getDoc(ref);
    diagPerfil.existe = snap.exists();
    if (!snap.exists()) return null;
    const d = snap.data();
    diagPerfil.rol = d.rol ?? null;
    return d;
  }catch(e){
    diagPerfil.error = (e && e.code) || (e && e.message) || 'error';
    return null;
  }
}

/* Firebase devuelve códigos distintos según el caso, pero contarle a quien
   intenta entrar si el usuario existe o si solo falló el PIN le regala media
   respuesta. Un solo mensaje para los dos. */
function mensajeDeError(e){
  const c = (e && e.code) || '';
  if (c === 'auth/too-many-requests')
    return 'Demasiados intentos fallidos. Esperá unos minutos antes de volver a probar.';
  if (c === 'auth/network-request-failed')
    return 'Sin conexión con el servidor. Revisá la red.';
  if (c === 'auth/user-disabled')
    return 'Ese usuario está deshabilitado.';
  return 'Usuario o PIN incorrectos.';
}

/* --------------------------------------------------------------------------
   MODO PROTOTIPO (sin Firebase configurado)
   -------------------------------------------------------------------------- */

let usuariosLocales = null;

async function entrarModoPrototipo(usuario, pin){
  try{
    if (!usuariosLocales){
      const r = await fetch(RUTAS.usuarios);
      if (!r.ok) throw new Error('sin archivo');
      usuariosLocales = (await r.json()).usuarios || [];
    }
  }catch(e){
    return { error: 'No se pudo leer datos/usuarios.json.' };
  }

  const u = usuariosLocales.find(x => normalizarUsuario(x.usuario) === normalizarUsuario(usuario));
  if (!u) return { error: 'Usuario o PIN incorrectos.' };

  const h = await hash(pin);
  if (h !== u.clave) return { error: 'Usuario o PIN incorrectos.' };

  const sesionLocal = {
    uid: 'local-' + normalizarUsuario(usuario),
    usuario: normalizarUsuario(usuario),
    nombre: u.nombre || usuario,
    rol: u.rol || 'admin',
    negocios: Array.isArray(u.negocios) ? u.negocios : null
  };
  recordar(sesionLocal);
  return { usuario: sesionLocal };
}

/* --------------------------------------------------------------------------
   ALTA DE USUARIOS
   -------------------------------------------------------------------------- */

export async function crearUsuario({ usuario, nombre, pin, rol, negocios }){
  if (!disponible())
    return { error: 'Solo se pueden crear usuarios con Firebase configurado.' };
  if (!esAdmin())
    return { error: 'Hace falta ser administrador.' };
  if (!normalizarUsuario(usuario))
    return { error: 'Escribí un nombre de usuario.' };
  if (!pinValido(pin))
    return { error: `El PIN son ${LARGO_PIN} números.` };

  const { db, api } = conexion();
  const aparte = instanciaAparte();

  try{
    /* Sobre la instancia aparte: crear la cuenta inicia sesión con ella, y
       hecho sobre la principal echaría al administrador que la está usando. */
    const cred = await api.auth.createUserWithEmailAndPassword(
      aparte.auth, correoDe(usuario), claveDe(pin));

    const permitidos = Array.isArray(negocios) ? negocios.filter(esNegocioValido) : [];

    await api.db.setDoc(api.db.doc(db, 'usuarios', cred.user.uid), {
      usuario: normalizarUsuario(usuario),
      nombre: (nombre || '').trim() || normalizarUsuario(usuario),
      rol: rol === 'admin' ? 'admin' : 'vendedor',
      negocios: permitidos.length ? permitidos : NEGOCIOS.map(n => n.id),
      creadoPor: sesion.nombre,
      creadoEl: new Date().toISOString()
    });

    await api.auth.signOut(aparte.auth);
    return { ok: true, uid: cred.user.uid };

  }catch(e){
    const c = (e && e.code) || '';
    if (c === 'auth/email-already-in-use') return { error: 'Ese nombre de usuario ya existe.' };
    if (c === 'auth/weak-password')        return { error: 'El PIN es demasiado corto.' };
    if (c === 'auth/network-request-failed') return { error: 'Sin conexión con el servidor.' };
    return { error: 'No se pudo crear el usuario.' };
  }finally{
    await cerrarInstanciaAparte();
  }
}

export async function listarUsuarios(){
  if (!disponible() || !esAdmin()) return [];
  const { db, api } = conexion();
  try{
    const snap = await api.db.getDocs(api.db.collection(db, 'usuarios'));
    const lista = [];
    snap.forEach(d => lista.push({ uid: d.id, ...d.data() }));
    return lista.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es'));
  }catch(e){ return []; }
}

/* Cambiar el PIN de la cuenta con la que se está trabajando. */
export async function cambiarMiPin(pinViejo, pinNuevo){
  if (!disponible()) return { error: 'Solo con Firebase configurado.' };
  if (!pinValido(pinNuevo)) return { error: `El PIN son ${LARGO_PIN} números.` };

  const { auth, api } = conexion();
  try{
    const cred = api.auth.EmailAuthProvider.credential(
      auth.currentUser.email, claveDe(pinViejo));
    await api.auth.reauthenticateWithCredential(auth.currentUser, cred);
    await api.auth.updatePassword(auth.currentUser, claveDe(pinNuevo));
    return { ok: true };
  }catch(e){
    return { error: 'El PIN actual no es correcto.' };
  }
}

/* --------------------------------------------------------------------------
   SALIR Y RESTAURAR
   -------------------------------------------------------------------------- */

export async function salir(){
  sesion = null;
  try{ sessionStorage.removeItem(CLAVE_SESION); }catch(e){}
  if (disponible()){
    const { auth, api } = conexion();
    try{ await api.auth.signOut(auth); }catch(e){}
  }
}

/* Al abrir, se recupera la sesión si sigue viva. Con Firebase manda el estado
   real del SDK, no lo que diga sessionStorage: si la cuenta se deshabilitó,
   no alcanza con tener la marca guardada. */
export async function restaurarSesion(){
  const guardada = recuperarDeSesion();

  if (!disponible()){
    if (guardada) sesion = guardada;
    return sesion;
  }

  const { auth, db, api } = conexion();
  const usuarioFirebase = await new Promise(ok => {
    const corta = api.auth.onAuthStateChanged(auth, u => { corta(); ok(u); });
  });

  if (!usuarioFirebase){
    sesion = null;
    try{ sessionStorage.removeItem(CLAVE_SESION); }catch(e){}
    return null;
  }

  const perfil = await leerPerfil(db, api, usuarioFirebase.uid);
  const u = {
    uid: usuarioFirebase.uid,
    usuario: (usuarioFirebase.email || '').split('@')[0],
    nombre: (perfil && perfil.nombre) || (guardada && guardada.nombre) || 'Usuario',
    rol: (perfil && perfil.rol) || 'vendedor',
    negocios: (perfil && Array.isArray(perfil.negocios)) ? perfil.negocios
            : (guardada && Array.isArray(guardada.negocios)) ? guardada.negocios : null
  };
  recordar(u);
  return u;
}

/* --------------------------------------------------------------------------
   SHA-256 para el modo prototipo
   -------------------------------------------------------------------------- */

export async function hash(texto){
  if (crypto?.subtle){
    const bytes = new TextEncoder().encode(texto);
    const resumen = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(resumen))
      .map(b => b.toString(16).padStart(2, '0')).join('');
  }
  return sha256(texto);
}

const K = [
  0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
  0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
  0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
  0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
  0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
  0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
  0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
  0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
];

function sha256(texto){
  const gd = (x, n) => (x >>> n) | (x << (32 - n));
  const bytes = new TextEncoder().encode(texto);
  const bits = bytes.length * 8;
  const largo = (((bytes.length + 8) >> 6) + 1) << 4;
  const m = new Uint32Array(largo);
  for (let i = 0; i < bytes.length; i++) m[i >> 2] |= bytes[i] << (24 - (i % 4) * 8);
  m[bytes.length >> 2] |= 0x80 << (24 - (bytes.length % 4) * 8);
  m[largo - 1] = bits;

  let [h0,h1,h2,h3,h4,h5,h6,h7] =
    [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];

  const w = new Uint32Array(64);
  for (let i = 0; i < largo; i += 16){
    for (let t = 0; t < 16; t++) w[t] = m[i + t];
    for (let t = 16; t < 64; t++){
      const s0 = gd(w[t-15], 7) ^ gd(w[t-15], 18) ^ (w[t-15] >>> 3);
      const s1 = gd(w[t-2], 17) ^ gd(w[t-2], 19) ^ (w[t-2] >>> 10);
      w[t] = (w[t-16] + s0 + w[t-7] + s1) | 0;
    }
    let [a,b,c,d,e,f,g,h] = [h0,h1,h2,h3,h4,h5,h6,h7];
    for (let t = 0; t < 64; t++){
      const S1 = gd(e, 6) ^ gd(e, 11) ^ gd(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[t] + w[t]) | 0;
      const S0 = gd(a, 2) ^ gd(a, 13) ^ gd(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0;
      d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    h0 = (h0+a)|0; h1 = (h1+b)|0; h2 = (h2+c)|0; h3 = (h3+d)|0;
    h4 = (h4+e)|0; h5 = (h5+f)|0; h6 = (h6+g)|0; h7 = (h7+h)|0;
  }
  return [h0,h1,h2,h3,h4,h5,h6,h7]
    .map(x => (x >>> 0).toString(16).padStart(8, '0')).join('');
}
