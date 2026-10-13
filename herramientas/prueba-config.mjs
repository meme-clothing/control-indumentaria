/* Casos que se le pueden pegar al conversor de configuración.
   Uso: node herramientas/prueba-config.mjs */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile, readFile, rm } from 'node:fs/promises';
const correr = promisify(execFile);
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const errores = [];

async function probar(nombre, entrada, espera){
  await writeFile('/tmp/e.txt', entrada, 'utf8');
  try{
    await correr('node', [resolve(RAIZ,'herramientas/firebase-config.mjs'), '/tmp/e.txt']);
    const j = JSON.parse(await readFile(resolve(RAIZ,'datos/firebase.json'),'utf8'));
    if (espera === 'falla') throw new Error('debería haber fallado');
    if (j.projectId !== espera) throw new Error(`projectId "${j.projectId}", esperaba "${espera}"`);
    console.log('  ok  ' + nombre);
  }catch(e){
    if (espera === 'falla'){ console.log('  ok  ' + nombre + ' (rechazado)'); return; }
    console.log('  MAL ' + nombre + ' → ' + (e.stderr || e.message).trim());
    errores.push(nombre);
  }
}

console.log('== conversor de configuración ==');

await probar('fragmento completo de la consola', `
import { initializeApp } from "firebase/app";
const firebaseConfig = {
  apiKey: "AIza-x",
  authDomain: "p1.firebaseapp.com",
  projectId: "p1",
  appId: "1:1:web:1"
};
const app = initializeApp(firebaseConfig);`, 'p1');

await probar('solo el objeto', `{
  apiKey: "AIza-x",
  projectId: "p2"
}`, 'p2');

await probar('ya en JSON válido', `{"apiKey":"AIza-x","projectId":"p3"}`, 'p3');

await probar('con comillas simples', `const c = {
  apiKey: 'AIza-x',
  projectId: 'p4'
};`, 'p4');

await probar('con coma de más', `{
  apiKey: "AIza-x",
  projectId: "p5",
}`, 'p5');

await probar('con comentarios de la consola', `
// Your web app's Firebase configuration
/* varios
   renglones */
const firebaseConfig = {
  apiKey: "AIza-x",   // la clave
  projectId: "p6"
};`, 'p6');

await probar('con measurementId de Analytics', `{
  apiKey: "AIza-x", projectId: "p7", measurementId: "G-ABC123"
}`, 'p7');

await probar('sin apiKey, se rechaza', `{ projectId: "p8" }`, 'falla');
await probar('texto sin objeto, se rechaza', `no pegué nada útil`, 'falla');
await probar('llave sin cerrar, se rechaza', `const c = { apiKey: "x", projectId: "p9"`, 'falla');

console.log('\n' + (errores.length ? 'FALLOS: ' + errores.join(', ') : 'sin errores'));
process.exit(errores.length ? 1 : 0);
