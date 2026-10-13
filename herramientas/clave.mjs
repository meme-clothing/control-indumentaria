/* Genera el hash SHA-256 para pegar en datos/usuarios.json.
   Uso: node herramientas/clave.mjs 1190 */

import { createHash } from 'node:crypto';

const clave = process.argv[2];

if (!clave){
  console.log('Uso: node herramientas/clave.mjs <contraseña>');
  process.exit(1);
}

const hash = createHash('sha256').update(clave).digest('hex');

console.log('');
console.log('  Contraseña: ' + clave);
console.log('  Hash:       ' + hash);
console.log('');
console.log('  Pegalo en datos/usuarios.json, en el campo "clave" del usuario.');
console.log('');
console.log('  Recordá: esto NO es seguridad. El archivo es público y la');
console.log('  comparación ocurre en el navegador de quien entra.');
console.log('');
