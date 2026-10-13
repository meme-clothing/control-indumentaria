/* --------------------------------------------------------------------------
   CAPA DE DATOS

   Todo el programa lee `datos` y llama a `guardar()`. Nadie más sabe de dónde
   salen los datos ni a dónde van, y por eso conectar Firestore se hizo acá
   adentro sin tocar ninguna vista.

   Tres modos, elegidos solos al arrancar, en este orden:

   - firestore : hay datos/firebase.json y sesión iniciada. Los datos viven en
                 la nube, con las Security Rules como única puerta.
   - servidor  : hay alguien escuchando en api/base (servidor/servidor.mjs).
                 Guarda en datos/base.json.
   - local     : ninguno de los dos. Trabaja contra el navegador.
   -------------------------------------------------------------------------- */

import { RUTAS, CLAVE_LOCAL, UMBRAL_POR_DEFECTO, REPONER_HASTA_POR_DEFECTO,
         VENTANA_DIAS, RECARGOS_POR_DEFECTO } from './config.js';
import { disponible, conexion } from './firebase.js';
import { NEGOCIO_POR_DEFECTO, esNegocioValido, buscarNegocio } from './negocios.js';
import { avisar } from './utilidades.js';

const COLECCIONES = ['productos', 'ventas', 'movimientos', 'pedidos'];
/* Colecciones que se traen enteras: son chicas y se usan en toda la aplicación. */
const COMPLETAS = ['productos', 'pedidos'];
/* Colecciones que se traen por ventana de fechas: crecen sin techo. */
const POR_FECHA = ['ventas', 'movimientos'];

const VACIA = () => ({
  version: 1,
  umbral: UMBRAL_POR_DEFECTO,
  reponerHasta: REPONER_HASTA_POR_DEFECTO,
  recargos: { ...RECARGOS_POR_DEFECTO },
  productos: [], ventas: [], movimientos: [], pedidos: []
});

/* Object.assign deja pasar un `pedidos: undefined` de una base vieja, y
   después revienta al recorrerlo. Cada arreglo se completa a mano. */
function conArreglos(d){
  const r = Object.assign(VACIA(), d || {});
  COLECCIONES.forEach(k => { if (!Array.isArray(r[k])) r[k] = []; });
  if (typeof r.umbral !== 'number') r.umbral = UMBRAL_POR_DEFECTO;
  if (typeof r.reponerHasta !== 'number') r.reponerHasta = REPONER_HASTA_POR_DEFECTO;
  /* Los recargos se completan uno por uno: una base guardada antes de esta
     función no los trae, y una forma de cobro nueva tampoco. */
  r.recargos = Object.assign({ ...RECARGOS_POR_DEFECTO },
    (r.recargos && typeof r.recargos === 'object') ? r.recargos : {});
  return r;
}

export let datos = VACIA();
export let modo = 'local';          // 'firestore' | 'servidor' | 'local'
export let negocio = NEGOCIO_POR_DEFECTO;

/* En Firestore cada negocio cuelga de negocios/{id}/…
   En los otros modos, de una clave o un archivo propio. */
const coleccionDe = (db, api, col) => api.db.collection(db, 'negocios', negocio, col);
const documentoDe  = (db, api, col, id) => api.db.doc(db, 'negocios', negocio, col, id);
const claveLocalDe = () => `${CLAVE_LOCAL}.${negocio}`;
const rutaApiDe    = () => `${RUTAS.api}/${negocio}`;

/* Desde qué fecha se trajeron las ventas y los movimientos. Los informes que
   pidan algo más viejo disparan una búsqueda puntual. */
let cargadoDesde = null;

/* --------------------------------------------------------------------------
   ARRANQUE
   -------------------------------------------------------------------------- */

/* Cambiar de negocio no es solo recargar: hay que cortar lo que esté por
   guardarse del anterior. Un guardado con retardo que salga después del cambio
   escribiría los datos de un emprendimiento dentro del otro, y además borraría
   de ese otro todo lo que no coincidiera con la foto vieja. */
export async function cambiarNegocio(id){
  if (!esNegocioValido(id)) return false;
  if (id === negocio) return false;

  clearTimeout(reloj);
  reloj = null;
  foto = null;
  datos = VACIA();
  cargadoDesde = null;
  negocio = id;

  await arrancar();
  return true;
}

