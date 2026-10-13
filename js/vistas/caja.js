/* --------------------------------------------------------------------------
   CAJA

   Antes esto era una tabla de seis columnas. En una tablet el concepto de una
   venta ("2× Remera oversize (M), 1× Buzo canguro (L)…") desbordaba a lo ancho
   y empujaba el monto fuera de la pantalla, que es justo el dato que se mira.

   Ahora es una lista agrupada por día, como un resumen bancario: el monto
   siempre a la vista, el detalle de la venta se despliega solo si se pide.
   -------------------------------------------------------------------------- */

import { $, esc, plata, plataCorta, hora, nombreDia, dia, nid, aCentavos, fechaLarga,
         avisar, dialogo, cerrarDialogo } from '../utilidades.js';
import { datos, guardar } from '../almacen.js';
import { rango, resumen } from '../negocio.js';
import { cifra, selectorRango, vacio } from '../componentes.js';
import { MEDIOS_PAGO, MEDIO_POR_DEFECTO, nombreMedio } from '../config.js';
import { ui, bus, quienOpera } from '../estado.js';

/* Los atributos width, height, fill y stroke van en el propio SVG, no solo en
   el CSS. Si la hoja de estilos no llega a aplicarse —caché vieja, un motor
   que no soporta la regla— un SVG sin medidas se dibuja a su tamaño por
   defecto, que son 300x150, y aparece un dibujo gigante y relleno de negro
   en cada fila. Con los atributos puestos eso no puede pasar. */
const SVG = 'width="19" height="19" viewBox="0 0 24 24" fill="none" ' +
            'stroke="currentColor" stroke-width="1.9" ' +
            'stroke-linecap="round" stroke-linejoin="round"';

const ICONO_VENTA = `<svg ${SVG}>
  <path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.6L21 8H6"/>
  <circle cx="10" cy="20" r="1.3"/><circle cx="18" cy="20" r="1.3"/></svg>`;
const ICONO_INGRESO = `<svg ${SVG}><path d="M12 19V5m0 0-6 6m6-6 6 6"/></svg>`;
const ICONO_EGRESO  = `<svg ${SVG}><path d="M12 5v14m0 0 6-6m-6 6-6-6"/></svg>`;

export function vistaCaja(){
  const r = rango(ui.rangoCaja);
  const s = resumen(r);

  $('#subtitulo').textContent =
    `Del ${fechaLarga.format(r.ini)} al ${fechaLarga.format(r.fin)}` +
    (r.dadoVuelta ? ' · las fechas estaban al revés, las di vuelta' : '');

  $('#acciones').innerHTML = `
    ${selectorRango(ui.rangoCaja, 'data-rango-caja')}
    <button class="btn" id="nuevo-egreso">Registrar egreso</button>
    <button class="btn" id="nuevo-ingreso">Registrar ingreso</button>`;

  /* Ventas y movimientos manuales conviven en una sola lista ordenada. */
  const filas = [
    ...s.ventas.map(v => ({
      id: v.id, fecha: v.fecha, clase: 'venta', signo: 1, montoC: v.totalC,
      titulo: tituloVenta(v), ganancia: v.gananciaC, items: v.items,
      usuario: v.usuario, medio: v.medioPago
    })),
    ...s.movs.map(m => ({
      id: m.id, fecha: m.fecha, clase: m.tipo, signo: m.tipo === 'egreso' ? -1 : 1,
      montoC: m.montoC, titulo: m.concepto, ganancia: null, items: null,
      usuario: m.usuario, medio: m.medioPago
    }))
  ].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

  /* Agrupadas por día, con el neto de cada jornada en el encabezado. */
  const dias = [];
  filas.forEach(f => {
    const k = dia(f.fecha);
    let g = dias.find(x => x.k === k);
    if (!g){ g = { k, fecha: f.fecha, filas: [] }; dias.push(g); }
    g.filas.push(f);
  });

  $('#hoja').innerHTML = `
    <dl class="cifras">
      ${cifra({ titulo:'Ventas', valor: plataCorta(s.vendido), tono:'pos',
                pie:`${s.ventas.length} operaciones` })}
      ${cifra({ titulo:'Otros ingresos', valor: plataCorta(s.otrosIng),
                pie:'aportes y devoluciones' })}
      ${cifra({ titulo:'Egresos', valor: plataCorta(s.egresos), tono:'neg',
                pie:'gastos del período' })}
      ${cifra({ titulo:'Balance', valor: plataCorta(s.balance), acento: true,
                pie: s.balance >= 0 ? 'a favor' : 'en rojo' })}
    </dl>

    <section class="tarjeta">
      <div class="tarjeta-tope">
        <h3>Movimientos</h3>
        <span style="margin-left:auto;font-size:13px;color:var(--tinta-2)">
          ${filas.length} ${filas.length === 1 ? 'registro' : 'registros'}</span>
      </div>
      ${dias.length ? `<div class="movs">${dias.map(g => bloqueDia(g)).join('')}</div>`
        : vacio({ titulo:'Sin movimientos en este período',
                  texto:'Cambiá el rango de fechas o registrá una venta.' })}
    </section>`;
}

function tituloVenta(v){
  const unidades = v.items.reduce((a, i) => a + i.cant, 0);
  if (v.items.length === 1){
    const i = v.items[0];
    return `${i.cant}× ${i.nombre} · talle ${i.talle}`;
  }
  return `Venta de ${unidades} productos`;
}

