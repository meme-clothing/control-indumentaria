/* --------------------------------------------------------------------------
   Servidor local, sin dependencias. Hace dos cosas:

   1. Sirve los archivos del proyecto (index.html, css, js, datos).
   2. Atiende /api/base:
        GET  → devuelve datos/base.json
        PUT  → lo sobrescribe con lo que manda el navegador

   Con esto la aplicación guarda de verdad en un archivo JSON.
   Sin esto (por ejemplo en GitHub Pages) la aplicación lo detecta sola y
   trabaja contra el almacenamiento del navegador.

   Uso:  node servidor/servidor.mjs
         node servidor/servidor.mjs 8080          (otro puerto)
   -------------------------------------------------------------------------- */

import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, copyFile, access } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI  = dirname(fileURLToPath(import.meta.url));
const RAIZ  = resolve(AQUI, '..');
const NEGOCIOS = ['morta', 'lima'];
const archivoDe = negocio => join(RAIZ, 'datos', `base-${negocio}.json`);
const INICIAL = join(RAIZ, 'datos', 'inicial.json');

const PUERTO = parseInt(process.argv[2]) || 4173;
const LIMITE = 12 * 1024 * 1024;   // 12 MB, de sobra para una base de este tamaño

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.mjs':  'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.webp': 'image/webp',
  '.ico':  'image/x-icon',
  '.woff2':'font/woff2'
};

/* Cada emprendimiento tiene su archivo. La primera vez se copia de la base
   inicial, así la demostración arranca con algo cargado. */
async function asegurarBases(){
  await mkdir(join(RAIZ, 'datos'), { recursive: true });
  for (const n of NEGOCIOS){
    const archivo = archivoDe(n);
    if (existsSync(archivo)) continue;
    if (existsSync(INICIAL)) await copyFile(INICIAL, archivo);
    else await writeFile(archivo, JSON.stringify(
      { version: 1, umbral: 2, reponerHasta: 6,
        productos: [], ventas: [], movimientos: [], pedidos: [] }, null, 2));
    console.log(`Base creada en datos/base-${n}.json`);
  }
}

function json(res, codigo, cuerpo){
  const txt = JSON.stringify(cuerpo);
  res.writeHead(codigo, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(txt),
    'Cache-Control': 'no-store'
  });
  res.end(txt);
}

function leerCuerpo(req){
  return new Promise((ok, mal) => {
    let total = 0;
    const partes = [];
    req.on('data', c => {
      total += c.length;
      if (total > LIMITE){ mal(new Error('demasiado grande')); req.destroy(); return; }
      partes.push(c);
    });
    req.on('end', () => ok(Buffer.concat(partes).toString('utf8')));
    req.on('error', mal);
  });
}

const servidor = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const ruta = decodeURIComponent(url.pathname);

  /* ---- API ---- */
  /* /api/base/<negocio> */
  if (ruta.startsWith('/api/base')){
    const negocio = ruta.slice('/api/base/'.length) || NEGOCIOS[0];
    if (!NEGOCIOS.includes(negocio)){
      json(res, 404, { ok: false, error: 'emprendimiento desconocido: ' + negocio });
      return;
    }
    const BASE = archivoDe(negocio);
    try{
      if (req.method === 'GET'){
        const txt = await readFile(BASE, 'utf8');
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8',
                             'Cache-Control': 'no-store' });
        res.end(txt);
        return;
      }
      if (req.method === 'PUT'){
        const cuerpo = await leerCuerpo(req);
        const d = JSON.parse(cuerpo);            // si no es JSON válido, no se escribe nada
        if (!Array.isArray(d.productos)) throw new Error('formato inesperado');
        /* Escritura atómica: primero a un temporal, después se renombra.
           Si se corta la luz a mitad de camino, base.json queda entero. */
        const temp = BASE + '.tmp';
        await writeFile(temp, JSON.stringify(d, null, 2), 'utf8');
        const { rename } = await import('node:fs/promises');
        await rename(temp, BASE);
        json(res, 200, { ok: true, guardado: new Date().toISOString() });
        return;
      }
      res.writeHead(405).end();
      return;
    }catch(e){
      json(res, 400, { ok: false, error: e.message });
      return;
    }
  }

  /* ---- archivos ---- */
  if (req.method !== 'GET' && req.method !== 'HEAD'){ res.writeHead(405).end(); return; }

  let rel = ruta === '/' ? '/index.html' : ruta;
  const destino = join(RAIZ, normalize(rel).replace(/^(\.\.[/\\])+/, ''));
  if (!destino.startsWith(RAIZ)){ res.writeHead(403).end('Fuera del proyecto'); return; }

  try{
    await access(destino);
    const cuerpo = await readFile(destino);
    res.writeHead(200, {
      'Content-Type': TIPOS[extname(destino).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache'
    });
    res.end(req.method === 'HEAD' ? undefined : cuerpo);
  }catch(e){
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('No se encontró ' + rel);
  }
});

await asegurarBases();
servidor.listen(PUERTO, () => {
  console.log('');
  console.log('  Control de stock andando');
  console.log('  En esta máquina:  http://localhost:' + PUERTO);
  console.log('  Guardando en:     datos/base-<emprendimiento>.json');
  console.log('');
  console.log('  Para entrar desde la tablet, usá la IP de esta máquina en la misma red,');
  console.log('  por ejemplo http://192.168.0.10:' + PUERTO);
  console.log('  Ctrl+C para cortar.');
  console.log('');
});
