/* --------------------------------------------------------------------------
   Convierte el fragmento que da la consola de Firebase en un JSON válido.

   La consola muestra JavaScript:

       const firebaseConfig = {
         apiKey: "AIza...",
         projectId: "mi-proyecto"
       };

   y la aplicación necesita JSON: cada nombre de campo entre comillas, sin
   `const`, sin punto y coma y sin comentarios.

   Uso:
     node herramientas/firebase-config.mjs                 (pegás y Ctrl+D)
     node herramientas/firebase-config.mjs pegado.txt
     node herramientas/firebase-config.mjs --verificar     (revisa el actual)
   -------------------------------------------------------------------------- */

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DESTINO = resolve(RAIZ, 'datos', 'firebase.json');
const OBLIGATORIOS = ['apiKey', 'projectId'];
const CONOCIDOS = ['apiKey', 'authDomain', 'projectId', 'storageBucket',
                   'messagingSenderId', 'appId', 'measurementId'];

function extraer(texto){
  let t = texto.trim();

  /* Comentarios de la consola, también los que van al final de una línea.
     El "[^:]" evita comerse el // de https:// dentro de un valor. */
  t = t.replace(/\/\*[\s\S]*?\*\//g, '');
  t = t.replace(/(^|[^:])\/\/.*$/gm, '$1');

  /* No sirve tomar del primer { al último }: el fragmento de la consola
     arranca con `import { initializeApp } from "firebase/app"`, y esa llave
     no tiene nada que ver. Se busca el objeto que contiene apiKey y se
     balancean las llaves desde ahí. */
  const marca = t.search(/["']?apiKey["']?\s*:/);
  if (marca < 0) throw new Error('No encontré apiKey en lo que pegaste. ¿Copiaste el objeto firebaseConfig completo?');

  let abre = t.lastIndexOf('{', marca);
  if (abre < 0) throw new Error('No encontré el { que abre el objeto.');

  let nivel = 0, cierra = -1;
  for (let i = abre; i < t.length; i++){
    if (t[i] === '{') nivel++;
    else if (t[i] === '}'){ nivel--; if (nivel === 0){ cierra = i; break; } }
  }
  if (cierra < 0) throw new Error('El objeto quedó sin cerrar: falta una }.');

  t = t.slice(abre, cierra + 1);

  /* Comillas en los nombres de campo que no las tengan */
  t = t.replace(/([{,]\s*)([A-Za-z_$][\w$]*)\s*:/g, '$1"$2":');
  /* Comillas simples a dobles */
  t = t.replace(/'([^'\\]*)'/g, '"$1"');
  /* Coma de más antes de cerrar */
  t = t.replace(/,(\s*[}\]])/g, '$1');

  return JSON.parse(t);
}

function revisar(config){
  const faltan = OBLIGATORIOS.filter(k => !config[k]);
  if (faltan.length)
    throw new Error(`Faltan campos obligatorios: ${faltan.join(', ')}. ` +
                    'Copiá el objeto firebaseConfig completo desde la consola.');

  const avisos = [];
  if (String(config.apiKey).includes('...') || String(config.apiKey) === 'AIza...')
    avisos.push('La apiKey parece ser el texto de ejemplo, no la real.');
  if (!config.authDomain)
    avisos.push('Falta authDomain. Sin eso el ingreso puede fallar.');
  Object.keys(config).filter(k => !CONOCIDOS.includes(k) && !k.startsWith('_'))
    .forEach(k => avisos.push(`Campo no reconocido: "${k}". ¿Está bien escrito?`));
  return avisos;
}

async function leerEntrada(){
  const arg = process.argv[2];
  if (arg && arg !== '--verificar') return readFile(arg, 'utf8');

  if (process.stdin.isTTY){
    console.log('');
    console.log('  Pegá el fragmento de la consola de Firebase y terminá con Ctrl+D:');
    console.log('');
  }
  const partes = [];
  for await (const c of process.stdin) partes.push(c);
  return Buffer.concat(partes).toString('utf8');
}

/* ---- verificar el archivo que ya existe ---- */
if (process.argv[2] === '--verificar'){
  if (!existsSync(DESTINO)){
    console.error('\n  No existe datos/firebase.json.');
    console.error('  Creálo con: node herramientas/firebase-config.mjs\n');
    process.exit(1);
  }
  const crudo = await readFile(DESTINO, 'utf8');
  try{
    const config = JSON.parse(crudo);
    const avisos = revisar(config);
    console.log('\n  El archivo es JSON válido.');
    console.log('  Proyecto: ' + config.projectId);
    avisos.forEach(a => console.log('  Aviso: ' + a));
    console.log('');
  }catch(e){
    const pareceJS = /\b(const|let|var|export)\b|firebaseConfig/.test(crudo);
    console.error('\n  datos/firebase.json no es JSON válido.');
    if (pareceJS)
      console.error('  Tiene el fragmento de JavaScript de la consola. Convertilo con:\n' +
                    '    node herramientas/firebase-config.mjs datos/firebase.json');
    else
      console.error('  ' + e.message);
    console.error('');
    process.exit(1);
  }
  process.exit(0);
}

/* ---- convertir ---- */
try{
  const entrada = await leerEntrada();
  if (!entrada.trim()) throw new Error('No pegaste nada.');

  const config = extraer(entrada);
  const avisos = revisar(config);

  const salida = {};
  CONOCIDOS.forEach(k => { if (config[k]) salida[k] = config[k]; });

  await writeFile(DESTINO, JSON.stringify(salida, null, 2) + '\n', 'utf8');

  console.log('');
  console.log('  Listo: datos/firebase.json');
  console.log('  Proyecto: ' + salida.projectId);
  avisos.forEach(a => console.log('  Aviso: ' + a));
  console.log('');
  console.log('  Acordate de que este archivo tiene que quedar publicado junto');
  console.log('  al sitio: la aplicación lo pide por fetch. No lo ignores en git.');
  console.log('');
}catch(e){
  console.error('\n  ' + e.message + '\n');
  process.exit(1);
}
