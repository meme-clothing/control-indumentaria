/* --------------------------------------------------------------------------
   PEDIDOS A PROVEEDOR

   Un pedido es una lista de producto + talle + cantidad + costo, con fecha y
   con quién lo hizo. Nace pendiente y no toca el stock: recién cuando la
   mercadería llega se ingresa desde Productos y ahí se suma.

   Esa separación es el punto de la función. Si el pedido sumara stock al
   crearse, el sistema diría que hay mercadería que todavía está en el camión.
   -------------------------------------------------------------------------- */

import { $, $$, esc, plata, plataCorta, fechaLarga, nid, hoyISO,
         avisar, dialogo, cerrarDialogo, confirmar } from '../utilidades.js';
import { datos, guardar } from '../almacen.js';
import { pedidosPorEstado, totalPedido, unidadesPedido, sugerenciasDePedido,
         activos, conStock } from '../negocio.js';
import { ESTADOS_PEDIDO } from '../config.js';
import { vacio } from '../componentes.js';
import { ui, bus, quienOpera } from '../estado.js';

/* Líneas del pedido que se está armando. Vive mientras el diálogo está abierto. */
let lineas = [];

export function vistaPedidos(){
  const pendientes = pedidosPorEstado('pendiente');
  const cerrados = pedidosPorEstado().filter(p => p.estado !== 'pendiente');

  $('#subtitulo').textContent = pendientes.length
    ? `${pendientes.length} ${pendientes.length === 1 ? 'pedido pendiente' : 'pedidos pendientes'}`
    : 'Sin pedidos pendientes';

  $('#acciones').innerHTML = `
    <button class="btn" data-ir="productos">Ingresar mercadería</button>
    <button class="btn primario" id="nuevo-pedido">Nuevo pedido</button>`;

  $('#hoja').innerHTML = `
    ${pendientes.length ? `
      <section class="tarjeta" style="margin-bottom:16px">
        <div class="tarjeta-tope">
          <h3>Pendientes de recibir</h3>
          <span style="margin-left:auto;font-size:13px;color:var(--tinta-2)">
            ${plataCorta(pendientes.reduce((a, p) => a + totalPedido(p), 0))} en camino</span>
        </div>
        <div>${pendientes.map(tarjetaPedido).join('')}</div>
      </section>`
    : `<section class="tarjeta" style="margin-bottom:16px">${vacio({
        titulo:'No hay pedidos pendientes',
        texto:'Armá uno a mano o dejá que te lo sugiera a partir del stock bajo.',
        accion:'<button class="btn primario" id="nuevo-pedido-2">Nuevo pedido</button>'
      })}</section>`}

    ${cerrados.length ? `
      <section class="tarjeta">
        <div class="tarjeta-tope"><h3>Historial</h3>
          <span style="margin-left:auto;font-size:13px;color:var(--tinta-2)">
            ${cerrados.length} ${cerrados.length === 1 ? 'pedido' : 'pedidos'}</span>
        </div>
        <div>${cerrados.slice(0, 30).map(tarjetaPedido).join('')}</div>
      </section>` : ''}`;
}

function tarjetaPedido(p){
  const pendiente = p.estado === 'pendiente';
  return `<div class="pedido">
    <div class="pedido-tope">
      <div style="min-width:0">
        <div class="pedido-titulo">
          ${esc(p.proveedor || 'Sin proveedor')}
          <span class="pastilla es-${p.estado}">${esc(ESTADOS_PEDIDO[p.estado] || p.estado)}</span>
        </div>
        <div class="pedido-sub">
          Pedido el ${fechaLarga.format(new Date(p.fecha))} por ${esc(p.usuario || 'alguien')}
          ${p.recibidoEl ? ` · ingresado el ${fechaLarga.format(new Date(p.recibidoEl))}
            por ${esc(p.recibidoPor || 'alguien')}` : ''}
        </div>
      </div>
      <div class="pedido-monto">
        <span class="num">${plata(totalPedido(p))}</span>
        <small>${unidadesPedido(p)} unidades</small>
      </div>
    </div>

    <div class="pedido-items">
      ${p.items.map(i => `<div class="pedido-item">
        <span class="pi-nombre">${esc(i.nombre)}</span>
        <span class="pi-talle">talle ${esc(i.talle)}</span>
        <span class="pi-cant num">${i.cant} u.</span>
        <span class="pi-costo num">${plata(i.cant * (i.costoC || 0))}</span>
      </div>`).join('')}
    </div>

    ${p.nota ? `<div class="pedido-nota">${esc(p.nota)}</div>` : ''}

    ${pendiente ? `<div class="pedido-pie">
      <button class="btn chico plano" data-editar-pedido="${p.id}">Editar</button>
      <button class="btn chico plano" data-cancelar-pedido="${p.id}"
        style="color:var(--tinta-3)">Cancelar pedido</button>
    </div>` : ''}
  </div>`;
}

