import { $, esc, plata, aCentavos, nid, avisar } from '../utilidades.js';
import { datos, guardar } from '../almacen.js';
import { precioDe } from '../negocio.js';
import { MEDIOS_PAGO } from '../config.js';
import { ui, bus } from '../estado.js';

const EJEMPLO =
`nombre\tcategoria\tcosto\tmargen\tminimo\tprecio credito\tS\tM\tL\tXL
Remera lisa\tRemeras\t8200\t120\t2\t21000\t6\t9\t7\t3
Buzo con capucha\tBuzos\t19500\t110\t3\t\t3\t7\t6\t4`;

/* Excel copia con tabulaciones. Algunos exportadores usan punto y coma. */
const separar = linea =>
  linea.includes('\t') ? linea.split('\t')
  : linea.includes(';') ? linea.split(';')
  : linea.split(',');

/* Sin acentos, sin guiones bajos y con los espacios normalizados, para que
   "Precio Crédito", "precio_credito" y "PRECIO CREDITO" sean lo mismo. */
const normalizar = t => String(t || '')
  .toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[_\-]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const ES_NOMBRE = /^(nombre|producto|descripcion|articulo)$/;
const ES_COSTO  = /^(costo|precio de costo|compra)$/;
const ES_CAT    = /^(categoria|rubro|tipo)$/;
const ES_MARGEN = /^(margen|ganancia|%|porcentaje)$/;
const ES_PRECIO = /^(precio|precio venta|precio de venta|precio base|venta)$/;
const ES_UMBRAL = /^(minimo|minimo de stock|avisar en|umbral)$/;
const ES_REPONER= /^(reponer|reponer hasta|reposicion)$/;

/* Columnas de precio por forma de cobro. Se aceptan tanto "precio credito"
   como "credito" a secas, y tanto el identificador como el nombre que se
   muestra. Sin esto, una columna de precio terminaría tomada como un talle:
   la aplicación cargaría un talle llamado "credito" con veinte mil unidades
   de stock, que es exactamente lo que no se puede dejar pasar. */
const MEDIO_DE_COLUMNA = (() => {
  const mapa = new Map();
  MEDIOS_PAGO.forEach(m => {
    [m.id, m.nombre].forEach(alias => {
      const a = normalizar(alias);
      mapa.set(a, m.id);
      mapa.set('precio ' + a, m.id);
    });
  });
  /* escrituras habituales que no coinciden con el nombre exacto */
  [['tarjeta','credito'], ['precio tarjeta','credito'],
   ['mercado pago','mercadopago'], ['precio mercado pago','mercadopago'],
   ['mp','mercadopago'], ['precio mp','mercadopago'],
   ['tarjeta de debito','debito'], ['precio tarjeta de debito','debito'],
   ['tarjeta de credito','credito'], ['precio tarjeta de credito','credito'],
   ['transferencia bancaria','transferencia']].forEach(([a, id]) => mapa.set(a, id));
  return mapa;
})();

export function vistaImportar(){
  $('#acciones').innerHTML =
    '<button class="btn" data-ir="productos">Volver a productos</button>';
  $('#hoja').innerHTML = `
    <section class="tarjeta" style="margin-bottom:16px">
      <div class="tarjeta-tope"><h3>Pegar desde la planilla</h3></div>
      <div class="tarjeta-cuerpo">
        <div class="modelo">
          <p style="margin:0 0 7px">Primera fila: los nombres de las columnas.
          Hace falta <code>nombre</code>, y además <code>costo</code> o <code>precio</code>.</p>
          <p style="margin:0 0 7px">Opcionales: <code>categoria</code>,
          <code>margen</code>, <code>minimo</code>, <code>reponer</code>, y un precio por
          forma de cobro: <code>precio efectivo</code>, <code>precio credito</code>,
          <code>precio transferencia</code>, <code>precio debito</code>,
          <code>precio mercadopago</code>.</p>
          <p style="margin:0"><b>Toda otra columna se toma como un talle</b>, así que podés
          usar S/M/L/XL, 38/40/42, o lo que uses vos.</p>
        </div>
        <textarea id="pegado" placeholder="Seleccioná las filas en Excel, copiá con Ctrl+C y pegá acá"></textarea>
        <div style="display:flex;gap:9px;margin-top:12px;flex-wrap:wrap">
          <button class="btn primario" id="revisar">Revisar</button>
          <button class="btn" id="usar-ejemplo">Usar un ejemplo</button>
          <button class="btn plano" id="limpiar-pegado">Limpiar</button>
        </div>
      </div>
    </section>
    <div id="previo"></div>`;

  $('#usar-ejemplo').onclick   = () => { $('#pegado').value = EJEMPLO; revisarPegado(); };
  $('#limpiar-pegado').onclick = () => { $('#pegado').value = ''; ui.previo = null; $('#previo').innerHTML = ''; };
  $('#revisar').onclick        = revisarPegado;

  if (ui.previo) mostrarPrevio();
}

