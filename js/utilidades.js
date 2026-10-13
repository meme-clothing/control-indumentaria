/* Utilidades sin dependencias del negocio. */

export const $  = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const nid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/* --------------------------------------------------------------------------
   PLATA
   Se guarda siempre en centavos enteros. Nada de decimales flotantes:
   0.1 + 0.2 no da 0.3 en JavaScript y eso, sumado mil veces, descuadra la caja.
   -------------------------------------------------------------------------- */
const pesos = new Intl.NumberFormat('es-AR', {
  style: 'currency', currency: 'ARS', minimumFractionDigits: 2
});

export const plata = c => pesos.format((c || 0) / 100);

export function plataCorta(c){
  const v = (c || 0) / 100;
  if (Math.abs(v) >= 1000000) return '$ ' + (v / 1000000).toFixed(1).replace('.', ',') + ' M';
  if (Math.abs(v) >= 10000)   return '$ ' + Math.round(v / 1000) + ' mil';
  return pesos.format(v);
}

/* Interpreta lo que la persona escribe o lo que viene pegado de Excel.
   Contempla que en Argentina el punto es separador de miles: "19.500" son
   diecinueve mil quinientos, mientras que "19.50" son diecinueve con cincuenta. */
export function aCentavos(txt){
  if (typeof txt === 'number') return Math.round(txt * 100);
  let s = String(txt || '').replace(/[^\d.,-]/g, '').trim();
  if (!s) return 0;

  const coma = s.lastIndexOf(','), punto = s.lastIndexOf('.');
  if (coma >= 0 && punto >= 0){
    s = coma > punto ? s.replace(/\./g, '').replace(',', '.')   // 1.234,56
                     : s.replace(/,/g, '');                      // 1,234.56
  } else if (coma >= 0){
    s = (s.split(',').length > 2) ? s.replace(/,/g, '') : s.replace(',', '.');
  } else if (punto >= 0){
    const partes = s.split('.');
    const ultima = partes[partes.length - 1];
    s = (partes.length > 2 || ultima.length === 3) ? partes.join('') : s;
  }
  const n = parseFloat(s);
  return isNaN(n) ? 0 : Math.round(n * 100);
}

/* --------------------------------------------------------------------------
   FECHAS
   -------------------------------------------------------------------------- */
export const fechaCorta = new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit' });
export const fechaLarga = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
export const fechaDia   = new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
export const hora       = new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit' });

export const dia    = iso => iso.slice(0, 10);
export const hoyISO = () => new Date().toISOString();

export function nombreDia(iso){
  const f = new Date(iso);
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const ayer = new Date(hoy); ayer.setDate(ayer.getDate() - 1);
  const k = dia(iso);
  if (k === hoy.toISOString().slice(0, 10))  return 'Hoy';
  if (k === ayer.toISOString().slice(0, 10)) return 'Ayer';
  const t = fechaDia.format(f);
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/* --------------------------------------------------------------------------
   AVISOS Y DIÁLOGO
   -------------------------------------------------------------------------- */
let avisoReloj;
export function avisar(texto, mal){
  const el = $('#aviso');
  if (!el) return;
  el.textContent = texto;
  el.className = 'aviso' + (mal ? ' mal' : '');
  el.dataset.ver = 'true';
  clearTimeout(avisoReloj);
  avisoReloj = setTimeout(() => el.dataset.ver = 'false', mal ? 4200 : 2400);
}

let cerrarActual = null;

export function dialogo({ titulo, cuerpo, pie, alAbrir }){
  $('#dlg-titulo').textContent = titulo;
  $('#dlg-cuerpo').innerHTML = cuerpo;
  $('#dlg-pie').innerHTML = pie || '';
  $('#velo').hidden = false;
  if (alAbrir) alAbrir($('#dlg-cuerpo'));
  const primero = $('#dlg-cuerpo input, #dlg-cuerpo select, #dlg-cuerpo textarea');
  if (primero) setTimeout(() => primero.focus(), 30);
  cerrarActual = () => { $('#velo').hidden = true; cerrarActual = null; };
}

export function cerrarDialogo(){ if (cerrarActual) cerrarActual(); }

export function confirmar({ titulo, texto, botón = 'Confirmar', riesgo = false, alConfirmar }){
  dialogo({
    titulo,
    cuerpo: `<p style="margin:0;color:var(--tinta-2)">${esc(texto)}</p>`,
    pie: `<button class="btn" data-cerrar>Cancelar</button>
          <button class="btn ${riesgo ? 'riesgo' : 'primario'}" id="conf-si">${esc(botón)}</button>`,
    alAbrir(){ $('#conf-si').onclick = () => { cerrarDialogo(); alConfirmar(); }; }
  });
}

/* --------------------------------------------------------------------------
   DESCARGAS
   -------------------------------------------------------------------------- */
export function bajar(nombre, texto, tipo){
  const b = new Blob([texto], { type: tipo || 'text/plain;charset=utf-8' });
  const u = URL.createObjectURL(b);
  const a = document.createElement('a');
  a.href = u; a.download = nombre; a.click();
  setTimeout(() => URL.revokeObjectURL(u), 1500);
}

export function aCSV(filas){
  return '\uFEFF' + filas.map(f => f.map(c =>
    /[;"\n]/.test(String(c)) ? `"${String(c).replace(/"/g, '""')}"` : c
  ).join(';')).join('\n');
}
