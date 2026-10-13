import { $, $$, esc, plata, plataCorta, aCentavos, nid, avisar, dialogo, cerrarDialogo,
         hoyISO, fechaLarga } from '../utilidades.js';
import { datos, guardar } from '../almacen.js';
import { buscar, activos, stockDe, valorStockVenta, precioDe, conStock,
         pedidosPorEstado, totalPedido, unidadesPedido, cambiosDeCosto,
         recibirPedidos, precioPara, precioFijado, recargoDe,
         umbralDe, reponerHastaDe } from '../negocio.js';
import { talle, vacio, buscador } from '../componentes.js';
import { ESTADOS_PEDIDO, MEDIOS_PAGO, UMBRAL_POR_DEFECTO,
         REPONER_HASTA_POR_DEFECTO } from '../config.js';
import { ui, bus, quienOpera } from '../estado.js';

export function vistaProductos(){
  $('#subtitulo').textContent =
    `${activos().length} productos · ${activos().reduce((a, p) => a + stockDe(p), 0)} unidades en stock`;
  const pendientes = pedidosPorEstado('pendiente');

  $('#acciones').innerHTML = `
    ${buscador(ui.busqueda)}
    <button class="btn" data-ir="importar">Importar</button>
    <button class="btn" id="ingresar-pedido" ${pendientes.length ? '' : 'disabled'}
      title="${pendientes.length ? '' : 'No hay pedidos pendientes'}">
      Ingresar pedido${pendientes.length ? ` (${pendientes.length})` : ''}</button>
    <button class="btn primario" id="nuevo-producto">Nuevo producto</button>`;

  const lista = buscar(ui.busqueda);

  $('#hoja').innerHTML = lista.length
    ? `<section class="tarjeta"><div class="tabla-env"><table>
        <thead><tr>
          <th>Producto</th><th>Stock por talle</th>
          <th class="der">Costo</th><th class="der">Margen</th>
          <th class="der">Precio</th><th class="der">Valor</th>
          <th>Cargado por</th><th></th>
        </tr></thead>
        <tbody>${lista.map(p => `
          <tr>
            <td><div class="prod-nombre">${esc(p.nombre)}</div>
                <div class="prod-cat">${esc(p.categoria || 'Sin categoría')}</div></td>
            <td><div class="talles">${
              conStock(p).map(([t, c]) => talle(t, c, p)).join('')
              || '<span class="sin-stock">Sin stock</span>'}</div></td>
            <td class="der num">${plata(p.costoC)}</td>
            <td class="der num">${p.margen}%</td>
            <td class="der num" style="font-weight:600">${plata(p.precioC)}${
              p.precios ? '<small class="con-propio" title="Tiene precios propios por forma de cobro">·</small>' : ''}</td>
            <td class="der num" style="color:var(--tinta-2)">${plataCorta(valorStockVenta(p))}</td>
            <td style="color:var(--tinta-2);font-size:13.5px;white-space:nowrap">${esc(p.creadoPor || '—')}</td>
            <td class="der"><button class="btn chico plano" data-editar="${p.id}">Editar</button></td>
          </tr>`).join('')}</tbody>
      </table></div></section>`
    : `<section class="tarjeta">${vacio({
        titulo: ui.busqueda ? 'Sin resultados' : 'Todavía no cargaste productos',
        texto: ui.busqueda
          ? 'Probá con otro nombre o categoría.'
          : 'Pegá el stock desde tu planilla de Excel y en un minuto tenés todo adentro.',
        accion: ui.busqueda ? ''
          : '<button class="btn primario" data-ir="importar">Importar desde Excel</button>'
      })}</section>`;

  const q = $('#q');
  if (q) q.oninput = e => {
    ui.busqueda = e.target.value;
    const pos = e.target.selectionStart;
    vistaProductos();
    const n = $('#q');
    if (n){ n.focus(); n.setSelectionRange(pos, pos); }
  };
}

/* --------------------------------------------------------------------------
   EDITOR
   -------------------------------------------------------------------------- */
