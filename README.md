# Transfiguración V2.2

Obra web interactiva de cámara, pregunta, archivo tipográfico y videoarte. La captura, los efectos y las respuestas de la visita permanecen en el navegador; no hay backend, grabación ni envío de imágenes o textos.

## Ejecutar

```sh
npm install
npm run dev
npm test
npm run build
npm run preview
```

Abre la URL de Vite y pulsa **Permitir cámara**. En un servidor distinto de localhost se requiere HTTPS para usar la cámara. `?seed=ejemplo` reproduce el orden de fases y la geometría generativa; la imagen de la cámara sigue siendo impredecible. La compilación estática se genera en `dist/`, con rutas relativas. La rama `deploy/github-pages` publica el sitio mediante GitHub Actions en [Transfiguración](https://kriskitt.github.io/transfiguracion/); la rama fuente `main` conserva las fuentes locales con licencia fuera de Git.

## Recorrido

1. **Permiso:** solicita solo video. Si se deniega, falta una cámara o el navegador no soporta captura/WebGL2, muestra una explicación y una acción de reintento.
2. **CameraCapture:** 24 segundos desde el primer fotograma válido: fase 1 de 0–2 s; fases 2 y 3 aleatorias de 2–18 s, con intervalos de 0,5–1,5 s; collage obligatorio de 18–22 s; tratamiento blanco negativo de 22–24 s sobre esa composición. **Saltar** procesa el fotograma disponible y abre Quest. **Guardar** descarga un PNG del canvas sin controles. La pista se libera al entrar en la fase final.
3. **Quest:** pregunta «¿Qué existe en el futuro que imaginas?», respuesta opcional de hasta 333 caracteres. **Enviar** añade la respuesta no vacía al archivo de esta visita; **Archivo** entra sin enviarla; **Volver** y el logo reinician el flujo de cámara.
4. **Replies:** nueve textos de ejemplo más las respuestas de la visita. Escritorio: rueda/trackpad para Z y arrastre para X/Y, sin filtrado de planos distantes. Móvil: composición tipográfica desplazable verticalmente sin navegación Z.
5. **About:** modal sobre Quest o Replies; cierre con botón o Escape. **Ver videoarte** abre el WebM local. La página de video usa línea de tiempo con búsqueda, pausa/reproducción y cierre siempre hacia Quest.

Los textos añadidos viven solo en memoria y desaparecen al recargar. Los archivos de `experiments/` son previews independientes; el adaptador de Vite reutiliza sus funciones generadoras sin ejecutar esos previews dentro de la aplicación.

## Verificación local

`npm test` cubre reloj, secuencia sembrada, composición, cámara y repositorio. `node scripts/browser-v2.mjs` usa Chrome CDP en `127.0.0.1:9223` con cámara simulada y el servidor Vite en `127.0.0.1:5173`; deja capturas en `qa/v2/`. Para iniciarlo en macOS:

```sh
npm run dev -- --host 127.0.0.1
'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' --headless=new --use-fake-device-for-media-stream --use-fake-ui-for-media-stream --remote-debugging-port=9223 --user-data-dir=/tmp/transf-v2-chrome 'http://127.0.0.1:5173/?seed=qa-v2'
node scripts/browser-v2.mjs
```

La webcam sintética de Chrome verifica el flujo, no el aspecto de una captura física. Revisa con una cámara real el carácter del desenfoque, los fragmentos, la exposición final y el rendimiento en el navegador de exhibición.
