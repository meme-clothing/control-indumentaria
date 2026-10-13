/* --------------------------------------------------------------------------
   Mueve los datos de la versión de un solo negocio a la estructura nueva.

   Antes:   productos/{id}
   Después: negocios/{negocio}/productos/{id}

   Se corre una sola vez, desde el navegador, con sesión de administrador
   iniciada. Abrí la consola en la aplicación y pegá:

       const m = await import('./herramientas/migrar-a-negocios.mjs');
       await m.migrar('morta');            // primero en seco
       await m.migrar('morta', { enSerio: true });

   En seco solo cuenta lo que hay. Con enSerio copia, sin borrar nada de lo
   viejo: si algo sale mal, los datos originales siguen donde estaban.
   -------------------------------------------------------------------------- */

import { conexion, disponible } from '../js/firebase.js';
import { esNegocioValido } from '../js/negocios.js';

const COLECCIONES = ['productos', 'ventas', 'movimientos', 'pedidos'];

export async function migrar(negocio, { enSerio = false } = {}){
  if (!disponible()) throw new Error('No hay conexión con Firebase.');
  if (!esNegocioValido(negocio)) throw new Error('Ese negocio no existe: ' + negocio);

  const { db, api } = conexion();
  const resumen = {};

  for (const col of COLECCIONES){
    const viejos = await api.db.getDocs(api.db.collection(db, col));
    resumen[col] = viejos.size;
    if (!enSerio) continue;

    let lote = api.db.writeBatch(db);
    let n = 0;
    for (const d of viejos.docs){
      lote.set(api.db.doc(db, 'negocios', negocio, col, d.id), d.data());
      if (++n % 400 === 0){ await lote.commit(); lote = api.db.writeBatch(db); }
    }
    if (n % 400) await lote.commit();
  }

  const cfg = await api.db.getDoc(api.db.doc(db, 'config', 'general'));
  resumen.config = cfg.exists() ? 1 : 0;
  if (enSerio && cfg.exists())
    await api.db.setDoc(api.db.doc(db, 'negocios', negocio, 'config', 'general'), cfg.data());

  console.log(enSerio ? 'Copiado a negocios/' + negocio : 'En seco, nada se tocó:', resumen);
  console.log(enSerio
    ? 'Revisá la aplicación. Si está todo, borrá las colecciones viejas desde la consola de Firebase.'
    : 'Volvé a correrlo con { enSerio: true } para copiar.');
  return resumen;
}
