import { $, esc, plata, nid, avisar, hoyISO } from '../utilidades.js';
import { datos, guardar } from '../almacen.js';
import { buscar, conStock, precioPara, recargoDe } from '../negocio.js';
import { claseTalle, vacio, buscador } from '../componentes.js';
import { MEDIOS_PAGO, nombreMedio } from '../config.js';
import { ui, bus, quienOpera } from '../estado.js';

/* Cuánto saldría el carrito entero pagando de cada forma. Sirve para
   responder "¿y con tarjeta cuánto es?" sin tocar nada. */
function totalCon(medio){
  return ui.carrito.reduce((a, i) => {
    const p = datos.productos.find(x => x.id === i.productoId);
    return a + (p ? precioPara(p, medio) : i.precioC) * i.cant;
  }, 0);
}

export function vistaVender(){
  /* La forma de cobro va arriba, no en el carrito: cambia los precios de todo
     lo que está a la vista, así que tiene que elegirse antes de mirarlos. */
  $('#acciones').innerHTML = `
    ${buscador(ui.busqueda)}
    <label class="cobro-arriba">
      <span>Cobro</span>
      <select id="medio-pago">
        ${MEDIOS_PAGO.map(m => `<option value="${m.id}"
          ${ui.medioPago === m.id ? 'selected' : ''}>${esc(m.nombre)}</option>`).join('')}
      </select>
    </label>`;

  const lista = buscar(ui.busqueda);
  const total   = ui.carrito.reduce((a, i) => a + i.precioC * i.cant, 0);
  const costo   = ui.carrito.reduce((a, i) => a + i.costoC * i.cant, 0);
  const unidades = ui.carrito.reduce((a, i) => a + i.cant, 0);

  $('#hoja').innerHTML = `<div class="venta">
    <div>${lista.length ? `<div class="catalogo">${lista.map(p => `
      <div class="item">
        <h4>${esc(p.nombre)}</h4>
        <div class="cat">${esc(p.categoria || 'Sin categoría')}</div>
        <div class="precio num">${plata(precioPara(p, ui.medioPago))}${
          recargoDe(ui.medioPago) ? `<small>+${recargoDe(ui.medioPago)}%</small>` : ''}</div>
        <div class="talles">${conStock(p).map(([t, c]) => `
          <button class="talle ${claseTalle(c, p)}"
            data-sumar="${p.id}" data-talle="${esc(t)}" title="${c} en stock">
            <b>${esc(t)}</b><small>${c}</small></button>`).join('')
          || '<span class="sin-stock">Sin stock</span>'}</div>
      </div>`).join('')}</div>`
      : `<section class="tarjeta">${vacio({
          titulo:'No hay productos para vender',
          texto:'Cargá productos o revisá la búsqueda.' })}</section>`}
    </div>

    <aside class="tarjeta carrito">
      <div class="tarjeta-tope"><h3>Carrito</h3>
        ${ui.carrito.length
          ? '<button class="btn chico plano" id="vaciar-carrito" style="margin-left:auto">Vaciar</button>'
          : ''}
      </div>
      ${ui.carrito.length ? `
        <div class="carrito-lineas">${ui.carrito.map((i, ix) => `
          <div class="linea">
            <div class="n">${esc(i.nombre)}</div>
            <div class="m num">${plata(i.precioC * i.cant)}</div>
            <div class="d">Talle ${esc(i.talle)} · ${i.cant} × ${plata(i.precioC)}</div>
            <button class="quitar" data-quitar="${ix}">Quitar</button>
          </div>`).join('')}</div>

        <div class="carrito-pie">
          <div class="total-fila"><span>Cobro</span>
            <span>${esc(nombreMedio(ui.medioPago))}${
              recargoDe(ui.medioPago) ? ` · +${recargoDe(ui.medioPago)}%` : ''}</span></div>
          <div class="total-fila"><span>Productos</span><span class="num">${unidades}</span></div>
          <div class="total-fila"><span>Ganancia de esta venta</span>
            <span class="num pos">${plata(total - costo)}</span></div>
          <div class="total-fila grande"><span>A cobrar</span><b class="num">${plata(total)}</b></div>

          <details class="otros-totales">
            <summary>Cuánto sale con cada forma de pago</summary>
            <div class="otros-lista">
              ${MEDIOS_PAGO.map(m => {
                const t = totalCon(m.id);
                return `<div class="${m.id === ui.medioPago ? 'actual' : ''}">
                  <span>${esc(m.nombre)}</span><span class="num">${plata(t)}</span></div>`;
              }).join('')}
            </div>
          </details>

          <button class="btn primario" id="cobrar" style="width:100%">Confirmar venta</button>
          <p class="carrito-firma">Queda registrada a nombre de ${esc(quienOpera())}</p>
        </div>`
      : vacio({ titulo:'Carrito vacío', texto:'Tocá el talle de un producto para sumarlo.' })}
    </aside>
  </div>

  ${ui.carrito.length ? `
    <div class="barra-cobro">
      <div>
        <b class="num">${plata(total)}</b>
        <small>${unidades} ${unidades === 1 ? 'producto' : 'productos'} ·
          ${esc(nombreMedio(ui.medioPago))}</small>
      </div>
      <button class="btn primario" id="cobrar-rapido">Confirmar venta</button>
    </div>` : ''}`;

  const sel = $('#medio-pago');
  if (sel) sel.onchange = e => { cambiarMedio(e.target.value); };

  const q = $('#q');
  if (q) q.oninput = e => {
    ui.busqueda = e.target.value;
    const pos = e.target.selectionStart;
    vistaVender();
    const n = $('#q');
    if (n){ n.focus(); n.setSelectionRange(pos, pos); }
  };
}