function bloqueDia(g){
  const neto = g.filas.reduce((a, f) => a + f.signo * f.montoC, 0);
  return `
    <div class="mov-dia">
      <h4>${esc(nombreDia(g.fecha))}</h4>
      <span class="dia-total num ${neto >= 0 ? 'pos' : 'neg'}">${plata(neto)}</span>
    </div>
    ${g.filas.map(f => filaMov(f)).join('')}`;
}

function filaMov(f){
  const icono = f.clase === 'venta' ? ICONO_VENTA
              : f.clase === 'ingreso' ? ICONO_INGRESO : ICONO_EGRESO;
  const etiqueta = f.clase === 'venta' ? 'Venta'
                 : f.clase === 'ingreso' ? 'Ingreso' : 'Egreso';

  return `<div class="mov">
    <div class="mov-icono ${f.clase === 'egreso' ? 'es-egreso' : ''}">${icono}</div>
    <div class="mov-txt" title="${esc(f.titulo)}">${esc(f.titulo)}</div>
    <div class="mov-monto">
      <span class="num" style="color:${f.signo < 0 ? 'var(--egreso)' : 'var(--marca)'}">
        ${f.signo < 0 ? '−' : '+'} ${plata(f.montoC)}</span>
      <button class="deshacer" data-deshacer="${f.id}" data-clase="${f.clase}">Deshacer</button>
    </div>
    <div class="mov-sub">
      <span class="num">${hora.format(new Date(f.fecha))}</span>
      <span class="sep">·</span>
      <span class="pastilla es-${f.clase}">${etiqueta}</span>
      ${f.medio ? `<span class="sep">·</span>
        <span class="pastilla">${esc(nombreMedio(f.medio))}</span>` : ''}
      ${f.usuario ? `<span class="sep">·</span>
        <span>${esc(f.usuario)}</span>` : ''}
      ${f.ganancia !== null ? `<span class="sep">·</span>
        <span>ganancia ${plata(f.ganancia)}</span>` : ''}
      ${f.items && f.items.length > 1
        ? `<button class="mov-ver" data-ver="${f.id}">Ver detalle</button>` : ''}
    </div>
    ${f.items && f.items.length > 1 ? `
      <div class="mov-detalle" id="det-${f.id}" hidden>
        ${f.items.map(i => `<div>
          <span>${i.cant}× ${esc(i.nombre)} · talle ${esc(i.talle)}</span>
          <span class="num">${plata(i.precioC * i.cant)}</span></div>`).join('')}
      </div>` : ''}
  </div>`;
}

export function alternarDetalle(id){
  const el = $('#det-' + id);
  if (!el) return;
  el.hidden = !el.hidden;
  const btn = $(`[data-ver="${id}"]`);
  if (btn) btn.textContent = el.hidden ? 'Ver detalle' : 'Ocultar detalle';
}

/* --------------------------------------------------------------------------
   ALTA DE MOVIMIENTOS
   -------------------------------------------------------------------------- */
export function editorMovimiento(tipo){
  dialogo({
    titulo: tipo === 'egreso' ? 'Registrar egreso' : 'Registrar ingreso',
    cuerpo: `<div style="display:grid;gap:14px">
      <label class="campo"><span>Concepto</span>
        <input type="text" id="m-concepto"
          placeholder="${tipo === 'egreso' ? 'Alquiler del local' : 'Aporte de caja'}"></label>
      <label class="campo"><span>Monto</span>
        <input type="text" id="m-monto" inputmode="decimal" placeholder="45000"></label>
      <label class="campo">
        <span>${tipo === 'egreso' ? 'Cómo lo pagaste' : 'Cómo lo cobraste'}</span>
        <select id="m-medio">
          ${MEDIOS_PAGO.map(m => `<option value="${m.id}"
            ${m.id === MEDIO_POR_DEFECTO ? 'selected' : ''}>${esc(m.nombre)}</option>`).join('')}
        </select></label>
      <label class="campo"><span>Fecha</span>
        <input type="date" id="m-fecha" value="${new Date().toISOString().slice(0, 10)}"></label>
      <p class="firma" style="margin:0">Queda registrado a nombre de ${esc(quienOpera())}</p>
    </div>`,
    pie: `<button class="btn" data-cerrar>Cancelar</button>
          <button class="btn primario" id="m-guardar">Guardar</button>`,
    alAbrir(){
      $('#m-guardar').onclick = () => {
        const concepto = $('#m-concepto').value.trim();
        const montoC = aCentavos($('#m-monto').value);
        if (!concepto){ avisar('Escribí un concepto', true); return; }
        if (montoC <= 0){ avisar('El monto tiene que ser mayor a cero', true); return; }

        const f = new Date($('#m-fecha').value + 'T12:00:00');
        datos.movimientos.push({ id: nid(), fecha: f.toISOString(), tipo, concepto, montoC,
                                 medioPago: $('#m-medio').value,
                                 usuario: quienOpera() });
        guardar(); cerrarDialogo(); bus.pintar();
        avisar(tipo === 'egreso' ? 'Egreso registrado' : 'Ingreso registrado');
      };
    }
  });
}

export function deshacer(id, clase){
  if (clase === 'venta'){
    const v = datos.ventas.find(x => x.id === id);
    if (!v) return;
    /* Deshacer una venta devuelve la mercadería al stock. */
    v.items.forEach(i => {
      const p = datos.productos.find(x => x.id === i.productoId);
      if (p && p.talles[i.talle] !== undefined) p.talles[i.talle] += i.cant;
    });
    datos.ventas = datos.ventas.filter(x => x.id !== id);
    avisar('Venta deshecha, el stock volvió a su lugar');
  } else {
    datos.movimientos = datos.movimientos.filter(x => x.id !== id);
    avisar('Movimiento eliminado');
  }
  guardar();
  bus.pintar();
}
