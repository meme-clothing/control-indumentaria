# Conectar con Firebase

Del proyecto vacío a la aplicación andando contra la nube. Media hora la
primera vez.

---

## 1. Crear el proyecto

En [console.firebase.google.com](https://console.firebase.google.com), **Crear
un proyecto**.

Conviene crearlo **con la cuenta de Gmail del negocio**, no con la tuya, y
agregarte después como miembro desde *Configuración → Usuarios y permisos*. Si
el día de mañana se corta la relación, el cliente no se queda sin acceso a los
datos de su propio negocio y vos no quedás administrando un proyecto ajeno para
siempre.

Google Analytics no hace falta.

---

## 2. Habilitar autenticación

*Compilación → Authentication → Comenzar → Correo electrónico/contraseña →
Habilitar*.

No habilites nada más. La aplicación usa solo este método.

> El usuario nunca ve un correo. Escribe un nombre y un PIN, y la aplicación lo
> traduce por debajo a `nombre@usuarios.control-stock.local`. Ese dominio no
> existe ni recibe mail: Firebase solo pide que el formato sea válido.

---

## 3. Crear la base

*Compilación → Firestore Database → Crear base de datos*.

Elegí la región `southamerica-east1` si el negocio está en Argentina, por
latencia. **La región no se puede cambiar después.**

Empezá en **modo de producción**, que deja todo cerrado. Las reglas las
publicamos en el paso 6.

---

## 4. Copiar las credenciales

*Configuración del proyecto → Tus apps → Web (`</>`)*. Registrá la app y copiá
el objeto `firebaseConfig`.

Lo que da la consola es **JavaScript**, no JSON:

```javascript
const firebaseConfig = {
  apiKey: "AIza...",
  projectId: "tu-proyecto"
};
```

JSON necesita comillas en cada nombre de campo, sin `const` y sin punto y coma.
Para no hacerlo a mano:

```bash
node herramientas/firebase-config.mjs        # pegás, Ctrl+D, y queda el archivo
node herramientas/firebase-config.mjs --verificar   # revisa el que ya tenés
```

Pegar el fragmento tal cual es el error más común acá. La aplicación lo
reconoce y te lo dice con nombre propio.

> Estos datos **son públicos por diseño**. Viajan en el código que corre en el
> navegador y cualquiera puede verlos. No son una contraseña: lo que protege la
> base son las reglas del paso 6. No pierdas tiempo tratando de ocultarlos.

Si el archivo no está, la aplicación arranca igual en modo prototipo y te dice
el motivo en la pantalla de ingreso y en `#usuarios`.

> **El archivo tiene que quedar publicado con el sitio.** La aplicación lo pide
> con `fetch`, así que si lo agregás al `.gitignore` nunca llega a GitHub Pages
> y la app cae al modo prototipo. No lo ignores: no es secreto, y las
> credenciales viajan igual en el código.

### Si dice "Sin conexión con Firebase"

La pantalla `#usuarios` te dice el motivo exacto. Los cuatro habituales:

| Lo que dice | Qué pasó |
|---|---|
| No encontré datos/firebase.json | El archivo no está, o no se publicó |
| Le faltan apiKey o projectId | Se copió el objeto incompleto |
| No es un JSON válido | Quedó una coma de más o comillas sin cerrar |
| No se pudo descargar el SDK | Sin internet, o el sitio se abrió con doble clic en vez de servirlo |

Para verificarlo en diez segundos, abrí `tu-sitio/datos/firebase.json` en una
pestaña. Si da 404, el problema es ese.

Y una que confunde: **la demostración de un solo archivo (`dist/demo.html`)
nunca va a conectar con Firebase**, porque no tiene de dónde leer las
credenciales y el entorno donde suele verse bloquea los scripts externos. Esa
versión es solo para mostrar la aplicación, no para trabajar.

---

## 5. Crear el primer administrador

Es el único que se hace a mano, porque hasta que exista no hay quién cree
usuarios.

**a)** En *Authentication → Users → Agregar usuario*:

- Correo: `mica@usuarios.control-stock.local`
- Contraseña: el PIN seguido de `::stock::` — para el PIN `1190`, va
  `1190::stock::`

Copiá el **UID** que queda en la lista.

**b)** En *Firestore → Iniciar colección*, colección `usuarios`, ID del
documento **ese UID**, con estos campos:

| Campo | Tipo | Valor |
|---|---|---|
| `usuario` | string | `mica` |
| `nombre` | string | `Mica` |
| `rol` | string | `admin` |
| `negocios` | array de strings | `morta`, `lima` |

El campo `negocios` dice a qué emprendimientos puede entrar. Si falta, se toma
como acceso a todos: así siguen entrando los usuarios creados antes de que
hubiera más de uno.

