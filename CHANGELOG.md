# Historial de versiones

## 3.4.1

- Eliminar un producto pide confirmación. Antes se borraba de un solo clic, con
  el botón al lado de Guardar. El cartel dice cuál es el artículo y cuántas
  unidades tiene en stock, porque eliminar uno con mercadería cargada casi
  siempre es un error de dedo.
- La confirmación aclara que el artículo sale de las listas pero que las ventas
  y los pedidos anteriores no se tocan. Nunca se borró de verdad: se marca
  inactivo, porque el historial guarda el id del producto y borrarlo dejaría
  ventas apuntando a la nada.

## 3.4.0

- **Corregido**: en la ficha del producto no había forma de quitar un talle. Se
  había perdido al pasar el editor a grilla de números. Ahora cada talle tiene
  su pastilla con un botón para sacarlo, y si tiene unidades cargadas pregunta
  antes, porque quitarlo pierde ese stock.
- **Tarjeta de talles en Ajustes**, igual que la de colores: agregar, renombrar,
  quitar y, sobre todo, **ordenar**. Ese orden manda en todas las pantallas.
  Antes los talles salían en el orden en que se habían cargado, así que una
  remera podía mostrar XL antes que M.
- Renombrar un talle lo renombra en todos los productos, incluso adentro de los
  colores. No se puede quitar uno que esté en uso.
- En la ficha, los talles se eligen de esa lista en vez de escribirse a mano.
- Los talles que trae una planilla y no están en la lista se agregan solos, al
  final y en el orden de las columnas, y el aviso de importación los nombra.

**Nota de diseño.** La confirmación para quitar un talle se hace en la pastilla
misma y no con un diálogo. El editor de producto ya es un diálogo, y el sistema
tiene una sola ranura: abrir otro encima cerraba la ficha entera y se perdía
todo lo cargado.

## 3.3.0

Colores por talle.

- Un artículo puede venir en varios colores, y cada color tiene sus propios
  talles. Los artículos de un solo color **no cambian en nada**: siguen con los
  talles a la vista y se venden de un toque.
- Al vender, un artículo con colores abre una grilla de colores por talles y se
  toca la casilla. No hay un orden impuesto entre color y talle, porque a veces
  la clienta viene por el color y a veces por el talle.
- El color queda guardado en la venta, en el pedido y en el aviso de reponer.
  "Faltan remeras talle M" no alcanza para hacer el pedido al proveedor.
- **Informe nuevo**: qué colores salen más, con filtro por categoría.
- La planilla acepta una columna `color` con una fila por color. Las filas del
  mismo artículo se juntan en un solo producto con varios colores, no en varios
  productos.
- Los colores salen de una lista por negocio, editable en Ajustes, con su tono
  para dibujar el círculo. No se escriben a mano: si se escribieran, "negro" y
  "Negro" quedarían como dos colores distintos y el informe no serviría.
  Renombrar un color lo renombra también en los productos que ya lo usan, y no
  se puede quitar uno que esté en uso.
- El precio, el costo y el margen son del artículo, no del color.

**Nota técnica.** El color va anidado (`colores: { Negro: { S: 4 } }`) y no como
una clave `Negro/M`. Este negocio vende medias 3/4: con un separador, el
programa no podría saber dónde termina el color y dónde empieza el talle. Hay
una prueba dedicada a ese caso.

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
