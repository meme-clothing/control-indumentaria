/* --------------------------------------------------------------------------
   AJUSTES

   Tres bloques: cómo está la aplicación, qué se puede configurar, y el
   respaldo. Al final, la firma.
   -------------------------------------------------------------------------- */

import { $, esc, dia, hoyISO, hora, fechaLarga, bajar, avisar, confirmar,
         dialogo, cerrarDialogo } from '../utilidades.js';
import { datos, modo, guardar, comoJSON, reemplazar, volverAlInicial, vaciar,
         cuandoSeGuardo, desdeCuandoHayDatos, negocioActual } from '../almacen.js';
import { productosEnAlerta, pedidosPorEstado, activos, stockDe } from '../negocio.js';
import { disponible, porQueNo } from '../firebase.js';
import { preferencia, aplicarTema } from '../tema.js';
import { negociosPermitidos } from '../auth.js';
import { VERSION, DESARROLLO, MEDIOS_PAGO } from '../config.js';
import { ui, bus } from '../estado.js';

const CLAVE_RESPALDO = 'indumentaria.ultimo-respaldo';

/* Solo para el texto de ejemplo del recargo. */
const ejemplo = c => new Intl.NumberFormat('es-AR',
  { style:'currency', currency:'ARS', minimumFractionDigits:0 }).format(c / 100);

const ultimoRespaldo = () => {
  try{ return localStorage.getItem(CLAVE_RESPALDO); }catch(e){ return null; }
};
const anotarRespaldo = () => {
  try{ localStorage.setItem(CLAVE_RESPALDO, hoyISO()); }catch(e){}
};

const diasDesde = iso => {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso)) / 86400000);
};