export async function arrancar(idNegocio){
  if (idNegocio && esNegocioValido(idNegocio) && idNegocio !== negocio){
    clearTimeout(reloj);
    reloj = null;
    foto = null;
    cargadoDesde = null;
    negocio = idNegocio;
  }
  datos = VACIA();

  if (disponible()){
    modo = 'firestore';
    await cargarDeFirestore();
    return modo;
  }

  try{
    const r = await fetch(rutaApiDe(), { headers: { 'Accept': 'application/json' } });
    if (r.ok){
      datos = conArreglos(await r.json());
      modo = 'servidor';
      tomarFoto();
      return modo;
    }
  }catch(e){ /* no hay servidor */ }

  modo = 'local';

  try{
    const crudo = localStorage.getItem(claveLocalDe());
    if (crudo){
      datos = conArreglos(JSON.parse(crudo));
      tomarFoto();
      return modo;
    }
  }catch(e){ /* almacenamiento bloqueado o JSON roto */ }

  try{
    const r = await fetch(RUTAS.inicial);
    if (r.ok){
      datos = conArreglos(await r.json());
      guardarYa();
    }
  }catch(e){
    avisar('No se pudo leer datos/inicial.json', true);
  }
  tomarFoto();
  return modo;
}

/* --------------------------------------------------------------------------
   FIRESTORE — LECTURA

   Productos y pedidos se traen enteros. Ventas y movimientos, solo la ventana
   reciente: leer todo el historial en cada visita es exactamente lo que agota
   la cuota gratuita de 50.000 lecturas por día.
   -------------------------------------------------------------------------- */

async function cargarDeFirestore(){
  const { db, api } = conexion();
  datos = VACIA();

  const desde = new Date();
  desde.setDate(desde.getDate() - VENTANA_DIAS);
  cargadoDesde = desde.toISOString();

  try{
    const cfg = await api.db.getDoc(documentoDe(db, api, 'config', 'general'));
    if (cfg.exists()){
      const c = cfg.data();
      if (typeof c.umbral === 'number') datos.umbral = c.umbral;
      if (typeof c.reponerHasta === 'number') datos.reponerHasta = c.reponerHasta;
      if (c.recargos && typeof c.recargos === 'object')
        datos.recargos = Object.assign({ ...RECARGOS_POR_DEFECTO }, c.recargos);
    }

    await Promise.all([
      ...COMPLETAS.map(async col => {
        const snap = await api.db.getDocs(coleccionDe(db, api, col));
        snap.forEach(d => datos[col].push({ id: d.id, ...d.data() }));
      }),
      ...POR_FECHA.map(async col => {
        const q = api.db.query(
          coleccionDe(db, api, col),
          api.db.where('fecha', '>=', cargadoDesde));
        const snap = await api.db.getDocs(q);
        snap.forEach(d => datos[col].push({ id: d.id, ...d.data() }));
      })
    ]);

  }catch(e){
    avisar('No se pudieron leer los datos de la nube', true);
  }

  tomarFoto();
}

/* Trae ventas y movimientos anteriores a la ventana cargada.
   La llaman los informes y la caja cuando el rango pedido se va para atrás. */
export async function asegurarDesde(fechaISO){
  if (modo !== 'firestore' || !fechaISO) return false;
  if (cargadoDesde && fechaISO >= cargadoDesde) return false;

  const { db, api } = conexion();
  const hasta = cargadoDesde;

  try{
    await Promise.all(POR_FECHA.map(async col => {
      const q = api.db.query(
        coleccionDe(db, api, col),
        api.db.where('fecha', '>=', fechaISO),
        api.db.where('fecha', '<', hasta));
      const snap = await api.db.getDocs(q);
      const conocidos = new Set(datos[col].map(x => x.id));
      snap.forEach(d => {
        if (!conocidos.has(d.id)) datos[col].push({ id: d.id, ...d.data() });
      });
    }));
    cargadoDesde = fechaISO;
    sumarAFoto();
    return true;
  }catch(e){
    avisar('No se pudo traer el historial más viejo', true);
    return false;
  }
}

/* --------------------------------------------------------------------------
   GUARDADO

   En Firestore se comparan los datos actuales contra una foto tomada en la
   última lectura o escritura, y se manda solo lo que cambió. Así ninguna
   vista tuvo que cambiar de forma de llamar.

   El costo es recorrer todo en cada guardado. Con miles de documentos es
   despreciable; si algún día esto maneja decenas de miles, hay que pasar a
   escrituras explícitas por entidad.

   La foto es también lo que evita un desastre: solo se borra de la nube lo
   que estaba en la foto. Un documento viejo que nunca se cargó, porque quedó
   fuera de la ventana de fechas, no se toca nunca.
   -------------------------------------------------------------------------- */

let foto = null;
let fotoDe = null;   // de qué negocio es la foto que está cargada

