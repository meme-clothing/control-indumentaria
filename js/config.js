/* Todo lo que se toca al mover el proyecto de lugar vive acá. */

/* --------------------------------------------------------------------------
   INGRESO POR NOMBRE Y PIN

   La persona escribe un nombre y un PIN. Por debajo eso se traduce a un
   usuario de Firebase Authentication: el nombre se convierte en un correo
   interno y el PIN se estira a una contraseña. Nadie ve un correo nunca.

   El dominio no existe ni recibe mail: Firebase solo pide que el formato sea
   válido. No lo cambies una vez que hay usuarios creados, porque la cuenta
   quedaría colgada.
   -------------------------------------------------------------------------- */
/* --------------------------------------------------------------------------
   MODO ESTRICTO

   En false (desarrollo), si Firebase no responde la aplicación sigue contra el
   servidor local o el navegador. Cómodo para trabajar sin tocar la base real.

   En true (instalación de un cliente), una falla de Firebase corta: muestra el
   motivo y no deja entrar. Es lo que corresponde en producción, porque la
   alternativa es peor de lo que parece: ante una caída, la aplicación caería
   sola al modo prototipo, que valida contra un archivo público y guarda en el
   navegador. La persona vería un sistema que "anda" y estaría cargando ventas
   en un lugar que no es la base del negocio.

   Ponelo en true antes de entregar.
   -------------------------------------------------------------------------- */
export const MODO_ESTRICTO = false;

export const DOMINIO_USUARIOS = 'usuarios.control-stock.local';

/* Largo del PIN. Con 4 dígitos hay 10.000 combinaciones; con 6, un millón.
   Como la clave se prueba contra una API pública, subirlo a 6 multiplica por
   cien el trabajo de adivinarlo y le cuesta dos teclas más a la persona. */
export const LARGO_PIN = 4;

/* Firebase exige contraseñas de 6 caracteres como mínimo, así que el PIN se
   completa con este texto. No es un secreto —viaja en el código, que es
   público— y no agrega seguridad: solo cumple el requisito de formato. */
export const RELLENO_PIN = '::stock::';

/* Cuántos días de ventas y movimientos se traen al abrir. El resto se busca
   solo cuando un informe pide fechas más viejas. Leer todo el historial en
   cada visita es lo que agota la cuota gratuita de lecturas. */
export const VENTANA_DIAS = 90;

/* --------------------------------------------------------------------------
   IDENTIFICACIÓN
   La versión también está en package.json; el script de construcción avisa si
   se desincronizan.
   -------------------------------------------------------------------------- */
export const VERSION = '3.1.0';

export const DESARROLLO = {
  por: 'Migue',
  anio: 2026
};

export const RUTAS = {
  usuarios: 'datos/usuarios.json',   // usuarios y contraseñas (hash)
  inicial:  'datos/inicial.json',    // base de arranque
  api:      'api/base',              // solo existe si corrés servidor/servidor.mjs
  firebase: 'datos/firebase.json'    // credenciales del proyecto; si falta, no se usa Firestore
};

/* Versión del SDK de Firebase que se carga desde la CDN de Google. */
export const SDK = 'https://www.gstatic.com/firebasejs/10.14.1';

export const CLAVE_LOCAL  = 'indumentaria.base.v1';
export const CLAVE_SESION = 'indumentaria.sesion';

/* Cantidad por defecto a partir de la cual un talle se marca como "reponer".
   Después se puede cambiar desde Ajustes y queda guardado en la base. */
export const UMBRAL_POR_DEFECTO = 2;

/* Hasta cuántas unidades por talle apunta a llevar un pedido sugerido.
   El programa sabe QUÉ reponer mirando el stock; cuánto pedir es una decisión
   del negocio, así que es un número configurable desde Ajustes y no una
   constante escondida en el código. */
export const REPONER_HASTA_POR_DEFECTO = 6;

export const ESTADOS_PEDIDO = {
  pendiente: 'Pendiente',
  recibido:  'Recibido',
  cancelado: 'Cancelado'
};

/* Formas de cobro que ofrece la pantalla de venta.
   Para agregar una, sumá una línea acá: aparece sola en el carrito, en la
   caja y en los informes. El `id` es lo que queda guardado en cada venta,
   así que no conviene cambiarlo una vez que hay ventas cargadas. */
export const MEDIOS_PAGO = [
  { id: 'efectivo',     nombre: 'Efectivo' },
  { id: 'transferencia',nombre: 'Transferencia' },
  { id: 'mercadopago',  nombre: 'Mercado Pago' },
  { id: 'debito',       nombre: 'Tarjeta de débito' },
  { id: 'credito',      nombre: 'Tarjeta de crédito' },
  { id: 'otro',         nombre: 'Otro' }
];

export const MEDIO_POR_DEFECTO = 'efectivo';

/* Recargo por forma de cobro, en porcentaje sobre el precio base.
   El precio base del producto es el de efectivo; el resto sale de acá, salvo
   que un producto tenga su propio precio fijado a mano.

   Se configura desde Ajustes y queda guardado con el resto de la base, así que
   esto es solo el punto de partida de una instalación nueva. */
export const RECARGOS_POR_DEFECTO = {
  efectivo: 0,
  transferencia: 0,
  mercadopago: 0,
  debito: 0,
  credito: 0,
  otro: 0
};

export const nombreMedio = id =>
  (MEDIOS_PAGO.find(m => m.id === id) || {}).nombre || 'Sin especificar';
