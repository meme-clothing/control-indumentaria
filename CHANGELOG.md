# Historial de versiones

## 3.2.0

**Corregido un error grave de importación.** El importador tomaba como talle
cualquier columna que no reconociera, así que una planilla con una columna
`credito` o `efectivo` cargaba un talle con ese nombre y el precio como
cantidad de stock: una remera de $18.040 entraba como 18.040 unidades. Ahora
las columnas de precio por forma de cobro se reconocen y quedan fuera de la
detección de talles.

- La planilla acepta `precio` como alternativa a `costo` (con los dos, el
  margen se deduce), `minimo` y `reponer` para el control de stock de cada
  producto, y un precio por forma de cobro. Los nombres se reconocen con o sin
  acentos, con o sin el prefijo `precio`, y en cualquier combinación de
  mayúsculas.
- **El importe a cobrar está siempre a la vista.** En pantalla chica el carrito
  queda debajo del catálogo, así que mientras se cargaban productos el total no
  se veía. Ahora hay una barra fija con el total, la forma de cobro y el botón
  de confirmar.
- **"Cuánto sale con cada forma de pago"** en el carrito: el total con cada
  una, para responder sin deshacer nada.

## 3.1.1

- El logo de Memé pasa a ser una lámina rectangular con el logotipo completo
  sobre su crema, del mismo tamaño que la de Memé Kids. Antes era la insignia
  circular del original, que a ese tamaño dejaba el texto muy chico.

## 3.1.0

- **Cerrar sesión y cambiar de emprendimiento desde el celular.** En pantalla
  chica la barra lateral se reduce a los iconos de abajo y esas dos acciones
  quedaban fuera de alcance. Ahora están también en Ajustes, arriba de todo.
- **Un solo logo a la vez.** Antes estaban los dos en el documento y una regla
  de CSS ocultaba el que no correspondía; si esa regla no se aplicaba,
  aparecían juntos. Ahora el logo lo dibuja el programa: el otro directamente
  no existe.
- **Fondo a rayas en Memé Kids**, tomado del logo pero muy bajado de tono. Con
  el contraste original, las tablas y los números se vuelven difíciles de leer.
- **El control de stock pasó de Ajustes a cada producto.** Cada uno define
  cuándo avisar y hasta cuánto reponer: no se rotan igual una remera básica y
  una campera. Los productos que no lo tengan cargado usan el valor por
  defecto.
- **El editor de producto es más ancho y va en dos columnas**: datos y control
  de stock a la izquierda, talles y precios a la derecha. En pantalla chica
  vuelve a una sola columna.
- El conversor de configuración termina solo al reconocer el objeto pegado.
  Antes pedía Ctrl+D, que es de Linux y Mac; en Windows hay que hacer Ctrl+Z y
  Enter, y eso no estaba dicho en ningún lado.

## 3.0.0

Instalación de Memé, con sus dos emprendimientos, y precios por forma de cobro.

- **Marcas**: Memé y Memé Kids, cada una con su paleta en claro y en oscuro,
  sacada de su logo. Memé usa el crema y el borravino; Kids, el rosa, el verde
  salvia y el marrón. En los dos casos el color de acción es el tono oscuro,
  porque los claros de marca con texto blanco no llegan al contraste mínimo.
- **La pantalla de ingreso es neutra**: dice "Control de Indumentaria" y nada
  más. Recién al saber quién entra se sabe de qué emprendimiento mostrar la
  marca.
- **La elección va siempre después de autenticarse**, también con un solo
  emprendimiento disponible: deja claro dónde se va a trabajar antes de entrar.
- **Precio por forma de cobro.** El precio del producto es el de efectivo; en
  Ajustes se define cuánto más cuesta cada medio, y eso rige para todo el
  catálogo. Un producto puede tener su propio precio para un medio puntual,
  desde su ficha.
- La forma de cobro pasó al encabezado de la pantalla de venta: cambia los
  precios de todo lo que está a la vista, así que se elige antes de mirarlos.
  Al cambiarla se recalcula lo que ya esté en el carrito, para que no queden
  precios de efectivo mezclados con precios de tarjeta en la misma venta.
- `INSTALACION.md`: los nueve pasos para crear la base y conectarla.

Lo demás sigue igual que en la base 2.0: productos, pedidos, caja, informes,
usuarios, separación de datos por emprendimiento y Security Rules.