/* --------------------------------------------------------------------------
   EDITOR
   -------------------------------------------------------------------------- */
export function editorPedido(id){
  const p = id ? datos.pedidos.find(x => x.id === id) : null;
  lineas = p ? p.items.map(i => ({ ...i })) : [];

  dialogo({
    titulo: p ? 'Editar pedido' : 'Nuevo pedido',
    cuerpo: `
      <div style="display:grid;gap:14px">
        <div class="rejilla">
          <label class="campo"><span>Proveedor</span>
            <input type="text" id="pd-proveedor" value="${esc(p ? p.proveedor : '')}"
              placeholder="Nombre del proveedor" list="provs">
            <datalist id="provs">${
              [...new Set(datos.pedidos.map(x => x.proveedor).filter(Boolean))]
                .map(v => `<option value="${esc(v)}">`).join('')}</datalist></label>
          <label class="campo"><span>Fecha del pedido</span>
            <input type="date" id="pd-fecha"
              value="${(p ? p.fecha : hoyISO()).slice(0, 10)}"></label>
        </div>

        <div>
          <div style="display:flex;align-items:center;gap:9px;margin-bottom:8px;flex-wrap:wrap">
            <span style="font-size:13px;color:var(--tinta-2);font-weight:500">Qué pedir</span>
            <button class="btn chico" id="pd-sugerir" style="margin-left:auto">
              Sugerir del stock bajo</button>
          </div>

          <div class="pd-agregar">
            <label><span>Producto</span>
              <select id="pd-producto">
                <option value="">Elegí un producto</option>
                ${activos().map(x => `<option value="${x.id}">${esc(x.nombre)}</option>`).join('')}
              </select></label>
            <label><span>Talle</span><select id="pd-talle"></select></label>
            <label><span>Cantidad</span>
              <input type="number" id="pd-cant" value="1" min="1"></label>
            <button class="btn chico" id="pd-mas">Agregar</button>
          </div>

          <div id="pd-lineas"></div>
        </div>

        <label class="campo"><span>Nota</span>
          <input type="text" id="pd-nota" value="${esc(p ? p.nota : '')}"
            placeholder="Seña pagada, entrega estimada…"></label>

        <p class="firma">${p
          ? `Pedido por ${esc(p.usuario || 'alguien')}.`
          : `Se va a guardar a nombre de ${esc(quienOpera())}.`}</p>
      </div>`,
    pie: `<button class="btn" data-cerrar>Cancelar</button>
          <button class="btn primario" id="pd-guardar">Guardar pedido</button>`,
    alAbrir(){
      pintarLineas();
      cargarTalles();

      $('#pd-producto').onchange = cargarTalles;
      $('#pd-mas').onclick = agregarLinea;
      $('#pd-sugerir').onclick = sugerir;

      $('#dlg-cuerpo').addEventListener('click', ev => {
        const q = ev.target.closest('[data-quitar-linea]');
        if (q){ lineas.splice(+q.dataset.quitarLinea, 1); pintarLineas(); }
      });
      $('#dlg-cuerpo').addEventListener('input', ev => {
        const ix = ev.target.dataset.lineaCant;
        if (ix !== undefined){
          lineas[+ix].cant = Math.max(1, parseInt(ev.target.value) || 1);
          totalEnPantalla();
        }
      });

      $('#pd-guardar').onclick = () => guardarPedido(p);
    }
  });
}

function cargarTalles(){
  const id = $('#pd-producto').value;
  const prod = datos.productos.find(x => x.id === id);
  const sel = $('#pd-talle');
  if (!prod){ sel.innerHTML = '<option value="">—</option>'; return; }
  /* Acá van TODOS los talles, no solo los que tienen stock: justamente se
     pide lo que se agotó. */
  sel.innerHTML = Object.keys(prod.talles || {})
    .map(t => `<option value="${esc(t)}">${esc(t)}</option>`).join('')
    || '<option value="">Sin talles</option>';
}

