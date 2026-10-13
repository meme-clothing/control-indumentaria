# Memé — manual de uso

Sistema de control interno para Memé y Memé Kids. Maneja stock por
talle, ventas con forma de cobro, pedidos a proveedor, caja e informes.

Es una aplicación web: se abre en el navegador de la tablet, el celular o la
computadora, sin instalar nada.

**Qué no hace.** No emite facturas ni comprobantes fiscales, no es una tienda
online y no maneja cuenta corriente de clientes. Es una herramienta de control
interno.

---

## Índice

1. [Ingreso al sistema](#ingreso-al-sistema)
2. [Panel](#panel)
3. [Vender](#vender)
4. [Productos](#productos)
5. [Importar](#importar)
6. [Pedidos](#pedidos)
7. [Caja](#caja)
8. [Informes](#informes)
9. [Ajustes](#ajustes)
10. [Cosas que conviene saber](#cosas-que-conviene-saber)

---

## Ingreso al sistema

Se entra con usuario y PIN. Si tu usuario tiene acceso a más de un
emprendimiento, después de entrar te pregunta en cuál vas a trabajar, y podés
cambiar en cualquier momento desde la barra lateral, sin cerrar sesión. Si
tenés uno solo, entrás derecho y no ves nada de esto.

Cada emprendimiento tiene sus propios productos, ventas, pedidos y caja. No se
mezclan nunca.

Se entra con usuario y contraseña. El nombre de quien entró queda grabado en
todo lo que registre: ventas, productos que carga, movimientos de caja y
pedidos.

La sesión dura mientras la pestaña esté abierta. Al cerrar el navegador hay que
volver a entrar. Abajo a la izquierda, junto al botón de cerrar sesión, se ve
quién está operando y dónde se están guardando los datos.

> **Esto no es seguridad real.** La contraseña se valida en el propio
> navegador contra un archivo del sitio. Alcanza para que no entre cualquiera
> que agarre la tablet, pero alguien con conocimientos técnicos lo saltea. La
> versión definitiva usa Firebase Authentication, donde la validación ocurre
> del lado del servidor.

---

## Panel

La pantalla de arranque. Responde dos preguntas: cómo viene hoy y qué hay en el
depósito.

### Las cuatro cifras

| Cifra | Qué muestra |
|---|---|
| **Hoy** | Lo vendido en el día y cuántas ventas fueron |
| **Unidades en stock** | Total de unidades físicas, y cuántos productos distintos |
| **Invertido en mercadería** | Lo que costó todo lo que hay en stock, a precio de costo |
| **Si vendés todo** | Lo que entraría vendiendo todo el stock, y cuánta ganancia sería |

"Unidades en stock" cuenta prendas físicas; "productos distintos" cuenta
artículos del catálogo. Cinco remeras negras M son cinco unidades de un solo
producto.

### Reponer pronto

Lista los productos que tienen algún talle en el mínimo o por debajo. El mínimo
se configura en Ajustes y por defecto es 2.

Cada fila muestra los talles flojos con su cantidad. Los que están en cero
aparecen con borde punteado; los que están bajos pero no agotados, en amarillo.

Si de ese producto ya hay unidades pedidas y todavía no llegaron, debajo dice
**"X en camino"**. Sirve para no pedir dos veces lo mismo.

El botón **Armar pedido** lleva directo a la pantalla de Pedidos.

---

## Vender

La pantalla del mostrador. Está pensada para usarse con el dedo.

### Cómo se registra una venta

1. Buscar el producto por nombre o categoría, o encontrarlo en la grilla.
2. Tocar el talle que se lleva el cliente. Se suma al carrito.
3. Repetir con todo lo que compre.
4. Elegir **cómo paga**.
5. Tocar **Confirmar venta**.

Al confirmar, el stock se descuenta solo.

### Las tarjetas de producto

Cada tarjeta muestra el nombre, la categoría, el precio de venta y los talles.

**Solo aparecen los talles que tienen unidades.** Un talle agotado no se
muestra: no se puede vender y solo llenaría la pantalla de ruido. Si un producto
se quedó sin nada, en lugar de los talles dice "Sin stock".

Cada talle muestra la cantidad disponible en chico, debajo de la letra.

### El carrito

Cada línea muestra el producto, el talle, la cantidad, el precio unitario y el
subtotal. Se puede quitar una línea con **Quitar**, o vaciar todo con
**Vaciar**.

Abajo, antes de confirmar:

- **Productos**: cuántas unidades lleva
- **Ganancia de esta venta**: cuánto queda descontando el costo
- **Total**: lo que paga el cliente

Ver la ganancia antes de cerrar la venta permite decidir con información si se
hace un descuento.

### El precio cambia según cómo paguen

Arriba, al lado del buscador, está **Cobro**. Al elegir una forma de pago,
todos los precios que ves pasan a ser los de esa forma. Conviene elegirla antes
de decirle el precio al cliente.

Si ya tenés cosas en el carrito y cambiás la forma de cobro, los precios se
recalculan solos. Nunca quedan precios de efectivo mezclados con precios de
tarjeta en la misma venta.

Cuánto más cuesta cada forma se configura una sola vez en Ajustes. Y si un
producto puntual tiene otro precio, se le pone el suyo desde su ficha.

### Formas de cobro

Efectivo, Transferencia, Mercado Pago, Tarjeta de débito, Tarjeta de crédito y
Otro. La última elegida queda seleccionada para la venta siguiente, que suele
ser la misma.

### No se puede vender de más

Si se intenta agregar más unidades de las que hay, el sistema avisa cuántas
quedan y no las suma. El stock del sistema no puede quedar en negativo.

Debajo del botón dice a nombre de quién se va a registrar.

---

## Productos

El catálogo completo con su stock.

### La tabla

| Columna | Qué muestra |
|---|---|
| **Producto** | Nombre y categoría |
| **Stock por talle** | Solo los talles con unidades |
| **Costo** | Lo que cuesta comprarlo |
| **Margen** | Porcentaje de ganancia aplicado |
| **Precio** | Precio de venta, que sale de costo + margen |
| **Valor** | Cuánto vale ese stock a precio de venta |
| **Cargado por** | Quién lo dio de alta |

El buscador filtra por nombre y por categoría.

### Los cuatro botones

**Importar** abre la pantalla de carga masiva desde Excel.

**Ingresar pedido (N)** abre el diálogo para dar entrada a la mercadería que
llegó. El número entre paréntesis son los pedidos pendientes. Si no hay ninguno,
el botón está apagado.

**Nuevo producto** abre el editor vacío.

### El editor de producto

- **Nombre** y **Categoría**. La categoría sugiere las que ya existen.
- **Costo por unidad** y **Margen de venta**. Debajo se ve el **precio de venta
  calculado**, que se actualiza mientras se escribe.
- **Stock por talle**: una fila por talle, con su cantidad. Se pueden agregar
  talles nuevos (S, M, XXL, 38, 42, lo que use el negocio) y quitar los que no
  correspondan.

> **Acá sí se ven todos los talles, incluso los que están en cero.** En las
> listas se ocultan, pero este es el único lugar desde donde se repone un talle
> agotado: si también se ocultaran acá, no habría forma de volver a cargarlo.

Al pie dice quién lo cargó y cuándo, y quién lo modificó por última vez. Quien
lo cargó no cambia nunca, aunque después lo edite otra persona.

**Eliminar** saca el producto de las listas pero no borra el historial: las
ventas viejas siguen contando en los informes. Por eso un producto eliminado no
desaparece de la base, se marca como inactivo.

---

## Importar

No está en el menú. Se entra desde el botón **Importar** de Productos, y se sale
con **Volver a productos**. Mientras se está acá, el menú deja marcado
Productos.

### Cómo se pega el stock

1. Seleccionar las filas en Excel, incluida la de encabezados.
2. Copiar con Ctrl+C.
3. Pegar en el recuadro grande.
4. Tocar **Revisar**.
5. Revisar la previsualización y tocar **Importar N**.

### El formato

La primera fila define las columnas.

| Columna | Obligatoria | Qué es |
|---|---|---|
| `nombre` | Sí | Nombre del producto |
| `costo` | Sí | Precio de costo por unidad |
| `categoria` | No | Rubro |
| `margen` | No | Porcentaje de ganancia. Si falta, se usa 100 |

**Cualquier otra columna se toma como un talle.** Por eso el mismo importador
sirve con S/M/L/XL, con 38/40/42, o con la numeración que use el negocio, sin
configurar nada.

```
nombre	categoria	costo	margen	S	M	L	XL
Remera lisa	Remeras	8200	120	6	9	7	3
Buzo con capucha	Buzos	19500	110	3	7	6	4
```

Acepta tabulaciones, que es lo que copia Excel, y también punto y coma. Los
nombres de columna admiten variantes: `producto` o `artículo` valen por
`nombre`, `rubro` por `categoria`.

El botón **Usar un ejemplo** carga un caso de muestra para ver el formato.

### La previsualización

Antes de importar se ve una tabla con lo que va a entrar: producto, categoría,
costo, margen, precio calculado y la cantidad de cada talle. Arriba dice cuántos
talles detectó.

Las filas con problemas —un costo que no se entiende, por ejemplo— salen
marcadas en rojo con el número de fila, y no se importan. El botón dice cuántos
productos sí van a entrar.

### Qué pasa con lo que ya existe

Si el nombre coincide con un producto que ya está cargado, **el stock se suma**
al existente en lugar de reemplazarlo. Importar dos veces la misma remesa la
acumula. El costo y el margen sí se reemplazan por los del archivo.

---

## Pedidos

Los encargues al proveedor, desde que se hacen hasta que la mercadería entra.

### La idea

Un pedido **no toca el stock** hasta que se ingresa. Mientras está en camino,
queda anotado como pendiente. Recién cuando llega y se lo da por recibido, las
unidades se suman.

Esa separación es el punto de la función. Si el pedido sumara stock al crearse,
el sistema diría que hay mercadería que todavía está en el camión, y con eso se
arruinan las alertas de reposición y el valor del inventario.

### Nuevo pedido

- **Proveedor** y **Fecha del pedido**. El proveedor sugiere los ya usados.
- **Sugerir del stock bajo**: llena el pedido solo con lo que está por debajo
  del mínimo. La cantidad sale del ajuste "reponer hasta N unidades por talle".
  Descuenta lo que ya está pedido y no llegó, así no se duplica.
- Carga manual: elegir producto, talle y cantidad, y tocar **Agregar**.
- Las líneas se pueden editar en la cantidad o quitar. Abajo se ve el **total
  del pedido**.
- **Nota**: texto libre, para anotar una seña o la entrega estimada.

> Al elegir un producto acá aparecen **todos** sus talles, incluidos los que
> están en cero. Son justamente los que hay que pedir.

### La lista

Arriba, **Pendientes de recibir**, con el total de plata que hay en camino.
Abajo, el **Historial** con los recibidos y los cancelados.

Cada pedido muestra el proveedor, su estado, la fecha, quién lo hizo, el detalle
línea por línea, el total y las unidades. Los ya recibidos muestran además
cuándo entraron y quién los ingresó.

Un pedido pendiente se puede **Editar** o **Cancelar**. Cancelar no toca el
stock, porque la mercadería nunca entró.

### Ingresar la mercadería

Se hace desde **Productos → Ingresar pedido**.

1. El diálogo lista los pedidos pendientes, cada uno con su casilla, el
   proveedor, la fecha, las unidades, el detalle y el total.
2. Tildar los que llegaron. Se pueden ingresar varios de una vez.
3. Tocar **Ingresar N**.

Las unidades se suman al stock y los pedidos quedan marcados como recibidos, con
la fecha y con quién los ingresó.

#### Si cambió el costo

Cuando el costo de una línea no coincide con el que tiene el producto, aparece
un recuadro amarillo que lista qué productos cambiarían, **con el precio de
venta viejo y el nuevo**, y una casilla para decidir si se actualiza.

La casilla viene encendida, pero el cambio se muestra antes de confirmar: tocar
el costo mueve el precio de venta, porque el precio sale del margen. Eso no
tiene que pasar sin que se sepa.

---

## Caja

Todo lo que entró y salió, en un solo lugar.

### El rango de fechas

Arriba hay dos campos, **Desde** y **Hasta**. Al abrir, muestran lo que va del
mes: del día 1 hasta hoy.

Si se cargan al revés, el sistema las da vuelta solo y lo aclara en el
subtítulo.

### Las cuatro cifras

| Cifra | Qué suma |
|---|---|
| **Ventas** | Lo cobrado por ventas en el período |
| **Otros ingresos** | Ingresos cargados a mano: aportes, devoluciones |
| **Egresos** | Los gastos del período |
| **Balance** | Ingresos menos egresos |

### La lista de movimientos

Agrupada por día, como un resumen bancario. Cada día tiene su encabezado con el
**neto de la jornada**. El día de hoy dice "Hoy" y el anterior "Ayer".

Cada movimiento muestra un ícono según el tipo, el concepto, la hora, la
etiqueta de tipo, la forma de cobro, quién lo registró y el monto a la derecha,
en verde si entra y en ciruela si sale.

Las ventas muestran además la ganancia. Si la venta tuvo más de un producto, el
título dice "Venta de N productos" y hay un **Ver detalle** que despliega los
artículos con sus subtotales.

**Deshacer** en una venta la elimina y **devuelve las unidades al stock**. En un
movimiento manual simplemente lo borra.

### Registrar ingreso y egreso

Los dos botones de arriba abren el mismo formulario:

- **Concepto**: para qué fue
- **Monto**
- **Cómo lo pagaste** (en un egreso) o **Cómo lo cobraste** (en un ingreso)
- **Fecha**, por defecto hoy

Queda registrado a nombre de quien lo carga.

---

## Informes

El análisis del período. Mismo selector de fechas que Caja, arrancando en lo que
va del mes.

### Las cuatro cifras

| Cifra | Qué muestra |
|---|---|
| **Vendido** | Total facturado y cuántas ventas fueron |
| **Ganancia** | Lo que quedó después del costo, con el porcentaje de margen real |
| **Productos vendidos** | Unidades, y el promedio por venta |
| **Venta promedio** | Cuánto deja en promedio cada operación |

El **margen real** puede no coincidir con el margen configurado en los
productos, porque se calcula sobre lo que efectivamente se vendió.

### Cómo te pagaron

Una barra por forma de cobro, ordenadas de mayor a menor, con el monto, la
cantidad de ventas y el porcentaje sobre el total.

Sirve para saber cuánta plata entró por cada canal y cuánto hay realmente en el
cajón.

> Cuenta solo las ventas. Los ingresos y egresos cargados a mano guardan su
> forma de pago, pero no entran en este gráfico.

### Talles que más salen

Una barra por talle, con las unidades vendidas. Es la información que decide qué
comprar la próxima vez.

### Lo que más se vendió

Ranking de hasta doce productos con unidades, monto vendido y ganancia.

Conviene mirar las dos últimas columnas juntas: el producto que más factura no
siempre es el que más deja.

### Quién vendió

Aparece solo si hubo más de una persona vendiendo en el período. Muestra ventas
y monto por persona.

### Ventas por día

Gráfico de barras, una por día del rango. Pasando el dedo o el mouse por una
barra se ve la fecha y el monto. Debajo, el día más alto y el total del período.

### Descargar CSV

Baja el detalle línea por línea, una fila por producto vendido: fecha, hora,
vendedor, forma de cobro, producto, talle, cantidad, precio unitario, total y
ganancia. Abre en Excel.

---

## Ajustes

### Estado

Un vistazo a cómo está la aplicación: si los datos van a la nube, al servidor
local o solo a este equipo; con qué usuario se entró; a qué hora fue el último
guardado; cuántos productos, ventas y pedidos pendientes hay; y cuánto hace del
último respaldo.

Si pasaron más de catorce días sin respaldar, ese dato aparece en rojo y la
tarjeta de Respaldo muestra un aviso.

### Apariencia

Tema claro, oscuro, o seguir al del sistema. Arranca en claro. También se
cambia con el botón de la barra lateral.

### Recargo por forma de cobro

El precio de cada producto es el de efectivo. Acá se define cuánto más cuesta
pagar de otra forma, en porcentaje, y rige para todo el catálogo.

Por ejemplo, con 10 en tarjeta de crédito, un producto de $100.000 se cobra
$110.000.

Un producto puede escaparse de la regla: en su ficha, abajo, hay un precio por
cada forma de cobro. El que escribas ahí queda fijo solo para ese producto.

### Avisos de stock

**Avisame cuando un talle quede en esta cantidad o menos**, por defecto 2. Es
lo que decide qué aparece en "Reponer pronto".

**Al sugerir un pedido, reponer hasta esta cantidad por talle**, por defecto 6.
De acá sale la cantidad que propone el botón "Sugerir del stock bajo".

### Respaldo

**Descargar respaldo** baja un archivo con todo: productos, ventas,
movimientos y pedidos. **Restaurar desde archivo** vuelve a cargar uno.

### Borrar todo

Con la base en la nube, vaciar pide escribir la palabra BORRAR y avisa cuántos
productos, ventas y pedidos se pierden, porque borra para todos los
dispositivos. La opción de volver a los datos de demostración no aparece en ese
caso: reemplazaría el negocio real por productos inventados.

---

## Cosas que conviene saber

### El precio se congela dentro de cada venta

Cuando se registra una venta, el precio y el costo se copian adentro. Si mañana
cambia el margen de una remera, la ganancia de las ventas de ayer no se
reescribe. Los informes de meses pasados siguen siendo fieles a lo que pasó.

### La plata se guarda en centavos enteros

Sin decimales. Es una decisión técnica con efecto real: evita que el redondeo
vaya descuadrando la caja de a centavos.

Al escribir un importe, el sistema entiende el formato argentino. `19.500` son
diecinueve mil quinientos y `19,50` son diecinueve con cincuenta.

### Nada se borra del todo

Un producto eliminado se marca inactivo y sale de las listas, pero el historial
de ventas lo sigue nombrando. Un pedido cancelado queda en el historial. Eso
mantiene los informes viejos consistentes.

### Un pedido ya recibido no vuelve a sumar

Si por error se intenta ingresar dos veces el mismo pedido, la segunda no hace
nada.

### Dónde ver quién hizo qué

| Dato | Dónde se ve |
|---|---|
| Quién hizo una venta | En cada fila de Caja |
| Quién cargó un producto | Columna "Cargado por" en Productos |
| Quién lo modificó último | Al pie del editor del producto |
| Quién registró un movimiento | En cada fila de Caja |
| Quién hizo un pedido | En la tarjeta del pedido |
| Quién ingresó la mercadería | En la tarjeta del pedido recibido |

### Qué falta para la versión definitiva

1. Firebase Authentication, para que el ingreso sea seguridad real.
2. Firestore en lugar del archivo local, con acceso desde cualquier dispositivo
   y respaldo automático.
3. Cierre de caja diario.
4. Definir si hace falta lectura de código de barras.
5. Decidir si el costo de un pedido debe anotarse como egreso en la caja al
   ingresarlo. Depende de si se paga al pedir, al recibir o en cuotas.