export function editorProducto(id){
  const p = id ? datos.productos.find(x => x.id === id) : null;
  const talles = p ? { ...p.talles } : { S: 0, M: 0, L: 0, XL: 0 };
  const categorias = [...new Set(datos.productos.map(x => x.categoria).filter(Boolean))];

  dialogo({
    ancho: true,
    titulo: p ? 'Editar producto' : 'Nuevo producto',
    cuerpo: `
      <div class="editor">

        <section class="editor-col">
          <h4>Datos</h4>
          <label class="campo"><span>Nombre</span>
            <input type="text" id="e-nombre" value="${esc(p ? p.nombre : '')}"
                   placeholder="Remera oversize"></label>
          <label class="campo"><span>Categoría</span>
            <input type="text" id="e-cat" value="${esc(p ? p.categoria : '')}"
                   placeholder="Remeras" list="cats">
            <datalist id="cats">${categorias.map(c => `<option value="${esc(c)}">`).join('')}</datalist>
          </label>
          <div class="rejilla">
            <label class="campo"><span>Costo por unidad</span>
              <input type="text" id="e-costo" inputmode="decimal"
                value="${p ? (p.costoC / 100).toString().replace('.', ',') : ''}" placeholder="8200"></label>
            <label class="campo"><span>Margen de venta</span>
              <input type="number" id="e-margen" value="${p ? p.margen : 120}" min="0" step="5"></label>
          </div>
          <div class="precio-base">
            <span>Precio base, en efectivo</span>
            <b class="num" id="e-precio">—</b>
          </div>

          <h4 style="margin-top:20px">Control de stock</h4>
          <p class="editor-nota">Cada producto tiene el suyo: no se rotan igual
            una remera básica y una campera.</p>
          <div class="rejilla">
            <label class="campo"><span>Avisar cuando quede en</span>
              <input type="number" id="e-umbral"
                value="${p ? umbralDe(p) : UMBRAL_POR_DEFECTO}" min="0" max="99"></label>
            <label class="campo"><span>Reponer hasta</span>
              <input type="number" id="e-reponer"
                value="${p ? reponerHastaDe(p) : REPONER_HASTA_POR_DEFECTO}" min="1" max="999"></label>
          </div>
        </section>

        <section class="editor-col">
          <h4>Stock por talle</h4>
          <div id="e-talles" class="talles-editor"></div>
          <div class="agregar-talle">
            <input type="text" id="e-talle-nuevo" placeholder="Agregar talle (XXL, 46…)">
            <button class="btn chico" id="e-talle-mas">Agregar</button>
          </div>

          <h4 style="margin-top:20px">Precio por forma de cobro</h4>
          <p class="editor-nota">Salen del recargo de Ajustes. Si este producto
            tiene otro precio, escribilo y queda fijo solo para él.</p>
          <div class="precios-lista" id="e-precios"></div>
        </section>

      </div>
      <p class="firma">${p
        ? `Cargado por ${esc(p.creadoPor || 'alguien')}${
            p.creadoEl ? ' el ' + fechaLarga.format(new Date(p.creadoEl)) : ''}${
            p.modificadoPor ? `. Última modificación de ${esc(p.modificadoPor)}` : ''}.`
        : `Se va a guardar a nombre de ${esc(quienOpera())}.`}</p>`,
    pie: `${p ? '<button class="btn riesgo" id="e-borrar" style="margin-right:auto">Eliminar</button>' : ''}
          <button class="btn" data-cerrar>Cancelar</button>
          <button class="btn primario" id="e-guardar">Guardar</button>`,
    alAbrir(){
      const pintarTalles = () => {
        $('#e-talles').innerHTML = Object.entries(talles).map(([t, c]) => `
          <div style="display:flex;gap:8px;align-items:center">
            <span style="flex:none;width:52px;font-weight:600;font-size:14px">${esc(t)}</span>
            <input type="number" data-talle="${esc(t)}" value="${c}" min="0" style="flex:1">
            <button class="btn chico plano" data-quitar-talle="${esc(t)}"
              style="color:var(--tinta-3)">Quitar</button>
          </div>`).join('')
          || '<p style="color:var(--tinta-3);font-size:13.5px;margin:0">Sin talles cargados.</p>';
      };
      pintarTalles();

      /* Precios fijados a mano para este producto, si los tiene. */
      const fijos = Object.assign({}, (p && p.precios) || {});

      const baseActual = () => {
        const c = aCentavos($('#e-costo').value);
        const m = parseFloat($('#e-margen').value) || 0;
        return Math.round(c * (1 + m / 100));
      };

      const pintarPrecios = () => {
        const base = baseActual();
        $('#e-precios').innerHTML = MEDIOS_PAGO.map(med => {
          const fijo = Number(fijos[med.id]);
          const tieneFijo = Number.isFinite(fijo) && fijo > 0;
          const calculado = Math.round(base * (1 + recargoDe(med.id) / 100));
          return `<div class="precios-fila ${tieneFijo ? 'fijado' : ''}">
            <span class="precios-nombre">${esc(med.nombre)}
              <small>${tieneFijo ? 'precio propio'
                : recargoDe(med.id) ? `base +${recargoDe(med.id)}%` : 'igual al base'}</small></span>
            <input type="text" inputmode="decimal" data-precio-de="${med.id}"
              value="${tieneFijo ? (fijo / 100).toString().replace('.', ',') : ''}"
              placeholder="${(calculado / 100).toFixed(2).replace('.', ',')}">
            ${tieneFijo ? `<button class="quitar-fijo" data-soltar-precio="${med.id}"
              type="button">volver al automático</button>` : '<span></span>'}
          </div>`;
        }).join('');
      };

      const recalcular = () => {
        $('#e-precio').textContent = plata(baseActual());
        pintarPrecios();
      };
      recalcular();

      $('#dlg-cuerpo').addEventListener('change', ev => {
        const medio = ev.target.dataset.precioDe;
        if (medio === undefined) return;
        const v = aCentavos(ev.target.value);
        if (v > 0) fijos[medio] = v; else delete fijos[medio];
        pintarPrecios();
      });
      $('#dlg-cuerpo').addEventListener('click', ev => {
        const b = ev.target.closest('[data-soltar-precio]');
        if (!b) return;
        delete fijos[b.dataset.soltarPrecio];
        pintarPrecios();
      });
      $('#e-costo').oninput = recalcular;
      $('#e-margen').oninput = recalcular;

      $('#e-talle-mas').onclick = () => {
        const t = $('#e-talle-nuevo').value.trim().toUpperCase();
        if (!t) return;
        if (talles[t] !== undefined){ avisar('Ese talle ya está', true); return; }
        talles[t] = 0; $('#e-talle-nuevo').value = ''; pintarTalles();
      };
      $('#dlg-cuerpo').addEventListener('click', ev => {
        const q = ev.target.closest('[data-quitar-talle]');
        if (q){ delete talles[q.dataset.quitarTalle]; pintarTalles(); }
      });
      $('#dlg-cuerpo').addEventListener('input', ev => {
        const t = ev.target.dataset.talle;
        if (t !== undefined) talles[t] = Math.max(0, parseInt(ev.target.value) || 0);
      });

      $('#e-guardar').onclick = () => {
        const nombre = $('#e-nombre').value.trim();
        if (!nombre){ avisar('Poné un nombre al producto', true); return; }
        const costoC = aCentavos($('#e-costo').value);
        const margen = parseFloat($('#e-margen').value) || 0;
        const limpios = {};
        Object.entries(talles).forEach(([t, c]) => limpios[t] = Math.max(0, parseInt(c) || 0));

        const limpiarFijos = () => {
          const out = {};
          Object.entries(fijos).forEach(([k, v]) => {
            const n = Number(v);
            if (Number.isFinite(n) && n > 0) out[k] = n;
          });
          return Object.keys(out).length ? out : undefined;
        };

        const umbral = Math.max(0, parseInt($('#e-umbral').value) || 0);
        const reponer = Math.max(1, parseInt($('#e-reponer').value) || 1);

        if (p){
          Object.assign(p, { nombre, categoria: $('#e-cat').value.trim(), costoC, margen,
                             talles: limpios, umbral, reponerHasta: reponer });
          p.precioC = precioDe(p);
          const f = limpiarFijos();
          if (f) p.precios = f; else delete p.precios;
          /* Quién lo cargó no se pisa nunca: se registra aparte quién lo tocó
             por última vez. */
          p.modificadoPor = quienOpera();
          p.modificadoEl  = hoyISO();
        } else {
          const np = { id: nid(), nombre, categoria: $('#e-cat').value.trim(),
                       costoC, margen, talles: limpios, activo: true,
                       umbral, reponerHasta: reponer,
                       creadoPor: quienOpera(), creadoEl: hoyISO() };
          np.precioC = precioDe(np);
          const f = limpiarFijos();
          if (f) np.precios = f;
          datos.productos.push(np);
        }
        guardar(); cerrarDialogo(); bus.pintar();
        avisar(p ? 'Producto actualizado' : 'Producto agregado');
      };

      const borrar = $('#e-borrar');
      if (borrar) borrar.onclick = () => {
        /* No se borra de verdad: se marca inactivo para no romper el historial
           de ventas, que guarda el id del producto. */
        p.activo = false;
        guardar(); cerrarDialogo(); bus.pintar();
        avisar('Producto eliminado');
      };
    }
  });
}

