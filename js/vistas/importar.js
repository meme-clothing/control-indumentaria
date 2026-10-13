import { $, esc, plata, aCentavos, nid, avisar } from '../utilidades.js';
import { datos, guardar } from '../almacen.js';
import { precioDe } from '../negocio.js';
import { ui, bus } from '../estado.js';

const EJEMPLO =
`nombre\tcategoria\tcosto\tmargen\tS\tM\tL\tXL
Remera lisa\tRemeras\t8200\t120\t6\t9\t7\t3
Buzo con capucha\tBuzos\t19500\t110\t3\t7\t6\t4`;

/* Excel copia con tabulaciones. Algunos exportadores usan punto y coma. */
const separar = linea =>
  linea.includes('\t') ? linea.split('\t')
  : linea.includes(';') ? linea.split(';')
  : linea.split(',');

const ES_NOMBRE = /^(nombre|producto|descripcion|descripción|articulo|artículo)$/;
const ES_COSTO  = /^(costo|precio de costo|compra)$/;
const ES_CAT    = /^(categoria|categoría|rubro|tipo)$/;
const ES_MARGEN = /^(margen|ganancia|%|porcentaje)$/;

export function vistaImportar(){
  $('#acciones').innerHTML =
    '<button class="btn" data-ir="productos">Volver a productos</button>';
  $('#hoja').innerHTML = `
    <section class="tarjeta" style="margin-bottom:16px">
      <div class="tarjeta-tope"><h3>Pegar desde la planilla</h3></div>
      <div class="tarjeta-cuerpo">
        <div class="modelo">
          Primera fila: los nombres de las columnas. <code>nombre</code> y <code>costo</code> son
          obligatorias; <code>categoria</code> y <code>margen</code> son opcionales.
          <b>Toda otra columna se toma como un talle</b>, así que podés usar S/M/L/XL, 38/40/42,
          o lo que uses vos.
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
  const cabecera = originales.map(c => c.toLowerCase());

  const iNombre = cabecera.findIndex(c => ES_NOMBRE.test(c));
  const iCosto  = cabecera.findIndex(c => ES_COSTO.test(c));
  if (iNombre < 0 || iCosto < 0){
    ui.previo = { error: 'La primera fila tiene que incluir al menos las columnas <b>nombre</b> y <b>costo</b>.' };
    mostrarPrevio();
    return;
  }

  const iCat    = cabecera.findIndex(c => ES_CAT.test(c));
  const iMargen = cabecera.findIndex(c => ES_MARGEN.test(c));
  const conocidas = new Set([iNombre, iCosto, iCat, iMargen].filter(i => i >= 0));
  /* Cualquier columna que no sea una de las conocidas es un talle. */
  const columnasTalle = originales
    .map((c, i) => ({ c, i }))
    .filter(o => !conocidas.has(o.i) && o.c);

  const filas = [];
  lineas.slice(1).forEach((l, n) => {
    const celdas = separar(l);
    const nombre = (celdas[iNombre] || '').trim();
    if (!nombre) return;

    const costoC = aCentavos(celdas[iCosto]);
    const margen = iMargen >= 0
      ? (parseFloat(String(celdas[iMargen] || '').replace('%', '').replace(',', '.')) || 0)
      : 100;

    const talles = {};
    columnasTalle.forEach(o => {
      const v = parseInt(String(celdas[o.i] || '').replace(/\D/g, ''));
      talles[o.c] = isNaN(v) ? 0 : v;
    });

    filas.push({
      nombre,
      categoria: iCat >= 0 ? (celdas[iCat] || '').trim() : '',
      costoC, margen, talles,
      problema: costoC <= 0 ? 'Costo inválido' : null,
      fila: n + 2
    });
  });

  ui.previo = { filas, talles: columnasTalle.map(o => o.c) };
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
        Talles detectados: ${ui.previo.talles.map(esc).join(' · ') || 'ninguno'}</span>
      <button class="btn primario chico" id="confirmar-import" style="margin-left:auto"
        ${buenas.length ? '' : 'disabled'}>Importar ${buenas.length}</button>
    </div>
    <div class="tabla-env"><table class="previo">
      <thead><tr>
        <th>Producto</th><th>Categoría</th><th class="der">Costo</th>
        <th class="der">Margen</th><th class="der">Precio</th>
        ${ui.previo.talles.map(t => `<th class="der">${esc(t)}</th>`).join('')}
      </tr></thead>
      <tbody>${ui.previo.filas.slice(0, 60).map(f => `
        <tr class="${f.problema ? 'fila-mala' : ''}">
          <td>${esc(f.nombre)}${f.problema ? ` <small>· ${esc(f.problema)} (fila ${f.fila})</small>` : ''}</td>
          <td style="color:var(--tinta-2)">${esc(f.categoria) || '—'}</td>
          <td class="der num">${plata(f.costoC)}</td>
          <td class="der num">${f.margen}%</td>
          <td class="der num" style="font-weight:600">${plata(Math.round(f.costoC * (1 + f.margen / 100)))}</td>
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
      existente.precioC = precioDe(existente);
      actualizados++;
    } else {
      const p = { id: nid(), nombre: f.nombre, categoria: f.categoria,
                  costoC: f.costoC, margen: f.margen, talles: { ...f.talles }, activo: true };
      p.precioC = precioDe(p);
      datos.productos.push(p);
      nuevos++;
    }
  });

  guardar();
  ui.previo = null;
  avisar(`${nuevos} productos nuevos · ${actualizados} actualizados`);
  bus.ir('productos');
}
