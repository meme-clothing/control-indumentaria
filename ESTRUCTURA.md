# Qué hay en el repositorio

Resumen de para qué sirve cada cosa, y qué revisar antes de entregarle una
instalación a un cliente.

---

## Lo que se publica en el sitio

Esto lo descarga el navegador. Es lo único que tiene que llegar al hosting.

```
index.html              La página
css/estilos.css         Estilos. La paleta está en :root, arriba de todo,
                        con el bloque del tema oscuro justo debajo
marca/                  Logo vectorizado y favicon
js/                     El programa
datos/firebase.json     Credenciales del proyecto del cliente
datos/usuarios.json     Solo para el modo prototipo (ver abajo)
datos/inicial.json      Datos de muestra (ver abajo)
```

## Lo que vive solo en el repositorio

No lo descarga nadie, no pesa en el sitio y no hace falta sacarlo.

```
herramientas/           Pruebas y utilidades
servidor/servidor.mjs   Servidor local para desarrollar
firestore.rules         Reglas de seguridad. Se publican con firebase deploy
*.md                    Documentación
package.json            Atajos de npm
```

Las pruebas encontraron, entre otras cosas: dos nombres que chocaban al armar
el archivo único, importaciones con alias que quedaban rotas, un borrado que
se habría llevado todo el historial anterior a noventa días, y el redondeo que
hacía que un rango de un día contara dos. Sacarlas para que el repositorio se
vea prolijo sale carísimo la primera vez que algo se rompe.

---

## Antes de entregar

### 1. Modo estricto

En `js/config.js`:

```javascript
export const MODO_ESTRICTO = true;
```

Con esto, si Firebase no responde, la aplicación no deja entrar y dice por qué.

En `false` —el valor de desarrollo— caería sola al modo prototipo: validaría
contra `datos/usuarios.json` y guardaría en el navegador. La persona vería un
sistema que aparentemente anda, cargando ventas en un lugar que no es la base
del negocio. Es la peor forma de fallar.

### 2. Datos de muestra

`datos/inicial.json` tiene productos y ventas inventados. Con la base en la
nube no se usa, y el botón de volver a la demostración no aparece. Podés
dejarlo o vaciarlo; no molesta.

### 3. El usuario de prototipo

`datos/usuarios.json` tiene el usuario `mica` con un PIN de prueba. Con modo
estricto en `true` no se lee nunca. Si querés, reemplazalo por:

```json
{ "usuarios": [] }
```

### 4. Reglas publicadas

```bash
firebase deploy --only firestore:rules
```

Comprobalo: en una ventana de incógnito, sin iniciar sesión, la consola del
navegador tiene que devolver `permission-denied` al intentar leer una
colección.

### 5. App Check

Es lo que cierra el camino de probar las 10.000 combinaciones de un PIN de
cuatro dígitos contra la API desde afuera. Está en el paso 8 de `FIREBASE.md`.

### 6. Que todo pase

```bash
npm install --no-save jsdom
npm run prueba
```

---

## Dos botones que cambian cuando hay base en la nube

**Volver a la demostración** desaparece. Con la base local reemplazaba datos de
juguete por datos de juguete; con la base real reemplazaría el negocio por
productos inventados, para todos los dispositivos.

**Vaciar todo** pide escribir la palabra BORRAR y avisa cuántos productos,
ventas y pedidos se van a perder. Un botón de confirmar se toca sin leer; una
palabra hay que escribirla.

---

## Varios clientes, un solo código

### Sumar un emprendimiento

1. Una entrada en `js/negocios.js` con su `id`, nombre, favicon y los dos
   colores de la barra del navegador.
2. Dos bloques de paleta en `css/estilos.css`: `[data-negocio="id"]` y
   `[data-negocio="id"][data-tema="oscuro"]`.
3. Su logo en `index.html`, dentro de un `<span class="logo-negocio"
   data-de="id">`, en los dos lugares donde aparece la marca.
4. Su miniatura en `MINIATURAS`, en `js/app.js`, para la pantalla de elección.
5. Su `id` en la lista `negocios` de los usuarios que deban entrar.

Quién ve qué sale de esa lista: con un emprendimiento se entra derecho y no
aparece el botón de cambio; con dos o más se elige al entrar y se puede cambiar
desde la barra lateral.

El `id` queda escrito en la ruta de los datos y en el permiso de cada usuario,
así que no se cambia una vez que hay información cargada.

---

Lo mismo para todos, y lo que cambia por cliente son cuatro cosas:
`datos/firebase.json`, la paleta en `:root` y su bloque `[data-tema="oscuro"]`,
el contenido de `marca/` junto a los dos SVG incrustados en `index.html`, y los
interruptores de `js/config.js`.

Para cambiar de marca: reemplazar los dos `<svg class="logo …>` de
`index.html` por los del cliente nuevo, con su `viewBox` y sus dos versiones,
y ajustar `--marca` y `--tinta` en los dos temas.

Cuando aparezcan funciones para un cliente puntual —fotos de producto, lector
de código de barras—, van como módulos con un interruptor en `config.js`, no
como una copia del proyecto. Cuatro copias divergentes significan aplicar cada
arreglo cuatro veces.
