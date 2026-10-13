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


/* Que el pegado interactivo termine solo, sin depender de Ctrl+D ni Ctrl+Z */
console.log('\n== pegado que corta solo ==');
{
  const { spawn } = await import('node:child_process');
  const casos = [
    ['fragmento completo con initializeApp después',
     'import { initializeApp } from "firebase/app";\nconst firebaseConfig = {\n  apiKey: "AIza-x",\n  projectId: "pA"\n};\nconst app = initializeApp(firebaseConfig);\n'],
    ['objeto en una sola línea', '{ apiKey: "AIza-x", projectId: "pB" }\n'],
    ['objeto con llaves anidadas', 'const c = {\n  apiKey: "AIza-x",\n  projectId: "pC",\n  extra: { a: 1 }\n};\n']
  ];
  for (const [nombre, entrada] of casos){
    const salida = await new Promise(ok => {
      const hijo = spawn('node', [resolve(RAIZ,'herramientas/firebase-config.mjs')], { stdio:['pipe','pipe','pipe'] });
      let out=''; hijo.stdout.on('data',d=>out+=d); hijo.stderr.on('data',d=>out+=d);
      const corte = setTimeout(()=>{ hijo.kill(); ok('SE QUEDÓ ESPERANDO'); }, 4000);
      hijo.on('close', ()=>{ clearTimeout(corte); ok(out); });
      hijo.stdin.write(entrada);
      /* a propósito no se cierra la entrada: así se comprueba que corta solo */
    });
    try{
      if (salida.includes('SE QUEDÓ ESPERANDO')) throw new Error('no terminó solo');
      const j = JSON.parse(await readFile(resolve(RAIZ,'datos/firebase.json'),'utf8'));
      if (!j.projectId) throw new Error('no escribió el archivo');
      console.log('  ok  ' + nombre);
    }catch(e){ console.log('  MAL ' + nombre + ' → ' + e.message); errores.push(nombre); }
  }
}
console.log('\n' + (errores.length ? 'FALLOS: ' + errores.join(', ') : 'sin errores'));
process.exit(errores.length ? 1 : 0);
