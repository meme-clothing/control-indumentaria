# Memé — control de stock y caja

**Versión 3.0** — una instalación atiende los dos emprendimientos, Memé y
Memé Kids, con los datos separados. Para la puesta en marcha, `INSTALACION.md`.

Sistema de control interno para un local de ropa: stock por talle, registro de
ventas con forma de cobro, ingresos, egresos y balance. Vanilla JavaScript, sin
dependencias, sin compilación.

No es un sistema de venta online ni de facturación. No emite comprobantes
fiscales.

---

## Arrancar

```bash
node servidor/servidor.mjs
```

Y abrir `http://localhost:4173`.

Usuario `mica`, contraseña `1190`.

Para que lo use la tablet contra una notebook en el local, hay que entrar por la
IP de la notebook en la misma red, por ejemplo `http://192.168.0.10:4173`.

> **No abras `index.html` con doble clic.** El navegador bloquea los módulos
> JavaScript y la lectura de archivos en `file://`, así que la página queda en
> blanco. Hace falta servirla, aunque sea con `npx serve`.

---

## Los dos modos de guardado

Esto es lo primero que conviene entender, porque cambia dónde terminan los datos.

Una web estática no puede escribir en un archivo del servidor: el navegador
puede leer `datos/inicial.json` con `fetch`, pero no tiene ninguna forma de
sobrescribirlo. Por eso hay dos modos, y la aplicación elige solo cuál usar al
arrancar.

| | **Modo servidor** | **Modo navegador** |
|---|---|---|
| Cuándo | Corriendo `servidor/servidor.mjs` | GitHub Pages, o cualquier hosting estático |
| Guarda en | `datos/base.json` | Almacenamiento del navegador |
| Se comparte entre dispositivos | Sí, contra el mismo servidor | No, cada equipo tiene lo suyo |
| Respaldo | El archivo mismo | Botón "Descargar respaldo" en Ajustes |

En Ajustes hay una tarjeta que dice en cuál de los dos está funcionando en ese
momento, para no adivinar.

En modo navegador, para conservar los cambios hay que descargar el respaldo
desde Ajustes y reemplazar `datos/inicial.json` en el repositorio.

---

## Estructura

```
index.html              La página. Solo el armazón; el contenido lo dibuja el JS.
css/estilos.css         Todos los estilos. La paleta está en :root, arriba de todo.

js/
  config.js             Rutas y claves de almacenamiento.
  utilidades.js         DOM, formato de plata y fechas, avisos, diálogos.
  almacen.js            Acceso a datos. Lo único que se reescribe al pasar a Firestore.
  negocio.js            Cálculos: precios, stock, rangos, resúmenes. Sin DOM.
  auth.js               Ingreso de prototipo.
  estado.js             Lo que la interfaz recuerda mientras se usa.
  componentes.js        Trozos de HTML compartidos entre vistas.
  vistas/               Una por pantalla: panel, productos, vender, importar,
                        pedidos, caja, informes, ajustes.
  app.js                Router, eventos y arranque.

datos/
  usuarios.json         Usuario y hash de la contraseña.
  inicial.json          Base de arranque, versionada en el repositorio.
  base.json             Base de trabajo. NO se versiona (está en .gitignore).

servidor/servidor.mjs   Servidor local que persiste la base. Sin dependencias.

herramientas/
  semilla.mjs           Regenera datos/inicial.json con datos de muestra.
  clave.mjs             Calcula el hash de una contraseña nueva.
  construir.mjs         Arma dist/demo.html, todo en un solo archivo.
```

---

## Sobre el ingreso: no es seguridad

`datos/usuarios.json` es un archivo público del sitio. Cualquiera que ponga la
URL lo descarga. La contraseña está guardada como hash SHA-256, así que no se lee
de un vistazo, pero **la comparación ocurre en el navegador de quien entra**: con
la consola abierta se saltea en diez segundos.

Sirve para que no entre cualquiera que agarre la tablet, y nada más. Los datos
del negocio tampoco están protegidos: en modo servidor, cualquiera en la misma
red que llegue a `/api/base` los lee y los escribe.

Para producción, esto se reemplaza por Firebase Authentication más Firestore con
Security Rules, donde la validación pasa a estar del lado del servidor.

Para cambiar la contraseña:

```bash
node herramientas/clave.mjs nuevaclave
```

y pegar el hash en `datos/usuarios.json`.

---

## Decisiones que conviene conocer antes de tocar el código

**La plata se guarda en centavos enteros.** Nunca en decimales. `0.1 + 0.2` no
da `0.3` en JavaScript, y ese error repetido mil veces descuadra la caja. Todos
los campos terminados en `C` (`costoC`, `precioC`, `montoC`) son enteros.

**`aCentavos()` contempla el formato argentino.** `19.500` son diecinueve mil
quinientos; `19,50` son diecinueve con cincuenta. La función mira cuántos dígitos
hay después del separador para decidir. Si se toca, hay que probar los dos casos.

**El precio y el costo quedan congelados dentro de cada venta.** No se guarda una
referencia al producto, se copian los valores. Si mañana cambia el margen de una
remera, la ganancia de las ventas de ayer no se reescribe.

**Un pedido no toca el stock hasta que se ingresa.** Es el punto de la
función: si sumara al crearse, el sistema diría que hay mercadería que
todavía está en el camión. El pedido nace `pendiente`, y `recibirPedidos()`
es lo único que suma unidades.

