# Puesta en marcha

De cero a la aplicación andando con Memé y Memé Kids. Una hora la primera vez.

---

## Antes de empezar: un proyecto, no dos

Los dos emprendimientos van en **un solo proyecto de Firebase**, con los datos
separados por dentro:

```
negocios/meme/productos/…      negocios/kids/productos/…
negocios/meme/ventas/…         negocios/kids/ventas/…
negocios/meme/movimientos/…    negocios/kids/movimientos/…
negocios/meme/pedidos/…        negocios/kids/pedidos/…
negocios/meme/config/general   negocios/kids/config/general

usuarios/…                     (común a los dos)
```

Cada emprendimiento tiene su propio control de stock: no comparten ni un
producto, ni una venta, ni un peso de caja. Lo que comparten es la cuenta de
quien entra.

**Por qué no dos proyectos separados.** Con dos proyectos harían falta dos
juegos de reglas, dos usuarios distintos para la misma persona, y cerrar sesión
cada vez que quiera pasar de uno al otro. Con uno solo, Mica entra una vez y
cambia con un toque, y vos mantenés un solo lugar.

Lo que impide que alguien vea el emprendimiento ajeno no es que estén separados
en carpetas: son las reglas del paso 6, que exigen tener ese negocio anotado en
el perfil.

---

## 1. Crear el proyecto

En [console.firebase.google.com](https://console.firebase.google.com), **Crear
un proyecto**. Nombre sugerido: `meme-control`.

Creálo **con la cuenta de Gmail del negocio**, no con la tuya, y agregate
después desde *Configuración → Usuarios y permisos*. Si algún día se corta la
relación, la dueña no se queda sin acceso a sus datos y vos no quedás
administrando un proyecto ajeno para siempre.

Google Analytics no hace falta.

---

## 2. Habilitar el ingreso

*Compilación → Authentication → Comenzar → Correo electrónico/contraseña →
Habilitar*. Nada más.

> La persona escribe un nombre y un PIN de cuatro números. Por debajo eso se
> convierte en `nombre@usuarios.control-stock.local` contra Firebase. Ese
> dominio no existe ni recibe mail; Firebase solo pide que el formato sea
> válido.

---

## 3. Crear la base

*Compilación → Firestore Database → Crear base de datos*.

Región `southamerica-east1` si el local está en Argentina, por latencia.
**No se puede cambiar después.**

Empezá en **modo de producción**, que deja todo cerrado. Las reglas van en el
paso 6.

---

## 4. Conectar la aplicación

*Configuración del proyecto → Tus apps → Web (`</>`)*. Registrá la app y copiá
el objeto `firebaseConfig`.

Lo que da la consola es **JavaScript**, no JSON. Para no convertirlo a mano:

```bash
node herramientas/firebase-config.mjs
```

Pegás el fragmento tal cual, Ctrl+D, y queda escrito `datos/firebase.json`.
Para revisar uno que ya exista:

```bash
node herramientas/firebase-config.mjs --verificar
```

> **Ese archivo tiene que quedar publicado con el sitio.** La aplicación lo pide
> con `fetch`: si lo agregás al `.gitignore` nunca llega y la app cae al modo
> prototipo. No es secreto; las credenciales viajan igual en el navegador.

Si algo falla, la pantalla `#usuarios` dice exactamente qué: archivo ausente,
JSON inválido, credenciales incompletas o SDK inalcanzable, con la dirección
que pidió y lo que recibió.

---

## 5. Crear el primer usuario

Es el único que se hace a mano, porque hasta que exista no hay quién cree a los
demás.

**a)** En *Authentication → Users → Agregar usuario*:

- Correo: `mica@usuarios.control-stock.local`
- Contraseña: el PIN seguido de `::stock::`. Para el PIN `1190`, va
  `1190::stock::`

Copiá el **UID** que queda en la lista.

**b)** En *Firestore → Iniciar colección*, colección `usuarios`, ID del
documento **ese UID**, con estos campos:

| Campo | Tipo | Valor |
|---|---|---|
| `usuario` | string | `mica` |
| `nombre` | string | `Mica` |
| `rol` | string | `admin` |
| `negocios` | array de strings | `meme`, `kids` |

