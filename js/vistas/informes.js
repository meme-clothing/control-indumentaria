import { $, esc, plata, plataCorta, fechaLarga, hora, dia, bajar, aCSV, avisar }
  from '../utilidades.js';
import { rango, resumen, ranking, diasDe, porMedioPago, porUsuario } from '../negocio.js';
import { cifra, selectorRango, grafico, vacio } from '../componentes.js';
import { nombreMedio } from '../config.js';
import { ui } from '../estado.js';

export function vistaInformes(){
  const r = rango(ui.rangoInforme);
  const s = resumen(r);
  const { productos, talles } = ranking(s.ventas);
  const topTalle = talles.length ? talles[0][1] : 1;
  const medios = porMedioPago(s.ventas);
  const usuarios = porUsuario(s.ventas);
  const topMedio = medios.length ? medios[0].totalC : 1;

  $('#subtitulo').textContent =
    `Del ${fechaLarga.format(r.ini)} al ${fechaLarga.format(r.fin)}` +
    (r.dadoVuelta ? ' · las fechas estaban al revés, las di vuelta' : '');

  $('#acciones').innerHTML = `
    ${selectorRango(ui.rangoInforme, 'data-rango-informe')}
    <button class="btn" id="bajar-csv">Descargar CSV</button>`;

  $('#hoja').innerHTML = `
    <dl class="cifras">
      ${cifra({ titulo:'Vendido', valor: plataCorta(s.vendido), acento: true,
                pie:`${s.ventas.length} ventas` })}
      ${cifra({ titulo:'Ganancia', valor: plataCorta(s.ganancia), tono:'pos',
                pie:`${s.vendido ? Math.round(s.ganancia / s.vendido * 100) : 0}% de margen real` })}
      ${cifra({ titulo:'Productos vendidos', valor: s.unidades,
                pie:`${s.ventas.length ? (s.unidades / s.ventas.length).toFixed(1) : 0} por venta` })}
      ${cifra({ titulo:'Venta promedio', valor: plataCorta(s.ticket), pie:'por operación' })}
    </dl>

    <div style="display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));
                margin-bottom:16px">
      <section class="tarjeta">
        <div class="tarjeta-tope"><h3>Cómo te pagaron</h3></div>
        <div class="tarjeta-cuerpo">
          ${medios.length ? medios.map(m => `
            <div class="barra-fila">
              <span class="barra-nombre">${esc(nombreMedio(m.medio))}</span>
              <div class="barra-riel">
                <div class="barra-relleno" style="width:${Math.round(m.totalC / topMedio * 100)}%"></div>
              </div>
              <span class="barra-valor num">${plataCorta(m.totalC)}</span>
            </div>
            <div class="barra-pie">${m.ventas} ${m.ventas === 1 ? 'venta' : 'ventas'} ·
              ${s.vendido ? Math.round(m.totalC / s.vendido * 100) : 0}% del total</div>`).join('')
            : '<p style="color:var(--tinta-3);margin:0">Sin ventas en el período.</p>'}
        </div>
      </section>

      <section class="tarjeta">
        <div class="tarjeta-tope"><h3>Talles que más salen</h3></div>
        <div class="tarjeta-cuerpo">
          ${talles.length ? talles.map(([t, c]) => `
            <div class="barra-fila">
              <span class="barra-nombre">${esc(t)}</span>
              <div class="barra-riel">
                <div class="barra-relleno" style="width:${Math.round(c / topTalle * 100)}%"></div>
              </div>
              <span class="barra-valor num">${c}</span>
            </div>`).join('')
            : '<p style="color:var(--tinta-3);margin:0">Sin datos todavía.</p>'}
        </div>
      </section>
    </div>

    <div style="display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));
                margin-bottom:16px">
      <section class="tarjeta">
        <div class="tarjeta-tope"><h3>Lo que más se vendió</h3></div>
        ${productos.length ? `<div class="tabla-env"><table>
          <thead><tr><th>Producto</th><th class="der">Unid.</th>
            <th class="der">Vendido</th><th class="der">Ganancia</th></tr></thead>
          <tbody>${productos.slice(0, 12).map(p => `
            <tr><td class="prod-nombre">${esc(p.nombre)}</td>
              <td class="der num">${p.unidades}</td>
              <td class="der num">${plata(p.totalC)}</td>
              <td class="der num pos">${plata(p.gananciaC)}</td></tr>`).join('')}</tbody>
        </table></div>` : vacio({ titulo:'Sin ventas en el período',
                                  texto:'Probá con un rango más amplio.' })}
      </section>

      ${usuarios.length > 1 ? `
      <section class="tarjeta">
        <div class="tarjeta-tope"><h3>Quién vendió</h3></div>
        <div class="tabla-env"><table>
          <thead><tr><th>Persona</th><th class="der">Ventas</th><th class="der">Vendido</th></tr></thead>
          <tbody>${usuarios.map(u => `
            <tr><td class="prod-nombre">${esc(u.usuario)}</td>
              <td class="der num">${u.ventas}</td>
              <td class="der num">${plata(u.totalC)}</td></tr>`).join('')}</tbody>
        </table></div>
      </section>` : ''}
    </div>

    <section class="tarjeta">
      <div class="tarjeta-tope"><h3>Ventas por día</h3></div>
      <div class="tarjeta-cuerpo">${grafico(diasDe(r), r)}</div>
    </section>`;

  $('#bajar-csv').onclick = () => descargarCSV(s, r);
}

function descargarCSV(s, r){
  const filas = [['Fecha', 'Hora', 'Vendedor', 'Forma de cobro', 'Producto', 'Talle',
                  'Cantidad', 'Precio unitario', 'Total', 'Ganancia']];
  s.ventas
    .slice()
    .sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
    .forEach(v => v.items.forEach(i => filas.push([
      dia(v.fecha), hora.format(new Date(v.fecha)),
      v.usuario || '', nombreMedio(v.medioPago),
      i.nombre, i.talle, i.cant,
      (i.precioC / 100).toFixed(2),
      (i.precioC * i.cant / 100).toFixed(2),
      ((i.precioC - i.costoC) * i.cant / 100).toFixed(2)
    ])));

  bajar(`ventas-${ui.rangoInforme.desde}-a-${ui.rangoInforme.hasta}.csv`,
        aCSV(filas), 'text/csv;charset=utf-8');
  avisar('CSV descargado');
}