**Al ingresar un pedido, el cambio de costo se pregunta, no se aplica solo.**
El costo puede haber cambiado entre el pedido y la entrega, y tocarlo mueve el
precio de venta porque sale del margen. `cambiosDeCosto()` arma la lista de lo
que cambiaría y el diálogo la muestra con una casilla antes de confirmar.

**`reponerHasta` es un ajuste, no una constante.** El programa sabe QUÉ
reponer mirando el stock; cuánto pedir es una decisión del negocio. La
sugerencia descuenta lo que ya está pedido y no recibido (`yaPedido()`), para
no pedir dos veces lo mismo.

**`normalizar()` completa los arreglos que falten.** `Object.assign` deja
pasar un `pedidos: undefined` de una base guardada antes de esta función, y
después revienta al recorrerlo. Por eso `conArreglos()` los fuerza uno por uno.

**Las listas muestran solo los talles con stock** (`conStock()` en
`negocio.js`). Un talle en cero no se puede vender y llena la fila de ruido.
El editor del producto sí los muestra todos: es el único lugar desde donde se
repone un talle que llegó a cero, así que ocultarlos ahí lo dejaría sin salida.

**Importar no está en el menú.** Se entra desde el botón de Productos y se
vuelve con "Volver a productos". Mientras se está en esa pantalla, el menú
deja marcado Productos (`EN_EL_MENU` en `app.js`) para que no quede ninguna
opción encendida.

**Los productos eliminados se marcan `activo: false`, no se borran.** El historial
de ventas guarda el id del producto: borrarlo de verdad rompería los informes
viejos.

**Al importar, el stock se suma al existente.** Importar dos veces la misma
remesa la acumula, no la pisa. Lo que sí se reemplaza es el costo y el margen.

**Las vistas se redibujan enteras.** Por eso los eventos están todos en un único
oyente en `app.js`, delegado por atributos `data-`: enganchar oyentes a cada
botón se perdería en el siguiente repintado.

**Cada venta guarda quién la hizo y cómo se cobró.** Igual que el precio, son
copias congeladas: quedan en la venta aunque después cambie el usuario o se
agregue una forma de cobro nueva. Los productos guardan `creadoPor` (nunca se
pisa) y `modificadoPor` (el último que lo tocó).

**Las formas de cobro se configuran en `js/config.js`.** Agregar una línea a
`MEDIOS_PAGO` la hace aparecer sola en el carrito, en la caja y en los informes.
El `id` es lo que queda guardado en cada venta, así que no conviene cambiarlo
una vez que hay ventas cargadas.

**Las clases modificadoras llevan prefijo `es-`** (`.pastilla.es-ingreso`,
`.mov-icono.es-egreso`). Sin el prefijo, la etiqueta de un movimiento de tipo
ingreso quedaba como `class="pastilla ingreso"` y enganchaba `.ingreso`, que era
la pantalla de acceso: `position:fixed; inset:0`. El span se volvía una capa
sobre toda la pantalla y, con el `border-radius:999px` de la pastilla, aparecía
un círculo verde gigante tapando la caja. La pantalla de acceso ahora se llama
`.acceso`, y `herramientas/` incluye una prueba que detecta esta familia de
choques.

**Los `<svg>` llevan `width`, `height`, `fill` y `stroke` como atributos**, no
solo en el CSS. Un SVG sin medidas se dibuja a su tamaño por defecto, que son
300×150: si la hoja de estilos no llega a aplicarse —caché vieja, un motor que
no soporta la regla— aparece un dibujo gigante y relleno de negro en cada fila.

**Caja e informes usan siempre un rango libre desde-hasta**, sin preajustes,
y arrancan en lo que va del mes: del día 1 hasta hoy. Los campos no llevan
`min` ni `max`: poner `max` en "desde" impediría correr toda la ventana hacia
atrás, porque obligaría a tocar "hasta" primero. Si quedan al revés, `rango()`
los da vuelta solo y lo dice en el subtítulo.

**Las fechas del rango desde-hasta se arman a mano.** `new Date('2026-09-22')`
las interpreta como UTC y en Argentina se corren un día para atrás; por eso
`desdeTexto()` en `negocio.js` parte el texto y usa hora local.

---

## Formato de importación

La primera fila define las columnas. `nombre` y `costo` son obligatorias;
`categoria` y `margen`, opcionales. **Cualquier otra columna se toma como un
talle**, así que el mismo importador sirve con S/M/L/XL o con 38/40/42.

```
nombre	categoria	costo	margen	S	M	L	XL
Remera lisa	Remeras	8200	120	6	9	7	3
```

Acepta tabulaciones (lo que copia Excel) y punto y coma.

---

## Publicar en GitHub Pages

Subir el repositorio y activar Pages sobre la rama principal, carpeta raíz. No
hay build. Va a funcionar en modo navegador, con la base de `datos/inicial.json`
como punto de partida.

Tener presente que en un repositorio público queda expuesto todo, incluido
`datos/usuarios.json` y cualquier dato real que se haya dejado en
`datos/inicial.json`.

---

## Qué falta para producción

1. Firebase Authentication en lugar de `auth.js`.
2. Firestore en lugar de `almacen.js`, con Security Rules que exijan `auth != null`.
3. Cierre de caja diario.
4. Definir si hace falta código de barras.

Con Firestore, los campos `usuario` de cada venta se pueden reemplazar por el
`uid` de Firebase Authentication, y las Security Rules pueden exigir que
coincida con quien escribe.
