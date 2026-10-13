/* --------------------------------------------------------------------------
   NEGOCIOS

   La misma aplicación atiende más de un emprendimiento. Cada uno tiene sus
   propios datos, su logo y su paleta, y no se mezclan nunca: en Firestore
   cuelgan de `negocios/{id}/…`, y en los otros modos de una clave aparte.

   El orden de esta lista es el orden en que aparecen al elegir.

   Para sumar uno: una entrada acá, sus dos bloques de color en el CSS, su
   logo en index.html y su miniatura en app.js.

   El `id` queda escrito en la ruta de los datos y en el permiso de cada
   usuario, así que no se cambia una vez que hay información cargada.
   -------------------------------------------------------------------------- */

export const NEGOCIOS = [
  {
    id: 'meme',
    nombre: 'Memé',
    detalle: 'Clothing',
    favicon: 'marca/favicon-meme.png',
    barra: { claro: '#FEEFDA', oscuro: '#140A0C' }
  },
  {
    id: 'kids',
    nombre: 'Memé Kids',
    detalle: 'Infantil',
    favicon: 'marca/favicon-kids.png',
    barra: { claro: '#FCE9ED', oscuro: '#171410' }
  }
];

export const NEGOCIO_POR_DEFECTO = NEGOCIOS[0].id;
export const CLAVE_NEGOCIO = 'indumentaria.negocio';

export const buscarNegocio = id => NEGOCIOS.find(n => n.id === id) || NEGOCIOS[0];
export const esNegocioValido = id => NEGOCIOS.some(n => n.id === id);

export function negocioRecordado(){
  try{
    const g = localStorage.getItem(CLAVE_NEGOCIO);
    return esNegocioValido(g) ? g : NEGOCIO_POR_DEFECTO;
  }catch(e){ return NEGOCIO_POR_DEFECTO; }
}

export function recordarNegocio(id){
  try{ localStorage.setItem(CLAVE_NEGOCIO, id); }catch(e){}
}
