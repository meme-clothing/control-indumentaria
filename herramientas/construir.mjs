/* --------------------------------------------------------------------------
   Arma dist/demo.html: todo el proyecto en un único archivo HTML, con el CSS,
   los módulos y los datos incrustados.

   Para qué sirve: mandarle el prototipo a alguien por mail o por WhatsApp para
   que lo abra con doble clic, sin servidor y sin repositorio. No reemplaza al
   proyecto: no guarda en JSON y el ingreso queda saltado.

   Uso: node herramientas/construir.mjs
   -------------------------------------------------------------------------- */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, '..');
const leer = p => readFile(join(RAIZ, p), 'utf8');

const ORDEN = [
  'js/config.js', 'js/negocios.js', 'js/tema.js', 'js/marca.js',
  'js/utilidades.js', 'js/firebase.js', 'js/almacen.js',
  'js/negocio.js', 'js/auth.js', 'js/estado.js', 'js/componentes.js',
  'js/vistas/panel.js', 'js/vistas/productos.js', 'js/vistas/vender.js',
  'js/vistas/importar.js', 'js/vistas/pedidos.js', 'js/vistas/caja.js',
  'js/vistas/informes.js', 'js/vistas/ajustes.js', 'js/vistas/usuarios.js',
  'js/app.js'
];

/* Se sacan los import/export: al quedar todo en un solo ámbito, sobran. */
const aplanar = txt => txt
  .replace(/^\s*import\s+[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, () => '')
  .replace(/^\s*import\s+['"][^'"]+['"];?\s*$/gm, () => '')
  .replace(/^export\s+(const|let|function|async function|class)/gm, (m, g) => g)
  .replace(/^\s*export\s*\{[^}]*\};?\s*$/gm, () => '');

/* La versión está en dos lados. Si se desincronizan, la pantalla de Ajustes
   miente sobre qué está corriendo. */
const versionConfig = (await leer('js/config.js')).match(/VERSION\s*=\s*'([^']+)'/);
const versionPaquete = JSON.parse(await leer('package.json')).version;
if (versionConfig && versionConfig[1] !== versionPaquete){
  console.error(`\n  La versión no coincide:`);
  console.error(`    js/config.js dice  ${versionConfig[1]}`);
  console.error(`    package.json dice  ${versionPaquete}\n`);
  process.exit(1);
}

const html     = await leer('index.html');
const css      = await leer('css/estilos.css');
const usuarios = await leer('datos/usuarios.json');
const inicial  = await leer('datos/inicial.json');

/* Al aplanar, todos los módulos caen en un mismo ámbito: dos archivos que
   declaren el mismo nombre arriba de todo rompen el archivo con un
   "has already been declared" que solo se ve al abrirlo. Se avisa acá. */
/* Un `import { x as y }` se queda sin el alias al aplanar: el código llamaría
   a `y`, que no existe en ningún lado. Se corta acá antes de generar un
   archivo roto. */
const ALIAS = /^\s*import\s*\{[^}]*\bas\b[^}]*\}\s*from/gm;

const declarado = new Map();
const DECL = /^(?:export\s+)?(?:const|let|var|function|async function|class)\s+([A-Za-z_$][\w$]*)/gm;

let js = '';
for (const p of ORDEN){
  const crudo = await leer(p);

  const conAlias = crudo.match(ALIAS);
  if (conAlias){
    console.error(`\n  Importación con alias en ${p}:`);
    conAlias.forEach(l => console.error('    ' + l.trim()));
    console.error('  Al aplanar se pierde el alias. Usá el nombre original.\n');
    process.exit(1);
  }

  for (const m of crudo.matchAll(DECL)){
    const nombre = m[1];
    if (declarado.has(nombre)){
      console.error(`\n  Nombre repetido: "${nombre}"`);
      console.error(`    ya estaba en ${declarado.get(nombre)}`);
      console.error(`    y vuelve en   ${p}`);
      console.error('  Renombrá uno de los dos: al aplanar chocan.\n');
      process.exit(1);
    }
    declarado.set(nombre, p);
  }
  js += `\n/* ===== ${p} ===== */\n` + aplanar(crudo);
}

