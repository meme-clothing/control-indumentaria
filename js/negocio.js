/* Cálculos puros sobre la base. No tocan el DOM ni guardan nada. */

import { datos } from './almacen.js';
import { UMBRAL_POR_DEFECTO, REPONER_HASTA_POR_DEFECTO } from './config.js';

/* Cada producto define cuándo avisar y hasta cuánto reponer. Los que no lo
   tengan cargado usan el valor por defecto, así una base vieja no queda sin
   avisos de un día para el otro. */
export const umbralDe = p =>
  Number.isFinite(Number(p && p.umbral)) ? Number(p.umbral) : UMBRAL_POR_DEFECTO;

export const reponerHastaDe = p =>
  Number.isFinite(Number(p && p.reponerHasta)) && Number(p.reponerHasta) > 0
    ? Number(p.reponerHasta) : REPONER_HASTA_POR_DEFECTO;

export const precioDe = p => Math.round(p.costoC * (1 + p.margen / 100));
export const stockDe  = p => Object.values(p.talles || {}).reduce((a, b) => a + (b || 0), 0);

export const valorStockCosto = p => stockDe(p) * p.costoC;
export const valorStockVenta = p => stockDe(p) * p.precioC;

export const activos = () => datos.productos.filter(p => p.activo !== false);

/* Los talles que todavía tienen unidades. Las listas de productos y la
   pantalla de venta muestran solo estos: un talle en cero no se puede vender
   y llena la fila de ruido. Para reponerlo está el editor del producto, que
   sigue mostrando todos. */
export function conStock(p){
  return Object.entries(p.talles || {}).filter(([, c]) => c > 0);
}

export function tallesBajos(p){
  const u = umbralDe(p);
  return Object.entries(p.talles || {}).filter(([, c]) => c <= u);
}

export function productosEnAlerta(){
  return activos().filter(p => tallesBajos(p).length > 0);
}

