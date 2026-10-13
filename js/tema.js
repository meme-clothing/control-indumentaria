/* --------------------------------------------------------------------------
   TEMA CLARO Y OSCURO

   La marca tiene dos versiones, negro sobre blanco y blanco sobre negro, así
   que la aplicación tiene dos temas. Todo el cambio ocurre en las variables
   CSS: acá solo se decide cuál está puesto y se recuerda la elección.

   Tres valores posibles: 'claro', 'oscuro' y 'sistema'. Por defecto arranca en
   claro, no en lo que diga el sistema: la mayoría de los equipos de mostrador
   están en oscuro por costumbre del celular, y la aplicación se usa de día,
   con luz. Quien lo prefiera puede poner 'sistema' desde Ajustes.

   El tema se aplica en un script de la cabecera, antes de que se pinte nada.
   Este módulo carga después y solo se ocupa de los botones. Si esperara a
   cargar para aplicarlo, se vería un destello blanco antes de pasar a oscuro.
   -------------------------------------------------------------------------- */

const CLAVE = 'indumentaria.tema';

const consultaOscuro = () =>
  window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

/* Lo que eligió la persona: claro, oscuro o sistema. */
export function preferencia(){
  try{
    const g = localStorage.getItem(CLAVE);
    return (g === 'claro' || g === 'oscuro' || g === 'sistema') ? g : 'claro';
  }catch(e){ return 'claro'; }
}

/* Lo que se está viendo ahora mismo: claro u oscuro. */
export const temaActual = () =>
  document.documentElement.dataset.tema === 'oscuro' ? 'oscuro' : 'claro';

function resolver(pref){
  if (pref === 'sistema'){
    const c = consultaOscuro();
    return c && c.matches ? 'oscuro' : 'claro';
  }
  return pref === 'oscuro' ? 'oscuro' : 'claro';
}

function aplicarAlDocumento(tema){
  document.documentElement.dataset.tema = tema;
  /* El color de la barra del navegador lo pone marca.js al escuchar este
     aviso: depende del negocio, no solo del tema. */
  document.dispatchEvent(new CustomEvent('tema:cambiado', { detail: tema }));
}

export function aplicarTema(pref){
  const p = (pref === 'oscuro' || pref === 'sistema') ? pref : 'claro';
  try{ localStorage.setItem(CLAVE, p); }catch(e){}
  const tema = resolver(p);
  aplicarAlDocumento(tema);
  return tema;
}

/* El botón alterna entre los dos temas visibles. Si estaba en 'sistema', la
   primera pulsación fija lo contrario de lo que se está viendo: es lo que
   espera quien toca un interruptor. */
export const alternarTema = () =>
  aplicarTema(temaActual() === 'oscuro' ? 'claro' : 'oscuro');

/* Con la preferencia en 'sistema', un cambio del sistema operativo se refleja
   sin recargar. */
export function seguirAlSistema(){
  const c = consultaOscuro();
  if (!c || !c.addEventListener) return;
  c.addEventListener('change', () => {
    if (preferencia() === 'sistema') aplicarAlDocumento(resolver('sistema'));
  });
}