/* En un solo archivo no hay fetch que valga: los JSON van incrustados y se
   sirven desde memoria interceptando las tres rutas que usa el programa. */
const puente = `
/* ===== puente de archivo único =====
   Acá no hay servidor ni archivos sueltos: los JSON van incrustados y se
   entregan interceptando las rutas que pide el programa. La respuesta imita
   lo justo de fetch que se usa (ok y json), sin depender de la clase Response,
   que no existe en todos los entornos. */
const ARCHIVOS = {
  'datos/usuarios.json': ${usuarios.trim()},
  'datos/inicial.json': ${inicial.trim()}
};
const respuesta = (cuerpo, ok) => Promise.resolve({
  ok, status: ok ? 200 : 404,
  json: () => Promise.resolve(cuerpo),
  text: () => Promise.resolve(JSON.stringify(cuerpo))
});
const fetchReal = typeof window.fetch === 'function'
  ? window.fetch.bind(window)
  : () => respuesta(null, false);
window.fetch = (url, opciones) => {
  const clave = String(url).replace(/^\\.?\\//, '');
  if (clave === 'api/base') return respuesta(null, false);
  if (ARCHIVOS[clave]) return respuesta(ARCHIVOS[clave], true);
  return fetchReal(url, opciones);
};
`;

/* Ojo: los reemplazos van como función, no como cadena. En una cadena de
   reemplazo, "$$" significa un "$" literal y "$1" un grupo capturado, así que
   el código (que usa $$ para querySelectorAll) saldría corrompido. */
/* En un solo archivo no hay carpeta marca/: el favicon se incrusta como
   data URI y el icono de pantalla de inicio se quita. */
/* En un solo archivo no hay carpeta marca/: todo lo gráfico va incrustado. */
const { readFile: leerBinario } = await import('node:fs/promises');
const comoPNG = async ruta =>
  'data:image/png;base64,' + (await leerBinario(join(RAIZ, ruta))).toString('base64');

const IMAGENES = {
  'marca/favicon-meme.png': await comoPNG('marca/favicon-meme.png'),
  'marca/favicon-kids.png': await comoPNG('marca/favicon-kids.png'),
  'marca/meme.png':         await comoPNG('marca/meme.png'),
  'marca/meme-kids.png':    await comoPNG('marca/meme-kids.png')
};

let salida = html
  .replace(/href="marca\/favicon-meme\.png"/g, () => `href="${IMAGENES['marca/favicon-meme.png']}"`)
  .replace(/<link rel="apple-touch-icon"[^>]*>\n?/, () => '')
  .replace(/<link rel="stylesheet" href="css\/estilos\.css[^"]*">/, () => `<style>\n${css}\n</style>`)
  .replace('<script type="module" src="js/app.js"></script>',
           () => `<script type="module">\n${puente}\n${js}\n</script>`);

/* Las rutas que arma el JavaScript en tiempo de ejecución también se
   reemplazan: el favicon cambia al elegir emprendimiento. */
for (const [ruta, dato] of Object.entries(IMAGENES))
  salida = salida.split(`"${ruta}"`).join(`"${dato}"`);
salida = salida.split("'marca/favicon-' + n + '.png'")
  .join(`(n === 'kids' ? "${IMAGENES['marca/favicon-kids.png']}" : "${IMAGENES['marca/favicon-meme.png']}")`);

await mkdir(join(RAIZ, 'dist'), { recursive: true });
await writeFile(join(RAIZ, 'dist', 'demo.html'), salida, 'utf8');

console.log('Listo: dist/demo.html (' + Math.round(salida.length / 1024) + ' KB)');
