# Transfiguración

Obra web de cámara y archivo tipográfico. La captura y el procesamiento ocurren localmente en el navegador. La aplicación usa Vite, JavaScript vanilla, CSS y WebGL2; no tiene servidor de aplicación, grabación ni persistencia de respuestas.

## Iniciar

```sh
npm install
npm run dev
```

Abre la URL que indique Vite y concede acceso a la cámara. El reloj empieza cuando llega el primer fotograma válido. Tras unos 20 segundos aparece Pregunta. Si el navegador deniega o no puede abrir la cámara, usa «Permitir cámara» o «Reintentar». Para repetir decisiones gráficas, añade `?seed=ejemplo` a la URL.

```sh
npm test
npm run build
npm run preview
```

`npm run build` genera `dist/`, apto para alojamiento estático en un origen HTTPS. No se han configurado infraestructura ni despliegues. La cámara suele requerir HTTPS fuera de localhost.

**Distribución pública:** los TTF comerciales de Neue Haas y las imágenes de referencia quedan fuera de Git. Para compilar esta rama fuente desde un clon limpio, coloca copias con licencia de `NeueHaasDisplayLight.ttf`, `NeueHaasDisplayRoman.ttf` y `NeueHaasDisplayMediu.ttf` en `rsc_/fonts/`. La rama `deploy/github-pages` utiliza una fuente libre de respaldo y puede compilarse sin esos archivos.

## Recorrido

1. **Cámara:** imagen completa, desenfoque y división, mosaico, collage irregular; al segundo 16 se congela la textura y se libera la pista. Inversión y sobreexposición llevan a Pregunta sin pantalla intermedia.
2. **Pregunta:** escribe hasta 333 caracteres o deja la respuesta vacía. «enviar» confirma una simulación y abre Archivo; «salir» lo abre de inmediato; «volver» o el logo reinician Cámara. About abre un modal sin perder la respuesta escrita.
3. **Archivo:** la rueda/trackpad o las teclas de navegación recorren la profundidad Z; el arrastre con botón/puntero mueve X/Y dentro de límites. «Archivo» activo conserva la posición actual. El logo reinicia Cámara.
4. **About:** se superpone a Pregunta/Archivo, conserva la posición del fondo y se cierra con «cerrar» o Escape.

## Editar contenido y ritmo

- Pregunta definitiva: sustituir la constante **`QUESTION_TEXT`** en `src/config.js`. El valor actual está marcado como provisional.
- Textos de ejemplo del Archivo: `src/data/archive.js`. No se añade la respuesta del visitante al archivo.
- Texto de About: `src/data/about.js`; se transcribió de la referencia visual porque `rsc_/about.rtfd/TXT.rtf` contiene instrucciones.
- Tiempos, número de columnas y filas, blur y collage: `src/config.js`. Lógica de composición: `src/composition.js`.

## Estructura

| Ruta | Función |
| --- | --- |
| `src/main.js`, `src/state.js`, `src/timeline.js` | Orquestación, estados y reloj. |
| `src/camera.js`, `src/composition.js`, `src/renderer.js` | Captura, celdas y WebGL2. |
| `src/views/`, `src/effects/`, `src/data/` | Archivo/About, logos/marcos/tipografía y contenido. |
| `rsc_/` | Logos, fuentes y cursores originales. |
| `refs_/` | Referencias visuales y exploraciones; no se sirven como imagen de la obra. |
| `tests/`, `scripts/browser-smoke.mjs`, `qa/` | Pruebas de lógica y evidencia visual con cámara simulada. |

## Límites actuales

Requiere WebGL2 y permiso de cámara. La composición es desktop-first; una adaptación final para móvil/tablet queda fuera de este encargo. La respuesta solo vive en el campo hasta salir de Pregunta: «enviar» muestra una confirmación simulada, sin transmisión ni almacenamiento. El aspecto con cámara física sigue pendiente de revisión local por el equipo artístico.

Para esa revisión, abre `npm run dev` en un desktop con cámara física y WebGL2; concede permiso, observa los seis tramos hasta Pregunta y confirma que el indicador físico de cámara se apaga cerca del segundo 16. Repite con `?seed=revision`, cambia el tamaño de la ventana durante el mosaico y el collage, abre/cierra About, recorre Archivo con rueda y arrastre, y prueba «volver»/logo para iniciar otra captura. Después deniega el permiso en el navegador y comprueba el botón de reintento. Las capturas de `qa/` proceden de una webcam sintética de Chrome y sirven para comparar layout, no calidad fotográfica.