Tres cosas que hacen fallar este paso, y las cuatro se ven igual desde afuera
("no tenés permiso"):

- El **ID del documento** tiene que ser el UID, no el nombre de usuario.
  Copialo de la lista de Authentication, no lo tipees.
- El campo se llama `rol`, en minúscula y sin acento.
- El valor es `admin`, en minúscula y sin espacios alrededor.
- La colección se llama `usuarios`, en minúscula.

Si algo de eso falla, la pantalla `#usuarios` te dice cuál de las cuatro es y
te muestra tu UID listo para copiar.

El rol vive acá y no en el navegador. Alguien puede alterar el programa que
corre en su máquina; no puede alterar este documento, porque las reglas solo
dejan escribirlo a un administrador.

De ahí en adelante, los demás usuarios se crean desde la aplicación.

---

## 6. Publicar las reglas

Esto es lo que protege los datos. Sin este paso la base queda abierta.

```bash
npm install -g firebase-tools
firebase login
firebase init firestore      # elegí el proyecto; dejá firestore.rules
firebase deploy --only firestore:rules
```

O pegando el contenido de `firestore.rules` en *Firestore → Reglas → Publicar*.

Verificá que quedaron bien: abrí la consola del navegador en una pestaña sin
sesión iniciada e intentá leer una colección. Tiene que fallar con
`permission-denied`.

---

## 7. La página oculta de usuarios

Con sesión de administrador, agregá `#usuarios` al final de la dirección:

```
https://tu-sitio.web.app/#usuarios
```

Desde ahí se crean usuarios, se ve la lista y se cambia el PIN propio.

> Que no esté en el menú es comodidad, no seguridad. Lo que la protege es el
> rol `admin` y las reglas. Una dirección que nadie conoce es la llave abajo
> del felpudo.

---

## 8. App Check (recomendado)

*Compilación → App Check → reCAPTCHA v3*. Bloquea las llamadas a tu proyecto
que no vengan de tu aplicación.

Importa especialmente acá: un PIN de cuatro dígitos son **10.000
combinaciones**, y sin App Check alguien puede probarlas contra la API desde
cualquier lado. Con App Check, ese camino se cierra.

Si el negocio maneja plata seria, subí `LARGO_PIN` a 6 en `js/config.js`: pasa
a un millón de combinaciones y le cuesta dos teclas más a la persona.

---

## Cómo trabaja la aplicación contra Firestore

**Colecciones:** los datos de cada emprendimiento cuelgan de
`negocios/{id}/productos`, `negocios/{id}/ventas`, y así con movimientos,
pedidos y config. `usuarios` es común a todos y vive en la raíz.

**Migrar desde la versión de un solo negocio.** Si ya había datos en las
colecciones de la raíz, moverlos con `herramientas/migrar-a-negocios.mjs`. Se
corre desde la consola del navegador con sesión de administrador: primero en
seco para contar, después en serio para copiar. No borra nada de lo viejo.

**Lectura por ventana.** Al abrir se traen productos y pedidos enteros, pero de
ventas y movimientos solo los últimos 90 días (`VENTANA_DIAS` en
`js/config.js`). Traer todo el historial en cada visita es exactamente lo que
agota la cuota gratuita de 50.000 lecturas diarias. Si un informe pide fechas
más viejas, ese tramo se busca en el momento.

**Escritura por diferencias.** Al guardar se compara contra una foto tomada en
la última lectura, y se manda solo lo que cambió, en lotes. Por eso ninguna
pantalla tuvo que cambiar su forma de llamar a `guardar()`.

Y lo importante: **solo se borra de la nube lo que alguna vez se cargó**. Un
documento viejo, fuera de la ventana de fechas, no se toca nunca. Sin esa
salvaguarda, abrir la aplicación y guardar borraría todo el historial anterior
a 90 días. Hay una prueba dedicada a esto en `herramientas/prueba-firebase.mjs`.

---

## Costo

Dentro del plan gratuito (Spark): 50.000 lecturas, 20.000 escrituras y 1 GiB
almacenado. Un local con 25 ventas por día usa una fracción mínima.

Spark **no puede generar una factura**: cuando se agota la cuota, deja de
responder hasta el día siguiente. Para un trabajo de cliente eso es una
ventaja, no una limitación.

Lo único que no entra es Cloud Storage, que desde febrero de 2026 pide cuenta
de facturación. Recién haría falta si se agregan fotos de producto.

---

## Probar sin tocar la base real

```bash
npm install --no-save jsdom
node herramientas/prueba-firebase.mjs
```

Usa un SDK falso en memoria: verifica el ingreso, el alta de usuarios, el
cambio de PIN, la sincronización y la ventana de fechas, sin pegarle a ningún
proyecto.

Las Security Rules **no** se prueban ahí. Para eso:

```bash
firebase emulators:start --only firestore
```
