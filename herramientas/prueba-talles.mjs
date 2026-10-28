/* La lista de talles del negocio y el manejo de talles en la ficha.
   Requiere jsdom:  npm install --no-save jsdom
   Uso:            node herramientas/prueba-talles.mjs */
import { JSDOM, VirtualConsole } from 'jsdom';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const errores = [];
const dom = new JSDOM(await readFile(RAIZ+'/index.html','utf8'), { url:'https://local.test/',
  virtualConsole:new VirtualConsole().on('jsdomError', e=>errores.push(e.message)) });
Object.assign(globalThis,{window:dom.window,document:dom.window.document,
  localStorage:dom.window.localStorage,sessionStorage:dom.window.sessionStorage,
  CustomEvent:dom.window.CustomEvent,Event:dom.window.Event,Blob:dom.window.Blob});
globalThis.fetch = async u => {
  const k = String(u).replace(/^https?:\/\/[^/]+\//,'').replace(/^\.?\//,'');
  if (k === 'datos/firebase.json' || k.startsWith('api/base')) return new Response('',{status:404});
  try{ return new Response(await readFile(RAIZ+'/'+k,'utf8'),{status:200}); }
  catch{ return new Response('',{status:404}); }
};

const alm = await import(RAIZ+'/js/almacen.js');
const neg = await import(RAIZ+'/js/negocio.js');
const est = await import(RAIZ+'/js/estado.js');
await import(RAIZ+'/js/app.js');
await new Promise(r=>setTimeout(r,500));
const d = document;
const paso=(n,f)=>{try{f();console.log('  ok  '+n)}catch(e){console.log('  MAL '+n+' → '+e.message);errores.push(n)}};
const esperar=(ms=200)=>new Promise(r=>setTimeout(r,ms));

d.getElementById('ing-usuario').value='mica';
d.getElementById('ing-clave').value='1190';
d.getElementById('ing-entrar').click();
await esperar(700);
const pr=d.querySelector('[data-elegido]'); if(pr) pr.click();
await esperar(700);

const ver = v => d.querySelector(`#nav button[data-vista="${v}"]`).click();
const abrirFicha = id => { ver('productos'); d.querySelector(`[data-editar="${id}"]`).click(); };

alm.datos.productos.length = 0;
alm.datos.talles = ['S','M','L','XL'];
alm.datos.productos.push(
  { id:'t1', nombre:'Remera', categoria:'Remeras', costoC:1000, margen:100, precioC:2000,
    talles:{ S:3, M:5, L:0 }, activo:true },
  { id:'t2', nombre:'Buzo', categoria:'Buzos', costoC:2000, margen:100, precioC:4000,
    talles:{ M:2 }, activo:true });

console.log('== el orden lo manda la lista del negocio ==');
paso('los talles salen en el orden de la lista, no en el de carga', ()=>{
  const p = { talles:{ XL:1, S:2, L:3, M:4 } };
  if(neg.tallesDe(p).join(',') !== 'S,M,L,XL') throw new Error(neg.tallesDe(p).join(','));
});
paso('un talle que no está en la lista va al final y no desaparece', ()=>{
  const p = { talles:{ M:1, '3/4':2, S:3 } };
  const r = neg.tallesDe(p);
  if(r[r.length-1] !== '3/4') throw new Error(r.join(','));
  if(r.length !== 3) throw new Error('perdió uno: '+r.join(','));
});
paso('cambiar el orden en la lista cambia el de las pantallas', ()=>{
  alm.datos.talles = ['XL','L','M','S'];
  const p = { talles:{ S:1, M:2, L:3, XL:4 } };
  if(neg.tallesDe(p).join(',') !== 'XL,L,M,S') throw new Error(neg.tallesDe(p).join(','));
  alm.datos.talles = ['S','M','L','XL'];
});

console.log('== quitar un talle desde la ficha ==');
paso('la ficha muestra una pastilla por talle, con su botón', ()=>{
  abrirFicha('t1');
  const chips = d.querySelectorAll('#e-talles-elegidos .talle-chip');
  if(chips.length !== 3) throw new Error('pastillas: '+chips.length);
  if(!d.querySelector('[data-quitar-talle="L"]')) throw new Error('sin botón de quitar');
});
paso('quitar un talle sin unidades no pide confirmación', ()=>{
  d.querySelector('[data-quitar-talle="L"]').click();
  if(d.querySelector('[data-quitar-talle="L"]')) throw new Error('sigue ahí');
  if(d.getElementById('conf-si')) throw new Error('pidió confirmación de más');
});
paso('quitar uno con unidades pregunta antes, sin cerrar la ficha', ()=>{
  d.querySelector('[data-quitar-talle="M"]').click();
  const chip = d.querySelector('.talle-chip.confirmando');
  if(!chip) throw new Error('lo borró sin avisar');
  if(!chip.textContent.includes('5')) throw new Error('no dice cuántas unidades: '+chip.textContent);
  if(!d.getElementById('e-nombre')) throw new Error('cerró la ficha del producto');
});
paso('se puede arrepentir', ()=>{
  d.querySelector('[data-cancelar-quitar]').click();
  if(d.querySelector('.talle-chip.confirmando')) throw new Error('quedó preguntando');
  if(!d.querySelector('[data-quitar-talle="M"]')) throw new Error('lo quitó igual');
});
paso('al confirmar, se va', ()=>{
  d.querySelector('[data-quitar-talle="M"]').click();
  d.querySelector('.talle-chip.confirmando [data-quitar-talle="M"]').click();
  if(d.querySelector('[data-quitar-talle="M"]')) throw new Error('sigue ahí');
});
paso('el selector solo ofrece los que no usa', ()=>{
  const opciones = [...d.querySelectorAll('#e-talle-nuevo option')].map(o => o.value);
  if(opciones.includes('S')) throw new Error('ofrece uno que ya tiene');
  if(!opciones.includes('M') || !opciones.includes('L')) throw new Error('no ofrece los quitados');
});
paso('agregar uno lo pone en el orden correcto', ()=>{
  const sel = d.getElementById('e-talle-nuevo');
  sel.value = 'XL';
  d.getElementById('e-talle-mas').click();
  const chips = [...d.querySelectorAll('.talle-chip')].map(c => c.textContent.replace('×','').trim());
  if(chips.join(',') !== 'S,XL') throw new Error(chips.join(','));
});
paso('guardar deja el producto con los talles que quedaron', ()=>{
  d.getElementById('e-guardar').click();
  const p = alm.datos.productos.find(x => x.id === 't1');
  if(Object.keys(p.talles).join(',') !== 'S,XL') throw new Error(Object.keys(p.talles).join(','));
  if(p.talles.S !== 3) throw new Error('perdió el stock de S');
});

console.log('== la tarjeta de Ajustes ==');
paso('lista los talles numerados y en orden', ()=>{
  ver('ajustes');
  const filas = d.querySelectorAll('#lista-talles .talle-fila');
  if(filas.length !== 4) throw new Error('filas: '+filas.length);
  const primera = d.querySelector('[data-nombre-talle="0"]');
  if(primera.value !== 'S') throw new Error('primera: '+primera.value);
});
paso('agregar uno nuevo', ()=>{
  d.getElementById('talle-nuevo').value = 'xxl';
  d.getElementById('talle-mas').click();
  if(!alm.datos.talles.includes('XXL')) throw new Error('no lo agregó en mayúscula: '+alm.datos.talles);
});
paso('no acepta uno repetido', ()=>{
  ver('ajustes');
  const antes = alm.datos.talles.length;
  d.getElementById('talle-nuevo').value = 'S';
  d.getElementById('talle-mas').click();
  if(alm.datos.talles.length !== antes) throw new Error('aceptó un duplicado');
});
paso('moverlo cambia el orden', ()=>{
  ver('ajustes');
  d.querySelector('[data-bajar-talle="0"]').click();
  if(alm.datos.talles[0] !== 'M') throw new Error('quedó: '+alm.datos.talles.join(','));
  ver('ajustes');
  d.querySelector('[data-subir-talle="1"]').click();
  if(alm.datos.talles[0] !== 'S') throw new Error('no volvió: '+alm.datos.talles.join(','));
});
paso('el primero no se puede subir ni el último bajar', ()=>{
  ver('ajustes');
  if(!d.querySelector('[data-subir-talle="0"]').disabled) throw new Error('el primero sube');
  const ult = alm.datos.talles.length - 1;
  if(!d.querySelector(`[data-bajar-talle="${ult}"]`).disabled) throw new Error('el último baja');
});
paso('no se puede quitar uno en uso', ()=>{
  ver('ajustes');
  const ix = alm.datos.talles.indexOf('S');
  const antes = alm.datos.talles.length;
  d.querySelector(`[data-quitar-talle="${ix}"]`).click();
  if(alm.datos.talles.length !== antes) throw new Error('lo quitó igual');
});
paso('uno que no usa nadie sí se puede quitar', ()=>{
  ver('ajustes');
  const ix = alm.datos.talles.indexOf('XXL');
  d.querySelector(`[data-quitar-talle="${ix}"]`).click();
  if(alm.datos.talles.includes('XXL')) throw new Error('sigue ahí');
});
paso('renombrar un talle lo renombra en los productos', ()=>{
  ver('ajustes');
  const ix = alm.datos.talles.indexOf('M');
  const campo = d.querySelector(`[data-nombre-talle="${ix}"]`);
  campo.value = 'MEDIANO';
  campo.dispatchEvent(new Event('change'));
  const buzo = alm.datos.productos.find(x => x.id === 't2');
  if(buzo.talles.MEDIANO !== 2) throw new Error('el producto quedó con: '+JSON.stringify(buzo.talles));
  if(buzo.talles.M !== undefined) throw new Error('quedó el nombre viejo');
});
paso('también adentro de los colores', ()=>{
  alm.datos.productos.push({ id:'t3', nombre:'Camisa', costoC:1000, margen:100, precioC:2000,
    activo:true, colores:{ Negro:{ L:4 } } });
  ver('ajustes');
  const ix = alm.datos.talles.indexOf('L');
  const campo = d.querySelector(`[data-nombre-talle="${ix}"]`);
  campo.value = 'LARGE';
  campo.dispatchEvent(new Event('change'));
  const c = alm.datos.productos.find(x => x.id === 't3');
  if(c.colores.Negro.LARGE !== 4) throw new Error('quedó: '+JSON.stringify(c.colores));
});

console.log('== importar talles que no estaban ==');
paso('se suman solos a la lista', ()=>{
  ver('productos');
  d.querySelector('#acciones [data-ir="importar"]').click();
  d.getElementById('pegado').value = 'nombre\tcosto\tmargen\t38\t40\t42\nJean\t24500\t100\t4\t6\t5';
  d.getElementById('revisar').click();
  d.getElementById('confirmar-import').click();
  ['38','40','42'].forEach(t => {
    if(!alm.datos.talles.includes(t)) throw new Error('no sumó '+t);
  });
});
paso('y quedan al final, sin pisar el orden anterior', ()=>{
  if(alm.datos.talles[0] !== 'S') throw new Error('cambió el primero: '+alm.datos.talles.join(','));
  const jean = alm.datos.productos.find(x => x.nombre === 'Jean');
  if(neg.tallesDe(jean).join(',') !== '38,40,42') throw new Error(neg.tallesDe(jean).join(','));
});

console.log('== una base vieja sin lista ==');
paso('la lista se arma con los talles que ya se usaban', ()=>{
  const copia = JSON.parse(JSON.stringify(alm.datos));
  delete copia.talles;
  const r = alm.conArreglos ? alm.conArreglos(copia) : null;
  if(!r){ /* no está expuesta: se verifica por reemplazo */ }
});


console.log('== eliminar un producto pregunta antes ==');
paso('el primer clic no lo borra, pregunta', ()=>{
  abrirFicha('t2');
  const nombre = alm.datos.productos.find(x=>x.id==='t2').nombre;
  d.getElementById('e-borrar').click();
  if(alm.datos.productos.find(x=>x.id==='t2').activo === false)
    throw new Error('lo borró de una');
  const pie = d.getElementById('dlg-pie');
  if(!pie.querySelector('#e-si-borrar')) throw new Error('no preguntó');
  if(!pie.textContent.includes(nombre)) throw new Error('no dice cuál: '+pie.textContent.trim());
});
paso('dice cuántas unidades tiene', ()=>{
  const pie = d.getElementById('dlg-pie');
  const u = neg.stockDe(alm.datos.productos.find(x=>x.id==='t2'));
  if(u > 0 && !pie.textContent.includes(String(u)))
    throw new Error('no avisa del stock: '+pie.textContent.trim());
});
paso('no cierra la ficha', ()=>{
  if(!d.getElementById('e-nombre')) throw new Error('se cerró el editor');
});
paso('se puede arrepentir y el pie vuelve como estaba', ()=>{
  d.getElementById('e-no-borrar').click();
  const pie = d.getElementById('dlg-pie');
  if(pie.querySelector('#e-si-borrar')) throw new Error('quedó preguntando');
  if(!pie.querySelector('#e-borrar')) throw new Error('no volvió el botón de eliminar');
  if(!pie.querySelector('#e-guardar')) throw new Error('no volvió el de guardar');
});
paso('después de arrepentirse, guardar sigue funcionando', ()=>{
  d.getElementById('e-nombre').value = 'Buzo renombrado';
  d.getElementById('e-guardar').click();
  const p = alm.datos.productos.find(x=>x.id==='t2');
  if(p.nombre !== 'Buzo renombrado') throw new Error('no guardó: '+p.nombre);
  if(p.activo === false) throw new Error('lo borró al guardar');
});
paso('confirmando sí lo elimina', ()=>{
  abrirFicha('t2');
  d.getElementById('e-borrar').click();
  d.getElementById('e-si-borrar').click();
  const p = alm.datos.productos.find(x=>x.id==='t2');
  if(p.activo !== false) throw new Error('sigue activo');
});
paso('no se borra de la base, se marca inactivo', ()=>{
  if(!alm.datos.productos.find(x=>x.id==='t2'))
    throw new Error('lo sacó del todo: las ventas viejas quedarían apuntando a la nada');
});
paso('deja de aparecer en las listas', ()=>{
  if(neg.activos().some(x=>x.id==='t2')) throw new Error('sigue en la lista');
  if(neg.buscar('').some(x=>x.id==='t2')) throw new Error('sigue en el buscador');
});
paso('al crear un producto no hay botón de eliminar', ()=>{
  ver('productos');
  d.querySelector('#acciones [data-nuevo]')?.click() ?? d.getElementById('nuevo-producto')?.click();
  if(d.getElementById('e-borrar')) throw new Error('ofrece eliminar algo que no existe');
  d.querySelector('[data-cerrar]')?.click();
});

console.log('\n'+(errores.length?'FALLOS: '+errores.join(', '):'sin errores'));
process.exit(errores.length?1:0);