export function revisarPegado(){
  const crudo = $('#pegado').value.trim();
  if (!crudo){ avisar('Pegá primero las filas de la planilla', true); return; }

  const lineas = crudo.split(/\r?\n/).filter(l => l.trim());
  const originales = separar(lineas[0]).map(c => c.trim());
  const cabecera = originales.map(normalizar);

  const iNombre = cabecera.findIndex(c => ES_NOMBRE.test(c));
  const iCosto  = cabecera.findIndex(c => ES_COSTO.test(c));
  const iPrecio = cabecera.findIndex(c => ES_PRECIO.test(c));

  /* Hace falta el nombre, y después costo o precio: con uno de los dos y el
     margen se deduce el otro. */
  if (iNombre < 0 || (iCosto < 0 && iPrecio < 0)){
    ui.previo = { error: 'La primera fila tiene que incluir <b>nombre</b>, y además <b>costo</b> o <b>precio</b>.' };
    mostrarPrevio();
    return;
  }

  const iCat     = cabecera.findIndex(c => ES_CAT.test(c));
  const iMargen  = cabecera.findIndex(c => ES_MARGEN.test(c));
  const iUmbral  = cabecera.findIndex(c => ES_UMBRAL.test(c));
  const iReponer = cabecera.findIndex(c => ES_REPONER.test(c));

  /* Columnas de precio por forma de cobro */
  const columnasPrecio = [];
  cabecera.forEach((c, i) => {
    const medio = MEDIO_DE_COLUMNA.get(c);
    if (medio && i !== iPrecio) columnasPrecio.push({ i, medio, titulo: originales[i] });
  });

  const conocidas = new Set([iNombre, iCosto, iCat, iMargen, iPrecio, iUmbral, iReponer]
    .filter(i => i >= 0)
    .concat(columnasPrecio.map(o => o.i)));

  /* Recién ahora, lo que sobra son talles. */
  const columnasTalle = originales
    .map((c, i) => ({ c, i }))
    .filter(o => !conocidas.has(o.i) && o.c);

  const filas = [];
  lineas.slice(1).forEach((l, n) => {
    const celdas = separar(l);
    const nombre = (celdas[iNombre] || '').trim();
    if (!nombre) return;

    const costoLeido  = iCosto  >= 0 ? aCentavos(celdas[iCosto])  : 0;
    const precioLeido = iPrecio >= 0 ? aCentavos(celdas[iPrecio]) : 0;
    const margenLeido = iMargen >= 0
      ? (parseFloat(String(celdas[iMargen] || '').replace('%', '').replace(',', '.')) || 0)
      : null;

    /* Tres formas de dar el precio, en este orden:
       1. costo + precio  → el margen sale de la división
       2. costo + margen  → el precio sale de la multiplicación
       3. solo precio     → no hay costo, así que tampoco hay ganancia real */
    let costoC = costoLeido, margen = margenLeido ?? 100, precioC = 0;
    if (costoLeido > 0 && precioLeido > 0){
      margen = Math.round((precioLeido / costoLeido - 1) * 1000) / 10;
      precioC = precioLeido;
    } else if (costoLeido > 0){
      precioC = Math.round(costoLeido * (1 + margen / 100));
    } else {
      precioC = precioLeido;
      costoC = 0;
      margen = 0;
    }

    const talles = {};
    columnasTalle.forEach(o => {
      const v = parseInt(String(celdas[o.i] || '').replace(/\D/g, ''));
      talles[o.c] = isNaN(v) ? 0 : v;
    });

    const precios = {};
    columnasPrecio.forEach(o => {
      const v = aCentavos(celdas[o.i]);
      if (v > 0) precios[o.medio] = v;
    });

    const entero = (ix, minimo) => {
      if (ix < 0) return undefined;
      const v = parseInt(String(celdas[ix] || '').replace(/\D/g, ''));
      return isNaN(v) ? undefined : Math.max(minimo, v);
    };

    filas.push({
      nombre,
      categoria: iCat >= 0 ? (celdas[iCat] || '').trim() : '',
      costoC, margen, precioC, talles,
      precios: Object.keys(precios).length ? precios : undefined,
      umbral: entero(iUmbral, 0),
      reponerHasta: entero(iReponer, 1),
      problema: precioC <= 0 ? 'Sin costo ni precio válidos' : null,
      fila: n + 2
    });
  });

  ui.previo = {
    filas,
    talles: columnasTalle.map(o => o.c),
    precios: columnasPrecio.map(o => ({ medio: o.medio, titulo: o.titulo })),
    traeCosto: iCosto >= 0,
    traeMinimos: iUmbral >= 0 || iReponer >= 0
  };
  mostrarPrevio();
}

