/* --------------------------------------------------------------------------
   MARCA

   Aplicar un negocio es poner un atributo en el elemento raíz. El CSS se
   encarga del resto: paleta, logo, color de la barra del navegador.

   El tema vive aparte, en tema.js. Los dos se combinan: data-negocio decide
   el juego de colores, data-tema decide la variante clara u oscura.
   -------------------------------------------------------------------------- */

import { buscarNegocio, esNegocioValido, recordarNegocio,
         NEGOCIO_POR_DEFECTO } from './negocios.js';
import { temaActual } from './tema.js';

export const negocioEnPantalla = () => {
  const id = document.documentElement.dataset.negocio;
  return esNegocioValido(id) ? id : NEGOCIO_POR_DEFECTO;
};

export function aplicarMarca(id){
  const n = buscarNegocio(id);
  document.documentElement.dataset.negocio = n.id;
  recordarNegocio(n.id);
  dibujarLogo(n);

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = n.barra[temaActual()] || n.barra.claro;

  const icono = document.querySelector('link[rel="icon"]');
  if (icono) icono.href = n.favicon;

  const toque = document.querySelector('link[rel="apple-touch-icon"]');
  if (toque) toque.href = n.favicon;

  document.dispatchEvent(new CustomEvent('marca:cambiada', { detail: n.id }));
  return n;
}

/* El logo se dibuja, no se esconde con CSS.

   Antes estaban los dos en el documento y una regla ocultaba el que no
   correspondía. Si esa regla no se aplicaba por lo que fuera, aparecían los
   dos juntos. Dibujando solo el que va, el otro no existe: no hay nada que
   ocultar ni regla de la que depender. */
function dibujarLogo(n){
  const caja = document.getElementById('marca-logo');
  if (!caja) return;
  const l = n.logo;
  if (!l){ caja.innerHTML = ''; return; }
  caja.innerHTML = `<img class="logo logo-${l.forma}" src="${l.src}" ` +
    `width="${l.ancho}" height="${l.alto}" alt="${n.nombre}" decoding="async">`;
}

/* Al cambiar el tema hay que repintar la barra del navegador con el color del
   negocio, no con uno fijo. */
export function sincronizarConTema(){
  document.addEventListener('tema:cambiado', () => {
    const n = buscarNegocio(negocioEnPantalla());
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = n.barra[temaActual()] || n.barra.claro;
  });
}
