/* Genera datos/inicial.json con productos y ventas de muestra.
   Uso: node herramientas/semilla.mjs
   Volvé a correrlo cuando quieras refrescar la demostración. */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
const salida = resolve(aqui, '..', 'datos', 'inicial.json');

let contador = 0;
const nid = () => 'demo' + (++contador).toString(36).padStart(3, '0');

/* generador con semilla fija: la demo sale igual todas las veces */
let semilla = 20260921;
const azar = () => {
  semilla = (semilla * 1103515245 + 12345) & 0x7fffffff;
  return semilla / 0x7fffffff;
};

const CATALOGO = [
  ['Remera algodón peinado',    'Remeras',    8200, 120, { S: 6, M: 9, L: 7, XL: 3 }],
  ['Remera oversize estampada', 'Remeras',    9600, 130, { S: 4, M: 6, L: 5, XL: 2 }],
  ['Musculosa deportiva',       'Remeras',    7300, 140, { S: 8, M: 9, L: 6, XL: 2 }],
  ['Buzo frisado con capucha',  'Buzos',     19500, 110, { S: 3, M: 7, L: 6, XL: 4 }],
  ['Buzo canguro liso',         'Buzos',     17800, 115, { S: 2, M: 5, L: 4, XL: 1 }],
  ['Jean recto elastizado',     'Pantalones',24500,  95, { 38: 4, 40: 6, 42: 5, 44: 3 }],
  ['Pantalón cargo',            'Pantalones',23800,  98, { 38: 3, 40: 5, 42: 4, 44: 2 }],
  ['Jogging de frisa',          'Pantalones',16200, 105, { S: 5, M: 8, L: 6, XL: 2 }],
  ['Campera rompeviento',       'Camperas',  31000,  90, { S: 2, M: 4, L: 3, XL: 2 }],
  ['Chaleco puffer',            'Camperas',  27600,  95, { S: 1, M: 3, L: 2, XL: 1 }],
  ['Camisa de lino',            'Camisas',   21500, 100, { S: 3, M: 5, L: 4, XL: 1 }],
  ['Short de baño',             'Shorts',    11400, 125, { S: 6, M: 7, L: 5, XL: 3 }]
];

const VENDEDORES = ['Mica'];
const MEDIOS = ['efectivo', 'efectivo', 'efectivo', 'transferencia',
                'mercadopago', 'mercadopago', 'debito', 'credito'];
const MEDIOS_EGRESO = ['transferencia', 'efectivo', 'efectivo', 'transferencia', 'mercadopago'];

const cargadoEl = new Date(hoyBase()); cargadoEl.setDate(cargadoEl.getDate() - 30);

function hoyBase(){ const f = new Date(); f.setHours(0, 0, 0, 0); return f; }

const productos = CATALOGO.map(([nombre, categoria, costo, margen, talles]) => {
  const costoC = costo * 100;
  return {
    id: nid(), nombre, categoria, costoC, margen,
    precioC: Math.round(costoC * (1 + margen / 100)),
    talles: { ...talles }, activo: true,
    creadoPor: VENDEDORES[0],
    creadoEl: cargadoEl.toISOString()
  };
});

/* ventas repartidas en los últimos 24 días, sin domingos */
const ventas = [];
const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
for (let d = 23; d >= 0; d--) {
  const base = new Date(hoy); base.setDate(base.getDate() - d);
  if (base.getDay() === 0) continue;
  const cuantas = 1 + Math.floor(azar() * 4);
  for (let k = 0; k < cuantas; k++) {
    const f = new Date(base);
    f.setHours(10 + Math.floor(azar() * 10), Math.floor(azar() * 60), 0, 0);
    const items = [];
    const cuantos = 1 + Math.floor(azar() * 2);
    for (let j = 0; j < cuantos; j++) {
      const p = productos[Math.floor(azar() * productos.length)];
      const libres = Object.keys(p.talles).filter(t => p.talles[t] > 0);
      if (!libres.length) continue;
      const t = libres[Math.floor(azar() * libres.length)];
      items.push({ productoId: p.id, nombre: p.nombre, talle: t, cant: 1,
                   precioC: p.precioC, costoC: p.costoC });
      p.talles[t] -= 1;
    }
    if (!items.length) continue;
    const totalC = items.reduce((a, i) => a + i.precioC * i.cant, 0);
    const costoC = items.reduce((a, i) => a + i.costoC * i.cant, 0);
    ventas.push({
      id: nid(), fecha: f.toISOString(),
      usuario: VENDEDORES[Math.floor(azar() * VENDEDORES.length)],
      medioPago: MEDIOS[Math.floor(azar() * MEDIOS.length)],
      items, totalC, gananciaC: totalC - costoC
    });
  }
}

const movimientos = [];
const GASTOS = [
  ['Alquiler del local',    420000],
  ['Luz y agua',             68000],
  ['Bolsas y etiquetas',     32000],
  ['Publicidad en redes',    45000],
  ['Flete de mercadería',    54000]
];
GASTOS.forEach(([concepto, monto], i) => {
  const f = new Date(hoy); f.setDate(f.getDate() - (i * 5 + 2)); f.setHours(12, 0, 0, 0);
  movimientos.push({ id: nid(), fecha: f.toISOString(), tipo: 'egreso', concepto,
                     montoC: monto * 100, medioPago: MEDIOS_EGRESO[i % MEDIOS_EGRESO.length],
                     usuario: VENDEDORES[0] });
});
const fIni = new Date(hoy); fIni.setDate(fIni.getDate() - 9); fIni.setHours(9, 0, 0, 0);
movimientos.push({ id: nid(), fecha: fIni.toISOString(), tipo: 'ingreso',
                   concepto: 'Aporte de caja inicial', montoC: 150000 * 100,
                   medioPago: 'efectivo', usuario: VENDEDORES[0] });

/* Un pedido pendiente, para que la pantalla no arranque vacía */
const pedidos = [];
const fPed = new Date(hoyBase()); fPed.setDate(fPed.getDate() - 4); fPed.setHours(11, 0, 0, 0);
const flacos = [];
productos.forEach(p => {
  Object.entries(p.talles).forEach(([t, c]) => {
    if (c <= 2 && flacos.length < 5)
      flacos.push({ productoId: p.id, nombre: p.nombre, talle: t,
                    cant: 6 - c, costoC: p.costoC });
  });
});
if (flacos.length) pedidos.push({
  id: nid(), fecha: fPed.toISOString(), usuario: VENDEDORES[0],
  proveedor: 'Distribuidora Sur', nota: 'Entrega estimada en 10 días',
  estado: 'pendiente', items: flacos
});

mkdirSync(dirname(salida), { recursive: true });
writeFileSync(salida, JSON.stringify({
  version: 1,
  generado: new Date().toISOString(),
  umbral: 2,
  reponerHasta: 6,
  productos, ventas, movimientos, pedidos
}, null, 2), 'utf8');

console.log(`Listo: ${productos.length} productos, ${ventas.length} ventas, ` +
            `${movimientos.length} movimientos, ${pedidos.length} pedidos`);
console.log(salida);