function mostrarPrevio(){
  const cont = $('#previo');
  if (!cont) return;

  if (ui.previo.error){
    cont.innerHTML = `<section class="tarjeta"><div class="vacio">
      <h3>No se puede leer así</h3><p>${ui.previo.error}</p>
      <p style="font-size:13px;color:var(--tinta-3)">Probá el botón “Usar un ejemplo” para ver el formato.</p>
    </div></section>`;
    return;
  }

  const buenas = ui.previo.filas.filter(f => !f.problema);

  cont.innerHTML = `<section class="tarjeta">
    <div class="tarjeta-tope">
      <h3>${buenas.length} ${buenas.length === 1 ? 'producto listo' : 'productos listos'}</h3>
      <span style="font-size:13px;color:var(--tinta-2)">
        Talles: ${ui.previo.talles.map(esc).join(' · ') || 'ninguno'}${
          ui.previo.precios.length
            ? ` · Precios: ${ui.previo.precios.map(x => esc(x.titulo)).join(' · ')}` : ''}${
          ui.previo.traeMinimos ? ' · con mínimos de stock' : ''}</span>
      <button class="btn primario chico" id="confirmar-import" style="margin-left:auto"
        ${buenas.length ? '' : 'disabled'}>Importar ${buenas.length}</button>
    </div>
    <div class="tabla-env"><table class="previo">
      <thead><tr>
        <th>Producto</th><th>Categoría</th><th class="der">Costo</th>
        <th class="der">Margen</th><th class="der">Precio</th>
        ${ui.previo.precios.map(x => `<th class="der">${esc(x.titulo)}</th>`).join('')}
        ${ui.previo.talles.map(t => `<th class="der">${esc(t)}</th>`).join('')}
      </tr></thead>
      <tbody>${ui.previo.filas.slice(0, 60).map(f => `
        <tr class="${f.problema ? 'fila-mala' : ''}">
          <td>${esc(f.nombre)}${f.problema ? ` <small>· ${esc(f.problema)} (fila ${f.fila})</small>` : ''}</td>
          <td style="color:var(--tinta-2)">${esc(f.categoria) || '—'}</td>
          <td class="der num">${plata(f.costoC)}</td>
          <td class="der num">${f.costoC ? f.margen + '%' : '—'}</td>
          <td class="der num" style="font-weight:600">${plata(f.precioC)}</td>
          ${ui.previo.precios.map(x => `<td class="der num">${
            f.precios && f.precios[x.medio] ? plata(f.precios[x.medio]) : '—'}</td>`).join('')}
          ${ui.previo.talles.map(t => `<td class="der num">${f.talles[t] ?? 0}</td>`).join('')}
        </tr>`).join('')}</tbody>
    </table></div>
    ${ui.previo.filas.length > 60 ? `<div style="padding:11px 16px;font-size:13px;color:var(--tinta-3)">
      Se muestran 60 de ${ui.previo.filas.length} filas.</div>` : ''}
  </section>`;

  const btn = $('#confirmar-import');
  if (btn) btn.onclick = () => aplicarImportacion(buenas);
}

function aplicarImportacion(buenas){
  let nuevos = 0, actualizados = 0;

  buenas.forEach(f => {
    const existente = datos.productos.find(p =>
      p.activo !== false && p.nombre.toLowerCase() === f.nombre.toLowerCase());

    if (existente){
      /* El stock se suma: importar dos veces la misma remesa no la pisa, la acumula. */
      Object.entries(f.talles).forEach(([t, c]) =>
        existente.talles[t] = (existente.talles[t] || 0) + c);
      existente.costoC = f.costoC;
      existente.margen = f.margen;
      existente.precioC = f.precioC;
      if (f.precios) existente.precios = { ...f.precios };
      if (f.umbral !== undefined) existente.umbral = f.umbral;
      if (f.reponerHasta !== undefined) existente.reponerHasta = f.reponerHasta;
      actualizados++;
    } else {
      const p = { id: nid(), nombre: f.nombre, categoria: f.categoria,
                  costoC: f.costoC, margen: f.margen, precioC: f.precioC,
                  talles: { ...f.talles }, activo: true };
      if (f.precios) p.precios = { ...f.precios };
      if (f.umbral !== undefined) p.umbral = f.umbral;
      if (f.reponerHasta !== undefined) p.reponerHasta = f.reponerHasta;
      datos.productos.push(p);
      nuevos++;
    }
  });

  guardar();
  ui.previo = null;
  avisar(`${nuevos} productos nuevos · ${actualizados} actualizados`);
  bus.ir('productos');
}