function agregarLinea(){
  const id = $('#pd-producto').value;
  const prod = datos.productos.find(x => x.id === id);
  const talle = $('#pd-talle').value;
  const cant = Math.max(1, parseInt($('#pd-cant').value) || 1);

  if (!prod){ avisar('Elegí un producto', true); return; }
  if (!talle){ avisar('Ese producto no tiene talles cargados', true); return; }

  const ya = lineas.find(l => l.productoId === prod.id && l.talle === talle);
  if (ya) ya.cant += cant;
  else lineas.push({ productoId: prod.id, nombre: prod.nombre, talle, cant, costoC: prod.costoC });

  $('#pd-cant').value = 1;
  pintarLineas();
}

function sugerir(){
  const nuevas = sugerenciasDePedido();
  if (!nuevas.length){ avisar('No hay nada por debajo del mínimo', true); return; }

  let sumadas = 0;
  nuevas.forEach(n => {
    const ya = lineas.find(l => l.productoId === n.productoId && l.talle === n.talle);
    if (ya) return;
    lineas.push({ ...n });
    sumadas++;
  });

  pintarLineas();
  avisar(sumadas
    ? `${sumadas} ${sumadas === 1 ? 'línea sugerida' : 'líneas sugeridas'}`
    : 'Ya estaban todas en el pedido');
}

function pintarLineas(){
  const cont = $('#pd-lineas');
  if (!cont) return;

  cont.innerHTML = lineas.length
    ? `<div class="pd-tabla">
        ${lineas.map((l, ix) => `
          <div class="pd-linea">
            <span class="pd-nombre">${esc(l.nombre)}<small>talle ${esc(l.talle)}</small></span>
            <input type="number" data-linea-cant="${ix}" value="${l.cant}" min="1">
            <span class="pd-sub num">${plata(l.cant * (l.costoC || 0))}</span>
            <button class="btn chico plano" data-quitar-linea="${ix}"
              style="color:var(--tinta-3)">Quitar</button>
          </div>`).join('')}
        <div class="pd-total"><span>Total del pedido</span>
          <b class="num" id="pd-total">${plata(totalLineas())}</b></div>
      </div>`
    : `<p style="margin:0;color:var(--tinta-3);font-size:13.5px">
        Todavía no agregaste nada. Podés cargarlo a mano o usar la sugerencia
        del stock bajo.</p>`;
}

const totalLineas = () => lineas.reduce((a, l) => a + l.cant * (l.costoC || 0), 0);

function totalEnPantalla(){
  const t = $('#pd-total');
  if (t) t.textContent = plata(totalLineas());
  $$('[data-linea-cant]').forEach((inp, ix) => {
    const sub = inp.parentElement.querySelector('.pd-sub');
    if (sub) sub.textContent = plata(lineas[ix].cant * (lineas[ix].costoC || 0));
  });
}

function guardarPedido(p){
  if (!lineas.length){ avisar('El pedido no tiene ninguna línea', true); return; }

  const fecha = new Date($('#pd-fecha').value + 'T12:00:00');
  const datosPedido = {
    proveedor: $('#pd-proveedor').value.trim(),
    nota: $('#pd-nota').value.trim(),
    fecha: isNaN(fecha) ? hoyISO() : fecha.toISOString(),
    items: lineas.map(l => ({ ...l }))
  };

  if (p){
    Object.assign(p, datosPedido);
  } else {
    datos.pedidos.push(Object.assign({
      id: nid(), estado: 'pendiente', usuario: quienOpera()
    }, datosPedido));
  }

  guardar();
  cerrarDialogo();
  bus.pintar();
  avisar(p ? 'Pedido actualizado' : 'Pedido guardado');
}

export function cancelarPedido(id){
  const p = datos.pedidos.find(x => x.id === id);
  if (!p) return;
  confirmar({
    titulo: 'Cancelar pedido',
    texto: `Se marca como cancelado y deja de estar pendiente. No toca el stock, porque todavía no había ingresado.`,
    botón: 'Cancelar pedido',
    riesgo: true,
    alConfirmar(){
      p.estado = 'cancelado';
      guardar();
      bus.pintar();
      avisar('Pedido cancelado');
    }
  });
}
