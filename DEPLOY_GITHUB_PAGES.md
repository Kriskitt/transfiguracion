# Despliegue de Transfiguración en GitHub Pages

## Sitio y ramas

- Repositorio público: <https://github.com/Kriskitt/transfiguracion>
- Sitio: <https://kriskitt.github.io/transfiguracion/>
- `main` conserva la versión fuente local. La rama `deploy/github-pages` contiene exclusivamente las adaptaciones para alojamiento público y el workflow de publicación.
- GitHub Pages utiliza **GitHub Actions** como fuente. Cada push a `deploy/github-pages` ejecuta `.github/workflows/deploy.yml`; también puede iniciarse con `workflow_dispatch`. El artefacto se construye desde `dist/` durante el workflow y no se versiona.

## Ejecutar y verificar

```sh
npm ci
npm test
npm run build
npm run preview
```

El `base` de Vite es `/transfiguracion/`. Para una vista previa local, abre `http://localhost:4173/transfiguracion/` (o el puerto que indique Vite). Los módulos, SVG y WOFF2 se resuelven bajo ese prefijo. La navegación de Cámara, Pregunta, Archivo y About ocurre en una sola página, sin rutas profundas del navegador.

La experiencia pública presenta «Permitir cámara» al entrar, antes de llamar a `getUserMedia`. El video y la respuesta del formulario permanecen en el navegador; «enviar» es una confirmación simulada. Al acabar la secuencia, la pista se libera. Una nueva ejecución vuelve a solicitarla si es necesario. GitHub Pages proporciona HTTPS, requisito habitual para permisos de cámara fuera de localhost.

## Tipografía y derechos

Las fuentes Neue Haas originales tienen licencia comercial y no se incluyen en Git ni en el artefacto público. El CSS usa esas fuentes si están instaladas en el equipo del visitante y, en otros equipos, carga los pesos 300, 400 y 500 de Archivo desde `@fontsource/archivo`. Archivo está bajo SIL Open Font License 1.1; su texto de licencia se copia a `public/LICENSE-Archivo.txt`. Esta sustitución puede alterar ligeramente el ancho y la forma de algunas letras respecto del entorno local original. `refs_/`, `qa/`, `node_modules/`, `dist/` y datos privados tampoco se publican.

## Actualizar o revertir

1. Realiza los cambios de publicación en `deploy/github-pages`, ejecuta los comandos de verificación y haz push de esa rama. Consulta la ejecución de **Actions → Deploy Transfiguración to GitHub Pages** y la URL del sitio.
2. Para revertir un despliegue, revierte el commit problemático en `deploy/github-pages` con `git revert <commit>` y haz push. El workflow publica el artefacto de la versión revertida. Evita `push --force`.
3. Para incorporar cambios de `main`, intégralos primero en `deploy/github-pages`, conserva el `base`, el consentimiento y la fuente redistribuible, vuelve a probar y publica la rama de despliegue.

## Verificación manual con cámara física

Las pruebas automatizadas usan la cámara sintética de Chrome. En un navegador desktop con webcam real, abre la URL HTTPS, pulsa «Permitir cámara» y comprueba la solicitud de permiso, la secuencia visual, el cambio a Pregunta y que el indicador de la webcam se apague. Repite con `?seed=revision`, redimensiona durante el mosaico, prueba rechazo/reintento, logo, cursores, Archivo, About y el formulario. Esta revisión física queda a cargo de un equipo con acceso a la cámara y a las referencias visuales locales.