function tomarFoto(){
  foto = {};
  fotoDe = negocio;
  COLECCIONES.forEach(col => {
    foto[col] = new Map(datos[col].map(x => [x.id, JSON.stringify(x)]));
  });
  foto.config = JSON.stringify({ umbral: datos.umbral, reponerHasta: datos.reponerHasta,
                                 recargos: datos.recargos });
}

/* Después de traer historial viejo: entra a la foto sin marcar nada como nuevo. */
function sumarAFoto(){
  if (!foto) return tomarFoto();
  POR_FECHA.forEach(col => {
    datos[col].forEach(x => {
      if (!foto[col].has(x.id)) foto[col].set(x.id, JSON.stringify(x));
    });
  });
}

let reloj = null;
let enVuelo = false;

export function guardar(){
  clearTimeout(reloj);
  reloj = setTimeout(guardarYa, 350);
}

export async function guardarYa(){
  clearTimeout(reloj);

  /* Última barrera: si la foto quedó de otro negocio, no se escribe nada.
     Llegar acá significa que algo se escapó del cambio de negocio, y escribir
     sería peor que no hacerlo. */
  if (foto && fotoDe && fotoDe !== negocio) return;

  if (enVuelo){ guardar(); return; }
  enVuelo = true;
  try{
    if (modo === 'firestore') await sincronizarFirestore();
    else if (modo === 'servidor') await guardarEnServidor();
    else guardarEnNavegador();
  }finally{ enVuelo = false; }
}

async function sincronizarFirestore(){
  const { db, api } = conexion();
  if (!foto) tomarFoto();

  try{
    let lote = api.db.writeBatch(db);
    let pendientes = 0;

    const escribir = async (ref, contenido) => {
      lote.set(ref, contenido);
      /* Firestore acepta hasta 500 operaciones por lote. */
      if (++pendientes >= 450){
        await lote.commit();
        lote = api.db.writeBatch(db);
        pendientes = 0;
      }
    };
    const eliminar = async ref => {
      lote.delete(ref);
      if (++pendientes >= 450){
        await lote.commit();
        lote = api.db.writeBatch(db);
        pendientes = 0;
      }
    };

    for (const col of COLECCIONES){
      const vivos = new Set();
      for (const item of datos[col]){
        vivos.add(item.id);
        const ahora = JSON.stringify(item);
        if (foto[col].get(item.id) === ahora) continue;
        const { id, ...resto } = item;
        await escribir(documentoDe(db, api, col, item.id), resto);
      }
      /* Solo se borra lo que alguna vez se cargó. */
      for (const id of foto[col].keys()){
        if (!vivos.has(id)) await eliminar(documentoDe(db, api, col, id));
      }
    }

    const cfg = JSON.stringify({ umbral: datos.umbral, reponerHasta: datos.reponerHasta,
                                 recargos: datos.recargos });
    if (cfg !== foto.config)
      await escribir(documentoDe(db, api, 'config', 'general'), JSON.parse(cfg));

    if (pendientes) await lote.commit();

    tomarFoto();
    marcarGuardado();

  }catch(e){
    avisar('No se pudo guardar en la nube', true);
  }
}

async function guardarEnServidor(){
  try{
    const r = await fetch(rutaApiDe(), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos)
    });
    if (!r.ok) throw new Error(r.status);
    marcarGuardado();
  }catch(e){
    avisar('No se pudo guardar en el servidor', true);
  }
}

function guardarEnNavegador(){
  try{
    localStorage.setItem(claveLocalDe(), JSON.stringify(datos));
    marcarGuardado();
  }catch(e){
    avisar('No se pudo guardar en este dispositivo', true);
  }
}

let ultimoGuardado = null;
function marcarGuardado(){
  ultimoGuardado = new Date();
  document.dispatchEvent(new CustomEvent('base:guardada'));
}
export const cuandoSeGuardo = () => ultimoGuardado;

/* --------------------------------------------------------------------------
   REEMPLAZO COMPLETO
   -------------------------------------------------------------------------- */

export async function reemplazar(nueva){
  datos = conArreglos(nueva);
  return guardarYa();
}

export async function volverAlInicial(){
  const r = await fetch(RUTAS.inicial);
  if (!r.ok) throw new Error('no se pudo leer la base inicial');
  return reemplazar(await r.json());
}

export function vaciar(){
  return reemplazar(VACIA());
}

export function comoJSON(){
  return JSON.stringify(
    Object.assign({}, datos, { generado: new Date().toISOString() }), null, 2);
}

export const desdeCuandoHayDatos = () => cargadoDesde;
export const negocioActual = () => buscarNegocio(negocio);
