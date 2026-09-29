# Compounding4FIRE

Web editorial independiente del tracker FIRE. React + Vite, 16 artículos completos y 14 imágenes importadas de la carpeta Posts de Drive. El contenido se guarda localmente: no requiere que los lectores tengan acceso a Drive.

## Desarrollo

Desde esta carpeta, con Node 24+ (incluye SQLite) y pnpm:

```sh
pnpm install
pnpm dev
pnpm build
pnpm preview
pnpm test
```

En este equipo también funciona usando las dependencias del proyecto padre:

```sh
node ../node_modules/vite/bin/vite.js --configLoader runner --host 127.0.0.1 --port 5184 --strictPort
node ../node_modules/vite/bin/vite.js build --configLoader runner
```

Desarrollo: http://127.0.0.1:5184. Preview de producción: http://127.0.0.1:4184.

## Contenido

- `src/data/posts.json`: importación original conservada como fuente de migración; ya no se incluye en el bundle público.
- `.private/content.sqlite`: base de datos editorial con borradores, versiones publicadas, historial y acceso privado.
- `src/data/published.json`: exportación de las versiones publicadas. El servidor la actualiza al publicar y al arrancar. Se incluye en la web estática.
- `src/catalog.mjs` y `src/content.mjs`: extractos tomados del inicio de cada artículo, etiquetas, búsqueda y rutas.
- `public/images`: las 14 imágenes originales, convertidas a WebP.
- `src/App.jsx` y `src/styles.css`: catálogo, filtros combinables por OR, búsqueda sin acentos, lectura y diseño adaptable.
- Se excluyen de la publicación los borradores y apéndices de referencia añadidos al final de los documentos fuente de los posts 1 y 2.
- La calculadora FIRE permite simular acumulación o retirada, ajustar la tasa (3 %, 4 % o personalizada) y guardar los supuestos localmente. Cursos está disponible como sección preparada para contenido futuro.
- El post 15 contiene una referencia a una tabla cuyos datos no estaban en la fuente. Se indica que falta, sin inventarlos.
- El contenido histórico se conserva: esta importación no es una revisión editorial ni una actualización de sus afirmaciones financieras.
- Las portadas tipográficas de libros son diseños propios de esta web, no reproducciones de las cubiertas comerciales.

## Panel editorial local

Abre http://127.0.0.1:5184/#/admin con el servidor de desarrollo encendido. En el primer acceso, crea tu contraseña (mínimo 10 caracteres). No se ha preconfigurado ninguna contraseña real. Se guarda derivada con scrypt; las sesiones duran ocho horas y se cierran al reiniciar el servidor.

El panel permite crear posts, editar título, temas, texto, negrita, cursiva y enlaces, añadir imágenes PNG/JPEG/WebP de hasta 8 MB, reordenar bloques, seleccionar portada, guardar borradores, previsualizar, publicar y recuperar versiones anteriores como borrador. Las tablas importadas se conservan y se muestran en vista previa; todavía no tienen editor de celdas. Los enlaces de artículos ya publicados se mantienen estables. Si dos pestañas editan la misma versión, se rechaza la segunda escritura para evitar sobrescribir cambios.

«Guardar borrador» modifica solo SQLite. «Publicar» crea una copia de seguridad, publica las imágenes utilizadas y actualiza el contenido de la web local. Para actualizar una web alojada, ejecuta la compilación y sube `dist/`. El panel y su API solo funcionan en el servidor local de edición, con dirección y origen loopback; el panel de edición no se incluye en la compilación pública. No es un CMS multiusuario en Internet.

Las imágenes nuevas de borradores se guardan en `.private/media/`. Solo se copian a `public/images/` cuando se publica el artículo. Vite bloquea el acceso directo a `.private/` y `.import/`; las lecturas privadas necesitan sesión. Nunca publiques la carpeta del proyecto completa.

Los lectores pueden guardar favoritos desde las tarjetas y los artículos, y filtrarlos en el catálogo. Se guardan en ese navegador, sin cuenta ni sincronización entre dispositivos.

## Copias y recuperación

Cada publicación crea una copia SQLite y un archivo completo `.c4f.gz` en `.private/backups/`. El botón «Copia de seguridad» genera y descarga el archivo completo: incluye base de datos, borradores, historial, configuración de acceso y bibliotecas de imágenes públicas y privadas. Conserva alguna copia fuera de este ordenador; las copias automáticas permanecen en el mismo disco.

Para recuperar una versión de un artículo, usa «Historial de versiones» en el panel. La recuperación modifica el borrador, sin reemplazar la publicación actual.

Para recuperar una copia completa, detén primero el servidor local y ejecuta:

```sh
node scripts/restore-backup.mjs "ruta/al/archivo.c4f.gz" --confirm
```

La recuperación comprueba el archivo y crea una copia del estado actual antes de sustituirlo. Recupera también la contraseña existente en la copia. Después reinicia el servidor. El comando rechaza la restauración si el puerto local de edición 5184 sigue abierto. No se eliminan imágenes anteriores al restaurar.

Las pruebas de `tests/editorial.test.mjs` usan bases temporales e incluyen autenticación, separación borrador/publicado, conflictos de versión, privacidad de imágenes y restauración completa. `scripts/preview-editorial-fixture.mjs` abre una copia aislada para comprobar la interfaz en el puerto 5185; utiliza solo datos de prueba y no modifica la base real.

## Cursos, redes e identidad

`src/data/site.js` contiene los dos cursos en preparación y las direcciones de Instagram y X. Los botones de seguimiento permanecen desactivados mientras la dirección esté vacía. `src/Explore.jsx` presenta ambas secciones. El símbolo de marca está en `public/brand-mark.svg`; `public/logo.svg` es la versión cuadrada para los iconos instalables.

Los cursos permanecen en preparación; el panel editorial administra únicamente posts.

## Publicación

`dist/` es la carpeta completa para un alojamiento estático, incluso bajo una subcarpeta. Rutas por hash, sin necesidad de redirecciones en el servidor. La compilación incluye manifest, iconos y un service worker que precarga la aplicación, los 16 posts y sus imágenes para lectura sin conexión tras una primera visita correcta. La tipografía tiene alternativas locales si Google Fonts no está disponible.

«Instalar app» usa la instalación del navegador cuando está disponible o explica cómo añadirla a la pantalla de inicio. No es un APK ni una publicación en App Store. Para compartir con otras personas hace falta alojar `dist/` en una dirección HTTPS; la dirección localhost solo sirve en este PC.

El flujo `.github/workflows/pages.yml` comprueba los tests, compila la web y publica `dist/` en GitHub Pages al subir cambios a `main`. El repositorio debe configurar Pages con origen **GitHub Actions**. Si se publica como `xpalomoteruel/compounding4fire`, la dirección prevista es `https://xpalomoteruel.github.io/compounding4fire/`; no es utilizable hasta que el despliegue termine correctamente.

En Android, abre la web en Chrome y elige **Instalar aplicación** en el menú (o el botón «Instalar app» de la web). En iPhone, ábrela en Safari y elige **Compartir → Añadir a pantalla de inicio**. La instalación guarda la web como aplicación, sin pasar por una tienda.

La carpeta `.import/` contiene material temporal de importación y no debe publicarse. Publicar únicamente `dist/`.