/* Al cambiar la forma de cobro hay que recalcular lo que ya está en el
   carrito. Si no, quedarían mezclados precios de efectivo con precios de
   tarjeta en la misma venta. */
export function cambiarMedio(medio){
  ui.medioPago = medio;
  ui.carrito.forEach(i => {
    const p = datos.productos.find(x => x.id === i.productoId);
    if (p) i.precioC = precioPara(p, medio);
  });
  vistaVender();
}

export function sumarAlCarrito(productoId, talle){
  const p = datos.productos.find(x => x.id === productoId);
  if (!p) return;

  const yaPuesto = ui.carrito
    .filter(i => i.productoId === productoId && i.talle === talle)
    .reduce((a, i) => a + i.cant, 0);

  if (yaPuesto >= (p.talles[talle] || 0)){
    avisar(`Solo quedan ${p.talles[talle]} en talle ${talle}`, true);
    return;
  }

  const linea = ui.carrito.find(i => i.productoId === productoId && i.talle === talle);
  if (linea) linea.cant++;
  else ui.carrito.push({ productoId, nombre: p.nombre, talle, cant: 1,
                         precioC: precioPara(p, ui.medioPago), costoC: p.costoC });
  vistaVender();
}

export function confirmarVenta(){
  if (!ui.carrito.length) return;

  const totalC = ui.carrito.reduce((a, i) => a + i.precioC * i.cant, 0);
  const costoC = ui.carrito.reduce((a, i) => a + i.costoC * i.cant, 0);

  ui.carrito.forEach(i => {
    const p = datos.productos.find(x => x.id === i.productoId);
    if (p && p.talles[i.talle] !== undefined)
      p.talles[i.talle] = Math.max(0, p.talles[i.talle] - i.cant);
  });

  /* El precio, el costo y quién la hizo quedan congelados dentro de la venta.
     Si mañana cambia el margen del producto, la ganancia de hoy no se reescribe. */
  datos.ventas.push({
    id: nid(),
    fecha: hoyISO(),
    usuario: quienOpera(),
    medioPago: ui.medioPago,
    items: ui.carrito.map(i => ({ ...i })),
    totalC,
    gananciaC: totalC - costoC
  });

  guardar();
  const n = ui.carrito.reduce((a, i) => a + i.cant, 0);
  const medio = nombreMedio(ui.medioPago);
  ui.carrito = [];
  bus.pintar();
  avisar(`Venta registrada: ${plata(totalC)} · ${n} ${n === 1 ? 'producto' : 'productos'} · ${medio}`);
}