export function buscar(texto){
  const q = (texto || '').trim().toLowerCase();
  let lista = activos();
  if (q) lista = lista.filter(p =>
    (p.nombre + ' ' + (p.categoria || '')).toLowerCase().includes(q));
  return lista.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

/* --------------------------------------------------------------------------
   RANGOS DE FECHA
   -------------------------------------------------------------------------- */
/* Acepta el objeto que guarda la interfaz: { clave, desde, hasta }.
   Caja e informes usan siempre 'personalizado', con desde y hasta a la vista.
   Las claves fijas ('hoy', 'mes'…) las sigue usando el panel, que muestra
   siempre el mes en curso sin darle opción a elegir.
   Las fechas llegan como 'AAAA-MM-DD' de un <input type="date">, así que se
   les pega la hora local a mano: hacerlo con new Date('2026-09-22') las
   interpretaría como UTC y en Argentina se correrían un día para atrás. */
export function rango(r){
  const clave = typeof r === 'string' ? r : (r && r.clave) || 'mes';

  if (clave === 'personalizado'){
    const ini = desdeTexto(r.desde, 0, 0, 0, 0);
    const fin = desdeTexto(r.hasta, 23, 59, 59, 999);
    if (!ini || !fin) return { ini: new Date(0), fin: new Date(), clave };
    /* Si las cargó al revés, se dan vuelta solas en lugar de no mostrar nada. */
    return ini <= fin ? { ini, fin, clave } : { ini: fin, fin: ini, clave, dadoVuelta: true };
  }

  const fin = new Date(); fin.setHours(23, 59, 59, 999);
  const ini = new Date();
  if (clave === 'hoy')        ini.setHours(0, 0, 0, 0);
  else if (clave === '7')   { ini.setDate(ini.getDate() - 6);  ini.setHours(0, 0, 0, 0); }
  else if (clave === '30')  { ini.setDate(ini.getDate() - 29); ini.setHours(0, 0, 0, 0); }
  else if (clave === 'mes') { ini.setDate(1); ini.setHours(0, 0, 0, 0); }
  else return { ini: new Date(0), fin, clave };
  return { ini, fin, clave };
}

function desdeTexto(txt, h, m, s, ms){
  if (!txt || !/^\d{4}-\d{2}-\d{2}$/.test(txt)) return null;
  const [a, me, d] = txt.split('-').map(Number);
  const f = new Date(a, me - 1, d, h, m, s, ms);
  return isNaN(f) ? null : f;
}

/* Cuántos días abarca un rango, para saber cuántas barras dibujar.
   Va con floor y no con round: el fin es a las 23:59:59, así que un rango de
   un solo día mide 0,99 días y round lo subiría a 2. */
export function diasDe(r){
  const uno = 24 * 60 * 60 * 1000;
  return Math.max(1, Math.min(120, Math.floor((r.fin - r.ini) / uno) + 1));
}

const enRango = (iso, r) => { const t = new Date(iso); return t >= r.ini && t <= r.fin; };

/* --------------------------------------------------------------------------
   RESUMEN DE UN PERÍODO
   -------------------------------------------------------------------------- */
export function resumen(r){
  const ventas = datos.ventas.filter(v => enRango(v.fecha, r));
  const movs   = datos.movimientos.filter(m => enRango(m.fecha, r));

  const vendido  = ventas.reduce((a, v) => a + v.totalC, 0);
  const ganancia = ventas.reduce((a, v) => a + v.gananciaC, 0);
  const unidades = ventas.reduce((a, v) => a + v.items.reduce((x, i) => x + i.cant, 0), 0);
  const otrosIng = movs.filter(m => m.tipo === 'ingreso').reduce((a, m) => a + m.montoC, 0);
  const egresos  = movs.filter(m => m.tipo === 'egreso').reduce((a, m) => a + m.montoC, 0);

  return {
    ventas, movs, vendido, ganancia, unidades, otrosIng, egresos,
    ingresos: vendido + otrosIng,
    balance:  vendido + otrosIng - egresos,
    ticket:   ventas.length ? Math.round(vendido / ventas.length) : 0
  };
}

/* Ventas por día, para el gráfico de barras.
   Sin rango, los últimos `dias` días contando hacia atrás desde hoy.
   Con rango, exactamente los días que el rango abarca. */
export function porDia(dias, r){
  const cubos = [];
  const arranque = r ? new Date(r.ini) : new Date();
  if (!r) arranque.setDate(arranque.getDate() - (dias - 1));
  arranque.setHours(0, 0, 0, 0);
  const cuantos = r ? diasDe(r) : dias;

  for (let i = 0; i < cuantos; i++){
    const f = new Date(arranque); f.setDate(f.getDate() + i);
    const k = fechaLocal(f);
    const total = datos.ventas
      .filter(v => fechaLocal(new Date(v.fecha)) === k)
      .reduce((a, v) => a + v.totalC, 0);
    cubos.push({ f, total });
  }
  return cubos;
}

/* 'AAAA-MM-DD' en hora local. No sirve toISOString(): convierte a UTC y en
   Argentina las ventas de la tarde se irían al día siguiente. */
export function fechaLocal(f){
  return f.getFullYear() + '-' +
         String(f.getMonth() + 1).padStart(2, '0') + '-' +
         String(f.getDate()).padStart(2, '0');
}

/* Cuánto entró por cada forma de cobro. */
export function porMedioPago(ventas){
  const mapa = {};
  ventas.forEach(v => {
    const k = v.medioPago || 'otro';
    mapa[k] = mapa[k] || { medio: k, totalC: 0, ventas: 0 };
    mapa[k].totalC += v.totalC;
    mapa[k].ventas += 1;
  });
  return Object.values(mapa).sort((a, b) => b.totalC - a.totalC);
}

/* Cuánto vendió cada persona. */
export function porUsuario(ventas){
  const mapa = {};
  ventas.forEach(v => {
    const k = v.usuario || 'Desconocido';
    mapa[k] = mapa[k] || { usuario: k, totalC: 0, ventas: 0 };
    mapa[k].totalC += v.totalC;
    mapa[k].ventas += 1;
  });
  return Object.values(mapa).sort((a, b) => b.totalC - a.totalC);
}

/* Ranking de productos y de talles dentro de un conjunto de ventas. */
export function ranking(ventas){
  const porProducto = {};
  const porTalle = {};
  ventas.forEach(v => v.items.forEach(i => {
    const k = i.nombre;
    porProducto[k] = porProducto[k] || { nombre: k, unidades: 0, totalC: 0, gananciaC: 0 };
    porProducto[k].unidades  += i.cant;
    porProducto[k].totalC    += i.precioC * i.cant;
    porProducto[k].gananciaC += (i.precioC - i.costoC) * i.cant;
    porTalle[i.talle] = (porTalle[i.talle] || 0) + i.cant;
  }));
  return {
    productos: Object.values(porProducto).sort((a, b) => b.totalC - a.totalC),
    talles: Object.entries(porTalle).sort((a, b) => b[1] - a[1])
  };
}

/* ==========================================================================
   PEDIDOS A PROVEEDOR
   ========================================================================== */

export const pedidosPorEstado = estado =>
  datos.pedidos
    .filter(p => !estado || p.estado === estado)
    .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

export const totalPedido    = p => p.items.reduce((a, i) => a + i.cant * (i.costoC || 0), 0);
export const unidadesPedido = p => p.items.reduce((a, i) => a + i.cant, 0);

/* Cuántas unidades de un talle ya están pedidas y todavía no llegaron.
   Sirve para no volver a pedir lo mismo dos veces. */
export function yaPedido(productoId, talle){
  return datos.pedidos
    .filter(p => p.estado === 'pendiente')
    .reduce((a, p) => a + p.items
      .filter(i => i.productoId === productoId && i.talle === talle)
      .reduce((x, i) => x + i.cant, 0), 0);
}

/* Qué convendría pedir, mirando el stock bajo.
   El programa decide QUÉ; cuánto sale de `reponerHasta`, que se configura en
   Ajustes. Descuenta lo que ya está pedido para no duplicar. */
export function sugerenciasDePedido(){
  const lineas = [];
  activos().forEach(p => {
    const meta = reponerHastaDe(p);
    tallesBajos(p).forEach(([t, c]) => {
      const falta = meta - c - yaPedido(p.id, t);
      if (falta > 0) lineas.push({
        productoId: p.id, nombre: p.nombre, talle: t,
        cant: falta, costoC: p.costoC
      });
    });
  });
  return lineas;
}

/* Qué productos cambiarían de costo al ingresar estos pedidos.
   Se muestra antes de confirmar: tocar el costo mueve el precio de venta, y
   eso no puede pasar sin que la persona lo sepa. */
export function cambiosDeCosto(ids){
  const vistos = new Map();
  ids.forEach(id => {
    const ped = datos.pedidos.find(x => x.id === id);
    if (!ped || ped.estado !== 'pendiente') return;
    ped.items.forEach(i => {
      const p = datos.productos.find(x => x.id === i.productoId);
      if (!p || !i.costoC || i.costoC === p.costoC) return;
      vistos.set(p.id, {
        nombre: p.nombre,
        costoViejo: p.costoC, costoNuevo: i.costoC,
        precioViejo: p.precioC,
        precioNuevo: Math.round(i.costoC * (1 + p.margen / 100))
      });
    });
  });
  return [...vistos.values()];
}

/* Suma al stock lo que traen los pedidos y los marca recibidos.
   `usuario` llega por parámetro: los cálculos no conocen la interfaz. */
export function recibirPedidos(ids, { actualizarCostos, usuario }){
  const cuando = new Date().toISOString();
  let unidades = 0, recibidos = 0;

  ids.forEach(id => {
    const ped = datos.pedidos.find(x => x.id === id);
    if (!ped || ped.estado !== 'pendiente') return;

    ped.items.forEach(i => {
      const p = datos.productos.find(x => x.id === i.productoId);
      if (!p) return;
      p.talles[i.talle] = (p.talles[i.talle] || 0) + i.cant;
      unidades += i.cant;
      if (actualizarCostos && i.costoC && i.costoC !== p.costoC){
        p.costoC = i.costoC;
        p.precioC = precioDe(p);
      }
    });

    ped.estado = 'recibido';
    ped.recibidoEl = cuando;
    ped.recibidoPor = usuario;
    recibidos++;
  });

  return { recibidos, unidades };
}

/* ==========================================================================
   PRECIO SEGÚN LA FORMA DE COBRO

   El `precioC` del producto es el precio base, el de efectivo. Para el resto
   se aplica el recargo configurado en Ajustes, salvo que ese producto tenga
   un precio fijado a mano para esa forma de cobro.

   Está hecho así y no con seis precios cargados producto por producto porque
   un recargo se define una vez y rige para todo el catálogo. Cargar seis
   precios en doscientos productos sería mil doscientos números a mano, y cada
   cambio de lista habría que rehacerlo entero. La excepción existe igual, para
   el producto puntual que no sigue la regla.
   ========================================================================== */

export function recargoDe(medio){
  const v = Number((datos.recargos || {})[medio]);
  return Number.isFinite(v) ? v : 0;
}

/* Precio fijado a mano para ese producto y esa forma de cobro, si lo hay. */
export function precioFijado(p, medio){
  const v = p && p.precios && Number(p.precios[medio]);
  return Number.isFinite(v) && v > 0 ? v : null;
}

export function precioPara(p, medio){
  if (!p) return 0;
  const fijo = precioFijado(p, medio);
  if (fijo !== null) return fijo;
  return Math.round(p.precioC * (1 + recargoDe(medio) / 100));
}

/* Todos los precios de un producto, para mostrarlos juntos. */
export function listaDePrecios(p, medios){
  return medios.map(m => ({
    id: m.id,
    nombre: m.nombre,
    precioC: precioPara(p, m.id),
    fijado: precioFijado(p, m.id) !== null,
    recargo: recargoDe(m.id)
  }));
}