export function vistaAjustes(){
  $('#acciones').innerHTML = '';

  const enNube = modo === 'firestore';
  const enServidor = modo === 'servidor';
  const dias = diasDesde(ultimoRespaldo());
  const guardado = cuandoSeGuardo();

  const conexion = enNube
    ? { clase: 'es-ingreso', texto: 'Conectado a la nube' }
    : enServidor
      ? { clase: 'es-ingreso', texto: 'Conectado al servidor' }
      : { clase: 'es-pendiente', texto: 'Solo en este equipo' };

  const detalle = enNube
    ? 'Los datos están en Firestore, detrás de tu usuario. Se ven desde cualquier dispositivo y Google los respalda.'
    : enServidor
      ? 'Hay un servidor escuchando y cada cambio se escribe en datos/base.json.'
      : 'No hay conexión con la base. Todo vive en el almacenamiento de este navegador y no se comparte con otros dispositivos.';

  $('#hoja').innerHTML = `
    <div style="display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(310px,1fr))">

      <section class="tarjeta">
        <div class="tarjeta-tope"><h3>Tu sesión</h3></div>
        <div class="tarjeta-cuerpo">
          <dl class="estado">
            <div><dt>Emprendimiento</dt><dd>${esc(negocioActual().nombre)}</dd></div>
            <div><dt>Usuario</dt><dd>${esc(ui.usuario ? ui.usuario.nombre : '—')}
              ${ui.usuario && ui.usuario.rol === 'admin'
                ? '<span class="pastilla" style="margin-left:6px">admin</span>' : ''}</dd></div>
          </dl>
          <div style="display:flex;gap:9px;flex-wrap:wrap;margin-top:14px">
            ${negociosPermitidos().length > 1
              ? '<button class="btn" id="cambiar-negocio-2">Cambiar de emprendimiento</button>' : ''}
            <button class="btn riesgo" id="salir-2">Cerrar sesión</button>
          </div>
          <p class="firma" style="text-align:left;margin-top:12px">
            Desde el celular la barra lateral se achica a los iconos de abajo, así que
            estas dos acciones viven también acá.</p>
        </div>
      </section>

      <section class="tarjeta">
        <div class="tarjeta-tope"><h3>Estado</h3>
          <span class="pastilla ${conexion.clase}" style="margin-left:auto">${conexion.texto}</span>
        </div>
        <div class="tarjeta-cuerpo">
          <dl class="estado">
            <div><dt>Último guardado</dt>
              <dd id="estado-guardado">${guardado ? hora.format(guardado) : 'sin cambios todavía'}</dd></div>
            <div><dt>Productos</dt>
              <dd>${activos().length} activos ·
                ${activos().reduce((a, p) => a + stockDe(p), 0)} unidades</dd></div>
            <div><dt>Ventas cargadas</dt><dd>${datos.ventas.length}</dd></div>
            <div><dt>Pedidos pendientes</dt><dd>${pedidosPorEstado('pendiente').length}</dd></div>
            <div><dt>Por reponer</dt><dd>${productosEnAlerta().length} productos</dd></div>
            ${enNube && desdeCuandoHayDatos() ? `
              <div><dt>Historial en pantalla</dt>
                <dd>desde el ${fechaLarga.format(new Date(desdeCuandoHayDatos()))}</dd></div>` : ''}
            <div><dt>Último respaldo</dt>
              <dd class="${dias === null || dias > 14 ? 'neg' : ''}">${
                dias === null ? 'nunca' : dias === 0 ? 'hoy' :
                dias === 1 ? 'ayer' : `hace ${dias} días`}</dd></div>
          </dl>
          <p class="firma" style="text-align:left;margin-top:12px">${esc(detalle)}</p>
          ${!disponible() && modo === 'local' ? `
            <p class="error-caja" style="margin-top:11px">${esc(porQueNo())}</p>` : ''}
        </div>
      </section>

      <section class="tarjeta">
        <div class="tarjeta-tope"><h3>Apariencia</h3></div>
        <div class="tarjeta-cuerpo">
          <label class="campo"><span>Tema</span>
            <select id="a-tema">
              <option value="claro"   ${preferencia() === 'claro'   ? 'selected' : ''}>Claro</option>
              <option value="oscuro"  ${preferencia() === 'oscuro'  ? 'selected' : ''}>Oscuro</option>
              <option value="sistema" ${preferencia() === 'sistema' ? 'selected' : ''}>Seguir al sistema</option>
            </select></label>
          <p class="firma" style="text-align:left;margin-top:10px">
            También se cambia con el botón de la barra lateral.</p>
        </div>
      </section>

      <section class="tarjeta">
        <div class="tarjeta-tope"><h3>Recargo por forma de cobro</h3></div>
        <div class="tarjeta-cuerpo">
          <p style="font-size:13.5px;color:var(--tinta-2);margin:0 0 13px;line-height:1.6">
            El precio de cada producto es el de efectivo. Acá se define cuánto más
            cuesta pagar de otra forma, y rige para todo el catálogo. Un producto
            puede tener su propio precio desde su ficha.</p>
          <div class="recargos">
            ${MEDIOS_PAGO.map(m => `<label class="recargo-fila">
              <span>${esc(m.nombre)}</span>
              <span class="recargo-campo">
                <input type="number" data-recargo="${m.id}"
                  value="${Number(datos.recargos[m.id]) || 0}" min="0" max="200" step="1">
                <small>%</small>
              </span>
            </label>`).join('')}
          </div>
          <p class="firma" style="text-align:left;margin-top:12px">
            Por ejemplo: con 10 en tarjeta de crédito, un producto de
            ${esc(ejemplo(100000))} se cobra ${esc(ejemplo(110000))}.</p>
        </div>
      </section>

      <section class="tarjeta">
        <div class="tarjeta-tope"><h3>Respaldo</h3>
          ${dias === null || dias > 14
            ? '<span class="pastilla es-egreso" style="margin-left:auto">conviene hacerlo</span>' : ''}
        </div>
        <div class="tarjeta-cuerpo">
          <p style="font-size:13.5px;color:var(--tinta-2);margin:0 0 13px">
            Copia completa de productos, ventas, movimientos y pedidos, en el mismo
            formato que lee el programa. Guardala en el drive o en el mail.</p>
          <div style="display:flex;gap:9px;flex-wrap:wrap">
            <button class="btn primario" id="a-exportar">Descargar respaldo</button>
            <button class="btn" id="a-importar">Restaurar desde archivo</button>
          </div>
        </div>
      </section>

      <section class="tarjeta">
        <div class="tarjeta-tope"><h3>${enNube ? 'Borrar todo' : 'Datos de demostración'}</h3></div>
        <div class="tarjeta-cuerpo">
          ${enNube ? `
            <p style="font-size:13.5px;color:var(--tinta-2);margin:0 0 13px">
              Estos datos son los del negocio y están en la nube. Vaciarlos borra
              productos, ventas, movimientos y pedidos para todos los dispositivos,
              no solo para este.</p>
            <div style="display:flex;gap:9px;flex-wrap:wrap">
              <button class="btn riesgo" id="a-vaciar">Vaciar todo</button>
            </div>
            <p class="firma" style="text-align:left;margin-top:12px">
              La opción de volver a los datos de demostración no aparece con la base
              en la nube: reemplazaría el negocio real por productos inventados.</p>
          ` : `
            <p style="font-size:13.5px;color:var(--tinta-2);margin:0 0 13px">
              El programa arranca con productos y ventas inventados para mostrar cómo
              se ve en uso. Vaciá todo cuando quieras empezar con el stock real.</p>
            <div style="display:flex;gap:9px;flex-wrap:wrap">
              <button class="btn" id="a-resembrar">Volver a la demostración</button>
              <button class="btn riesgo" id="a-vaciar">Vaciar todo</button>
            </div>
          `}
        </div>
      </section>

      <section class="tarjeta">
        <div class="tarjeta-cuerpo firma-pie">
          <span class="firma-marca">${esc(negocioActual().nombre)} · Control de stock</span>
          <span class="firma-version">Versión ${esc(VERSION)}</span>
          <span class="firma-autor">Desarrollado por ${esc(DESARROLLO.por)} · ${DESARROLLO.anio}</span>
        </div>
      </section>
    </div>`;

  /* El último guardado se refresca solo mientras esta pantalla esté a la vista. */
  document.addEventListener('base:guardada', refrescarGuardado);

  $('#a-tema').onchange = e => {
    aplicarTema(e.target.value);
    avisar('Tema actualizado');
  };

  /* Los recargos mueven el precio de todo el catálogo, así que al cambiarlos
     se repinta la pantalla entera. */
  document.querySelectorAll('[data-recargo]').forEach(campo => {
    campo.onchange = e => {
      const medio = e.target.dataset.recargo;
      const v = Math.max(0, Math.min(200, parseFloat(e.target.value) || 0));
      datos.recargos = Object.assign({}, datos.recargos, { [medio]: v });
      e.target.value = v;
      guardar();
      avisar('Recargo actualizado');
    };
  });

  $('#a-exportar').onclick = () => {
    bajar(`respaldo-${negocioActual().id}-${dia(hoyISO())}.json`, comoJSON(), 'application/json');
    anotarRespaldo();
    avisar('Respaldo descargado');
    bus.pintar();
  };

  $('#a-importar').onclick = restaurar;

  const botonResembrar = $('#a-resembrar');
  if (botonResembrar) botonResembrar.onclick = () => confirmar({
    titulo: 'Volver a la demostración',
    texto: 'Se reemplaza todo lo que haya cargado por los datos de muestra. Descargá un respaldo antes si te importa lo que hay.',
    botón: 'Reemplazar',
    riesgo: true,
    async alConfirmar(){
      try{
        await volverAlInicial();
        ui.carrito = [];
        bus.pintar();
        avisar('Demostración recargada');
      }catch(e){
        avisar('No se pudo leer datos/inicial.json', true);
      }
    }
  });

  /* Con la base en la nube esto borra el negocio para todos los dispositivos.
     Un botón de confirmar se toca sin leer; escribir una palabra, no. */
  $('#a-vaciar').onclick = () => enNube ? vaciarConPalabra() : confirmar({
    titulo: 'Vaciar todo',
    texto: 'Se borran los productos, las ventas y los movimientos. Si todavía no descargaste un respaldo, esto no se puede deshacer.',
    botón: 'Vaciar todo',
    riesgo: true,
    async alConfirmar(){
      await vaciar();
      ui.carrito = [];
      bus.ir('productos');
      avisar('Todo vacío');
    }
  });
}

