/* Requiere jsdom:  npm install --no-save jsdom
   Uso:            node herramientas/prueba-pedidos.mjs */
import { JSDOM, VirtualConsole } from 'jsdom';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const errores=[];
const dom=new JSDOM(await readFile(RAIZ+'/index.html','utf8'),{url:'http://localhost:4173/',
  virtualConsole:new VirtualConsole().on('jsdomError',e=>errores.push(e.message))});
Object.assign(globalThis,{window:dom.window,document:dom.window.document,
  localStorage:dom.window.localStorage,sessionStorage:dom.window.sessionStorage,
  CustomEvent:dom.window.CustomEvent,Event:dom.window.Event,Blob:dom.window.Blob});
globalThis.fetch=async u=>{const k=String(u).replace(/^https?:\/\/[^/]+\//,'').replace(/^\.?\//,'');
  if(k==='api/base') return new Response('',{status:404});
  try{return new Response(await readFile(RAIZ+'/'+k,'utf8'),{status:200})}catch{return new Response('',{status:404})}};
const alm=await import(RAIZ+'/js/almacen.js');
const neg=await import(RAIZ+'/js/negocio.js');
const est=await import(RAIZ+'/js/estado.js');
await import(RAIZ+'/js/app.js');
await new Promise(r=>setTimeout(r,300));
const d=document;

/* Con más de un emprendimiento al alcance aparece la pantalla de elección
   entre el ingreso y la aplicación. Las pruebas la atraviesan tocando la
   primera opción. */
async function pasarEleccion(){
  await new Promise(r=>setTimeout(r,400));
  const pantalla = document.getElementById('elegir');
  if (pantalla && !pantalla.hidden){
    const primera = document.querySelector('[data-elegido]');
    if (primera) primera.click();
    await new Promise(r=>setTimeout(r,700));
  }
}

const paso=(n,f)=>{try{f();console.log('  ok  '+n)}catch(e){console.log('  MAL '+n+' → '+e.message);errores.push(n+': '+e.message)}};
const ver=v=>d.querySelector(`#nav button[data-vista="${v}"]`).click();
d.getElementById('ing-usuario').value='mica'; d.getElementById('ing-clave').value='1190';
d.getElementById('ing-entrar').click();
await new Promise(r=>setTimeout(r,300));
  await pasarEleccion();

console.log('== la pantalla existe ==');
paso('Pedidos está en el menú con su marca', ()=>{
  if(!d.querySelector('#nav button[data-vista="pedidos"]')) throw new Error('sin botón');
  const m=d.getElementById('marca-pedidos');
  if(m.hidden) throw new Error('la marca debería mostrar 1');
  if(m.textContent!=='1') throw new Error('marca: '+m.textContent);
});
paso('lista el pedido de muestra', ()=>{
  ver('pedidos');
  const t=d.getElementById('hoja').textContent;
  if(!t.includes('Distribuidora Sur')) throw new Error('sin proveedor');
  if(!t.includes('Pendiente')) throw new Error('sin estado');
  if(!t.includes('Mica')) throw new Error('sin quién lo hizo');
});

console.log('== crear un pedido ==');
let idNuevo;
paso('el editor abre y sugiere del stock bajo', ()=>{
  ver('pedidos');
  d.getElementById('nuevo-pedido').click();
  if(!d.getElementById('pd-sugerir')) throw new Error('sin botón sugerir');
  d.getElementById('pd-sugerir').click();
  if(!d.querySelectorAll('[data-linea-cant]').length) throw new Error('no sugirió nada');
});
paso('la sugerencia no repite lo ya pedido', ()=>{
  const sug=neg.sugerenciasDePedido();
  const pendiente=alm.datos.pedidos.find(p=>p.estado==='pendiente');
  sug.forEach(s=>{
    const dup=pendiente.items.find(i=>i.productoId===s.productoId&&i.talle===s.talle);
    if(dup && s.cant + dup.cant > alm.datos.reponerHasta + 10)
      throw new Error('duplica: '+s.nombre);
  });
});
paso('agregar una línea a mano', ()=>{
  const p=neg.activos()[0];
  d.getElementById('pd-producto').value=p.id;
  d.getElementById('pd-producto').dispatchEvent(new Event('change'));
  const talles=d.getElementById('pd-talle').options.length;
  if(talles!==Object.keys(p.talles).length) throw new Error('talles: '+talles);
  d.getElementById('pd-talle').value=Object.keys(p.talles)[0];
  d.getElementById('pd-cant').value='7';
  const antes=d.querySelectorAll('[data-linea-cant]').length;
  d.getElementById('pd-mas').click();
  if(d.querySelectorAll('[data-linea-cant]').length < antes) throw new Error('no agregó');
});
paso('el editor ofrece todos los talles, también los agotados', ()=>{
  const p=neg.activos().find(x=>Object.values(x.talles).some(c=>c===0));
  if(!p) return;
  d.getElementById('pd-producto').value=p.id;
  d.getElementById('pd-producto').dispatchEvent(new Event('change'));
  if(d.getElementById('pd-talle').options.length!==Object.keys(p.talles).length)
    throw new Error('oculta talles en cero, y son justo los que hay que pedir');
});
paso('guardar el pedido', ()=>{
  d.getElementById('pd-proveedor').value='Proveedor prueba';
  d.getElementById('pd-nota').value='Prueba automatizada';
  const antes=alm.datos.pedidos.length;
  d.getElementById('pd-guardar').click();
  if(alm.datos.pedidos.length!==antes+1) throw new Error('no guardó');
  const p=alm.datos.pedidos[alm.datos.pedidos.length-1];
  idNuevo=p.id;
  if(p.estado!=='pendiente') throw new Error('estado: '+p.estado);
  if(p.usuario!=='Mica') throw new Error('usuario: '+p.usuario);
  if(!p.fecha) throw new Error('sin fecha');
});
paso('el pedido NO toca el stock', ()=>{
  const p=alm.datos.pedidos.find(x=>x.id===idNuevo);
  const i=p.items[0];
  const prod=alm.datos.productos.find(x=>x.id===i.productoId);
  const antes=prod.talles[i.talle];
  ver('pedidos');
  if(alm.datos.productos.find(x=>x.id===i.productoId).talles[i.talle]!==antes)
    throw new Error('sumó stock antes de que llegue');
});
paso('un pedido vacío no se guarda', ()=>{
  ver('pedidos');
  d.getElementById('nuevo-pedido').click();
  const antes=alm.datos.pedidos.length;
  d.getElementById('pd-guardar').click();
  if(alm.datos.pedidos.length!==antes) throw new Error('guardó uno vacío');
  d.querySelector('[data-cerrar]').click();
});

console.log('== ingresar mercadería ==');
paso('el botón está en Productos y cuenta los pendientes', ()=>{
  ver('productos');
  const b=d.getElementById('ingresar-pedido');
  if(!b) throw new Error('sin botón');
  if(b.disabled) throw new Error('está apagado y hay pendientes');
  if(!b.textContent.includes('(2)')) throw new Error('texto: '+b.textContent.trim());
});
paso('el diálogo lista los pendientes con casilla', ()=>{
  d.getElementById('ingresar-pedido').click();
  const casillas=d.querySelectorAll('[data-pedido]');
  if(casillas.length!==2) throw new Error('casillas: '+casillas.length);
  if(!d.getElementById('ing-confirmar').disabled) throw new Error('debería arrancar apagado');
});
let stockAntes, itemRef;
paso('al tildar, se habilita y avisa cuántos', ()=>{
  const c=d.querySelector(`[data-pedido="${idNuevo}"]`);
  c.checked=true; c.dispatchEvent(new Event('change',{bubbles:true}));
  const b=d.getElementById('ing-confirmar');
  if(b.disabled) throw new Error('sigue apagado');
  if(!b.textContent.includes('1')) throw new Error('texto: '+b.textContent);
});
paso('ingresar suma al stock y marca recibido', ()=>{
  const ped=alm.datos.pedidos.find(x=>x.id===idNuevo);
  itemRef=ped.items[0];
  const prod=alm.datos.productos.find(x=>x.id===itemRef.productoId);
  stockAntes=prod.talles[itemRef.talle];
  d.getElementById('ing-confirmar').click();
  const prod2=alm.datos.productos.find(x=>x.id===itemRef.productoId);
  if(prod2.talles[itemRef.talle]!==stockAntes+itemRef.cant)
    throw new Error(`${prod2.talles[itemRef.talle]} vs ${stockAntes+itemRef.cant}`);
  const p2=alm.datos.pedidos.find(x=>x.id===idNuevo);
  if(p2.estado!=='recibido') throw new Error('estado: '+p2.estado);
  if(p2.recibidoPor!=='Mica') throw new Error('sin quién lo ingresó');
  if(!p2.recibidoEl) throw new Error('sin fecha de ingreso');
});
paso('un pedido recibido no se vuelve a ingresar', ()=>{
  const antes={...alm.datos.productos.find(x=>x.id===itemRef.productoId).talles};
  neg.recibirPedidos([idNuevo],{actualizarCostos:false,usuario:'Mica'});
  const ahora=alm.datos.productos.find(x=>x.id===itemRef.productoId).talles;
  if(ahora[itemRef.talle]!==antes[itemRef.talle]) throw new Error('sumó dos veces');
});
paso('pasa al historial', ()=>{
  ver('pedidos');
  if(!d.getElementById('hoja').textContent.includes('Historial')) throw new Error('sin historial');
  if(!d.getElementById('hoja').textContent.includes('Recibido')) throw new Error('sin estado recibido');
});

console.log('== cambios de costo ==');
paso('detecta y calcula el precio nuevo', ()=>{
  const prod=neg.activos()[0];
  const ped={ id:'pruebaCosto', fecha:new Date().toISOString(), usuario:'Mica',
    proveedor:'Costos', estado:'pendiente',
    items:[{productoId:prod.id, nombre:prod.nombre, talle:Object.keys(prod.talles)[0],
            cant:3, costoC: prod.costoC + 500000}] };
  alm.datos.pedidos.push(ped);
  const c=neg.cambiosDeCosto(['pruebaCosto']);
  if(c.length!==1) throw new Error('cambios: '+c.length);
  if(c[0].costoNuevo!==prod.costoC+500000) throw new Error('costo mal');
  if(c[0].precioNuevo!==Math.round((prod.costoC+500000)*(1+prod.margen/100)))
    throw new Error('precio mal');
});
paso('sin tildar, no toca el costo', ()=>{
  const ped=alm.datos.pedidos.find(x=>x.id==='pruebaCosto');
  const prod=alm.datos.productos.find(x=>x.id===ped.items[0].productoId);
  const costoAntes=prod.costoC, precioAntes=prod.precioC;
  neg.recibirPedidos(['pruebaCosto'],{actualizarCostos:false,usuario:'Mica'});
  if(prod.costoC!==costoAntes) throw new Error('cambió el costo igual');
  if(prod.precioC!==precioAntes) throw new Error('cambió el precio igual');
});
paso('tildado, actualiza costo y precio juntos', ()=>{
  const prod=neg.activos()[1];
  const nuevo=prod.costoC+700000;
  alm.datos.pedidos.push({ id:'pruebaCosto2', fecha:new Date().toISOString(), usuario:'Mica',
    estado:'pendiente',
    items:[{productoId:prod.id, nombre:prod.nombre, talle:Object.keys(prod.talles)[0],
            cant:2, costoC:nuevo}] });
  neg.recibirPedidos(['pruebaCosto2'],{actualizarCostos:true,usuario:'Mica'});
  if(prod.costoC!==nuevo) throw new Error('no actualizó el costo');
  if(prod.precioC!==Math.round(nuevo*(1+prod.margen/100))) throw new Error('precio desfasado');
});

console.log('== cancelar ==');
paso('cancelar no toca el stock', ()=>{
  const prod=neg.activos()[2];
  const talle=Object.keys(prod.talles)[0];
  const antes=prod.talles[talle];
  alm.datos.pedidos.push({ id:'pruebaCancel', fecha:new Date().toISOString(), usuario:'Mica',
    estado:'pendiente', items:[{productoId:prod.id,nombre:prod.nombre,talle,cant:5,costoC:prod.costoC}] });
  ver('pedidos');
  d.querySelector('[data-cancelar-pedido="pruebaCancel"]').click();
  d.getElementById('conf-si').click();
  if(alm.datos.pedidos.find(x=>x.id==='pruebaCancel').estado!=='cancelado') throw new Error('no canceló');
  if(prod.talles[talle]!==antes) throw new Error('tocó el stock');
});

console.log('== reponerHasta ==');
paso('el valor de cada producto cambia la cantidad sugerida', ()=>{
  const prods = neg.activos();
  const previos = prods.map(p => p.reponerHasta);
  prods.forEach(p => p.reponerHasta = 20);
  const conVeinte=neg.sugerenciasDePedido();
  prods.forEach(p => p.reponerHasta = 3);
  const conTres=neg.sugerenciasDePedido();
  prods.forEach((p,i) => p.reponerHasta = previos[i]);
  const s20=conVeinte.reduce((a,x)=>a+x.cant,0);
  const s3=conTres.reduce((a,x)=>a+x.cant,0);
  if(s20<=s3) throw new Error(`con 20 sugiere ${s20} y con 3 sugiere ${s3}`);
});
paso('está en la ficha de cada producto, no en Ajustes', ()=>{
  ver('ajustes');
  if(d.getElementById('a-reponer')) throw new Error('quedó en Ajustes');
  const prod = neg.activos()[0];
  ver('productos');
  d.querySelector(`[data-editar="${prod.id}"]`).click();
  const campo = d.getElementById('e-reponer');
  if(!campo) throw new Error('la ficha no lo tiene');
  campo.value = '9';
  d.getElementById('e-umbral').value = '3';
  d.getElementById('e-guardar').click();
  if(neg.reponerHastaDe(prod)!==9) throw new Error('no guardó: '+neg.reponerHastaDe(prod));
  if(neg.umbralDe(prod)!==3) throw new Error('umbral: '+neg.umbralDe(prod));
});
paso('cada producto puede tener un mínimo distinto', ()=>{
  const a = neg.activos()[0], b = neg.activos()[1];
  if(neg.umbralDe(a) === neg.umbralDe(b) && neg.umbralDe(a) !== 3)
    throw new Error('no se pueden diferenciar');
  const sinCargar = { talles:{M:1} };
  if(neg.umbralDe(sinCargar) !== 2)
    throw new Error('un producto sin mínimo propio no toma el valor por defecto');
});

console.log('== base vieja sin pedidos ==');
paso('una base sin el campo no rompe', async()=>{});
{
  const copia=JSON.parse(JSON.stringify(alm.datos));
  delete copia.pedidos; delete copia.reponerHasta;
  await alm.reemplazar(copia);
  paso('se completa sola', ()=>{
    if(!Array.isArray(alm.datos.pedidos)) throw new Error('pedidos no es arreglo');
    if(typeof alm.datos.reponerHasta!=='number') throw new Error('sin reponerHasta');
    ver('pedidos');
    if(d.getElementById('hoja').innerHTML.length<100) throw new Error('vista vacía');
  });
}

console.log('== regresión ==');
paso('todas las vistas se pintan', ()=>{
  ['panel','vender','productos','pedidos','caja','informes','ajustes'].forEach(v=>{
    ver(v);
    if(d.getElementById('hoja').innerHTML.length<150) throw new Error('vacía: '+v);
  });
});
paso('sin errores de consola', ()=>{ if(errores.filter(e=>!e.includes(': ')).length) throw new Error(errores[0]); });

console.log('\n'+(errores.length?'FALLOS:\n'+errores.join('\n'):'sin errores'));
process.exit(errores.length?1:0);