/* --------------------------------------------------------------------------
   INGRESAR PEDIDO
   Se tildan los pedidos que llegaron y su contenido se suma al stock.
   -------------------------------------------------------------------------- */
export function dialogoIngresarPedido(){
  const pendientes = pedidosPorEstado('pendiente');
  if (!pendientes.length){ avisar('No hay pedidos pendientes', true); return; }

  dialogo({
    titulo: 'Ingresar mercadería',
    cuerpo: `
      <p style="margin:0 0 14px;color:var(--tinta-2);font-size:13.5px">
        Tildá los pedidos que llegaron. Lo que traen se suma al stock y quedan
        marcados como recibidos.</p>

      <div class="ing-lista">
        ${pendientes.map(p => `
          <label class="ing-pedido">
            <input type="checkbox" data-pedido="${p.id}">
            <div style="min-width:0;flex:1">
              <div class="ing-titulo">${esc(p.proveedor || 'Sin proveedor')}</div>
              <div class="ing-sub">
                ${fechaLarga.format(new Date(p.fecha))} ·
                ${unidadesPedido(p)} unidades · ${esc(p.usuario || 'alguien')}</div>
              <div class="ing-items">${p.items.map(i =>
                `${i.cant}× ${esc(i.nombre)} (${esc(i.talle)})`).join(' · ')}</div>
            </div>
            <span class="num" style="font-weight:600;white-space:nowrap">${plata(totalPedido(p))}</span>
          </label>`).join('')}
      </div>

      <div id="ing-costos" style="margin-top:14px"></div>`,
    pie: `<button class="btn" data-cerrar>Cancelar</button>
          <button class="btn primario" id="ing-confirmar" disabled>Ingresar</button>`,
    alAbrir(){
      const revisar = () => {
        const ids = $$('[data-pedido]:checked').map(c => c.dataset.pedido);
        $('#ing-confirmar').disabled = ids.length === 0;
        $('#ing-confirmar').textContent = ids.length
          ? `Ingresar ${ids.length}` : 'Ingresar';

        /* Tocar el costo mueve el precio de venta. Se avisa antes, no después. */
        const cambios = cambiosDeCosto(ids);
        $('#ing-costos').innerHTML = cambios.length ? `
          <div class="ing-aviso">
            <label style="display:flex;gap:9px;align-items:flex-start;cursor:pointer">
              <input type="checkbox" id="ing-costos-si" checked style="margin-top:3px">
              <span><b>Actualizar los costos que cambiaron</b><br>
              Esto mueve también el precio de venta, porque sale del margen.</span>
            </label>
            <div class="ing-cambios">
              ${cambios.map(c => `<div>
                <span>${esc(c.nombre)}</span>
                <span class="num">${plata(c.costoViejo)} → ${plata(c.costoNuevo)}
                  <small>(venta ${plata(c.precioViejo)} → ${plata(c.precioNuevo)})</small></span>
              </div>`).join('')}
            </div>
          </div>` : '';
      };

      $('#dlg-cuerpo').addEventListener('change', revisar);
      revisar();

      $('#ing-confirmar').onclick = () => {
        const ids = $$('[data-pedido]:checked').map(c => c.dataset.pedido);
        if (!ids.length) return;
        const actualizarCostos = !$('#ing-costos-si') || $('#ing-costos-si').checked;

        const r = recibirPedidos(ids, { actualizarCostos, usuario: quienOpera() });
        guardar();
        cerrarDialogo();
        bus.pintar();
        avisar(`${r.recibidos} ${r.recibidos === 1 ? 'pedido ingresado' : 'pedidos ingresados'} · ` +
               `${r.unidades} unidades al stock`);
      };
    }
  });
}
