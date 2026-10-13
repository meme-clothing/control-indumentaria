/* Trozos de HTML que usan varias vistas. Devuelven texto, no tocan el DOM. */

import { esc, plata, plataCorta, fechaCorta } from './utilidades.js';
import { porDia, diasDe } from './negocio.js';
import { datos } from './almacen.js';

export function cifra({ titulo, valor, pie, tono = '', acento = false }){
  return `<div class="cifra${acento ? ' acento' : ''}">
    <dt>${esc(titulo)}</dt>
    <dd class="num ${tono}">${valor}</dd>
    ${pie ? `<div class="pie">${pie}</div>` : ''}
  </div>`;
}

/* Rango de fechas desde-hasta. `r` es el objeto del estado
   { clave, desde, hasta }; `attr` es el data- que escucha app.js.
   Sin min ni max en los campos: si los carga al revés, rango() los da vuelta
   solo. Poner max en "desde" impediría correr toda la ventana hacia atrás,
   porque habría que tocar "hasta" primero. */
export function selectorRango(r, attr){
  return `
    <div class="rango">
      <label><span>Desde</span>
        <input type="date" ${attr}-desde value="${esc(r.desde || '')}"></label>
      <label><span>Hasta</span>
        <input type="date" ${attr}-hasta value="${esc(r.hasta || '')}"></label>
    </div>`;
}

/* Marca de un talle: normal, por reponer o agotado. */
export const claseTalle = c => c === 0 ? 'cero' : (c <= datos.umbral ? 'bajo' : '');

export const talle = (t, c, extra = '') =>
  `<span class="talle ${claseTalle(c)}" ${extra}><b>${c}</b><small>${esc(t)}</small></span>`;

export function grafico(dias, r){
  const cubos = porDia(dias, r);
  const tope = Math.max(1, ...cubos.map(c => c.total));
  const W = 560, H = 150, pad = 26;
  const ancho = (W - pad) / cubos.length;
  const cada = Math.max(1, Math.round(cubos.length / 8));

  return `<svg class="grafico" viewBox="0 0 ${W} ${H + 26}" preserveAspectRatio="none"
            role="img" aria-label="Ventas diarias, ${cubos.length} días">
    <line class="gr-eje" x1="0" y1="${H}" x2="${W}" y2="${H}"/>
    ${cubos.map((c, i) => {
      const h = Math.max(c.total ? 3 : 0, Math.round(c.total / tope * (H - 14)));
      const x = i * ancho + pad / 2;
      return `<rect class="gr-barra" x="${x}" y="${H - h}" width="${Math.max(2, ancho - 7)}"
                height="${h}" rx="3"><title>${fechaCorta.format(c.f)} — ${plata(c.total)}</title></rect>
        ${i % cada === 0 ? `<text class="gr-txt" x="${x + (ancho - 7) / 2}" y="${H + 15}"
          text-anchor="middle">${fechaCorta.format(c.f)}</text>` : ''}`;
    }).join('')}
  </svg>
  <div style="display:flex;justify-content:space-between;margin-top:8px;font-size:12.5px;color:var(--tinta-3)">
    <span>Día más alto: ${plata(tope)}</span>
    <span>${plataCorta(cubos.reduce((a, c) => a + c.total, 0))} en ${cubos.length} ${cubos.length === 1 ? 'día' : 'días'}</span>
  </div>`;
}

export const vacio = ({ titulo, texto, accion = '' }) => `
  <div class="vacio">
    <h3>${esc(titulo)}</h3>
    <p>${esc(texto)}</p>
    ${accion}
  </div>`;

export const buscador = valor => `
  <label class="buscador">
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         stroke-width="1.9" stroke-linecap="round">
      <circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
    <input type="search" id="q" placeholder="Buscar producto" value="${esc(valor)}">
  </label>`;

/* Etiqueta chica para la forma de cobro y para quién operó. */
export const etiqueta = (texto, clase = '') =>
  `<span class="pastilla ${clase}">${esc(texto)}</span>`;