function refrescarGuardado(){
  const el = $('#estado-guardado');
  if (!el){ document.removeEventListener('base:guardada', refrescarGuardado); return; }
  const g = cuandoSeGuardo();
  if (g) el.textContent = hora.format(g);
}

function restaurar(){
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = '.json,application/json';
  inp.onchange = () => {
    const f = inp.files[0];
    if (!f) return;
    const lector = new FileReader();
    lector.onload = async () => {
      try{
        const d = JSON.parse(lector.result);
        if (!Array.isArray(d.productos)) throw new Error('formato');
        await reemplazar(d);
        ui.carrito = [];
        bus.pintar();
        avisar('Respaldo restaurado');
      }catch(e){
        avisar('El archivo no tiene el formato del respaldo', true);
      }
    };
    lector.readAsText(f);
  };
  inp.click();
}

function vaciarConPalabra(){
  dialogo({
    titulo: 'Vaciar toda la base',
    cuerpo: `
      <p style="margin:0 0 13px;color:var(--tinta-2);line-height:1.6">
        Esto borra <b>${datos.productos.length} productos</b>,
        <b>${datos.ventas.length} ventas</b> y
        <b>${datos.pedidos.length} pedidos</b> de la nube, para todos los
        dispositivos. No se puede deshacer.</p>
      <p style="margin:0 0 13px;color:var(--tinta-2)">
        Descargá un respaldo antes si te importa lo que hay.</p>
      <label class="campo"><span>Escribí BORRAR para confirmar</span>
        <input type="text" id="v-palabra" autocapitalize="characters"
          autocomplete="off" spellcheck="false"></label>`,
    pie: `<button class="btn" data-cerrar>Cancelar</button>
          <button class="btn riesgo" id="v-si" disabled>Vaciar todo</button>`,
    alAbrir(){
      const campo = $('#v-palabra'), boton = $('#v-si');
      campo.oninput = () => boton.disabled = campo.value.trim().toUpperCase() !== 'BORRAR';
      boton.onclick = async () => {
        if (campo.value.trim().toUpperCase() !== 'BORRAR') return;
        cerrarDialogo();
        await vaciar();
        ui.carrito = [];
        bus.ir('productos');
        avisar('Base vaciada');
      };
    }
  });
}