Cuatro formas de equivocarse acá, y desde afuera se ven todas iguales:

- El **ID del documento** tiene que ser el UID, no el nombre. Copialo, no lo
  tipees.
- La colección se llama `usuarios`, en minúscula.
- El campo es `rol`, sin acento, y el valor `admin`, sin espacios.
- `negocios` es un **array**, no un texto.

Si algo falla, `#usuarios` te dice cuál de las cuatro es y te muestra tu UID
listo para copiar.

### Las vendedoras

Se crean desde la aplicación, en `#usuarios`, eligiendo a qué emprendimiento
entran. Quien tiene uno solo nunca se entera de que existe el otro.

| Persona | Rol | Negocios |
|---|---|---|
| Mica | admin | meme, kids |
| Vendedora de Memé | vendedor | meme |
| Vendedora de Memé Kids | vendedor | kids |

---

## 6. Publicar las reglas

**Esto es lo que protege los datos.** Sin este paso la base queda abierta a
cualquiera que encuentre el ID del proyecto.

```bash
npm install -g firebase-tools
firebase login
firebase init firestore      # elegí el proyecto; dejá firestore.rules
firebase deploy --only firestore:rules
```

O pegando el contenido de `firestore.rules` en *Firestore → Reglas → Publicar*.

**Comprobalo:** abrí una ventana de incógnito sin iniciar sesión y, desde la
consola del navegador, intentá leer una colección. Tiene que fallar con
`permission-denied`.

---

## 7. Publicar la aplicación

```bash
firebase init hosting        # carpeta pública: . (la raíz del proyecto)
firebase deploy --only hosting
```

Cuando pregunte si es una aplicación de una sola página, **respondé que no**.
Si respondés que sí, el servidor devuelve `index.html` para cualquier ruta que
no encuentre, incluido `datos/firebase.json`, y la aplicación recibe una página
HTML donde esperaba sus credenciales.

También sirve GitHub Pages. En cualquiera de los dos, la dirección queda en
https, que hace falta para que el ingreso funcione bien.

---

## 8. App Check

*Compilación → App Check → reCAPTCHA v3*. Bloquea las llamadas a tu proyecto
que no vengan de tu aplicación.

Importa acá más que en otros lados: un PIN de cuatro dígitos son **10.000
combinaciones**, y sin App Check se pueden probar todas contra la API desde
cualquier lado. Si el negocio maneja plata seria, subí `LARGO_PIN` a 6 en
`js/config.js`: pasa a un millón.

---

## 9. Antes de entregar

En `js/config.js`:

```javascript
export const MODO_ESTRICTO = true;
```

Con esto, si Firebase no responde la aplicación no deja entrar y dice por qué.
En `false` caería sola al modo prototipo: validaría contra un archivo público y
guardaría en el navegador. La persona vería un sistema que aparentemente anda,
cargando ventas en un lugar que no es la base del negocio.

Y que pase todo:

```bash
npm install --no-save jsdom
npm run prueba
```

---

## Cargar el stock inicial

Para cada emprendimiento, por separado: entrar, elegir el emprendimiento, ir a
**Productos → Importar** y pegar las filas desde Excel.

La primera fila define las columnas. `nombre` y `costo` son obligatorias;
`categoria` y `margen`, opcionales. **Cualquier otra columna se toma como un
talle.**

```
nombre	categoria	costo	margen	S	M	L	XL
Remera lisa	Remeras	8200	120	6	9	7	3
```

Después, en **Ajustes → Recargo por forma de cobro**, cargar cuánto más cuesta
pagar con cada medio. El precio del producto es el de efectivo; el resto sale
de ahí.

---

## Qué revisar al final

- [ ] Reglas publicadas y verificadas con `permission-denied`
- [ ] `datos/firebase.json` accesible en `tu-sitio/datos/firebase.json`
- [ ] Mica entra y ve los dos emprendimientos al elegir
- [ ] Cada vendedora entra y ve solo el suyo, sin botón de cambio
- [ ] Los recargos cargados en los dos
- [ ] `MODO_ESTRICTO` en `true`
- [ ] App Check activado
- [ ] Un respaldo descargado de cada emprendimiento
