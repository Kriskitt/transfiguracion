# Implementación V2.0 — 21 de noviembre de 2026

## Mapa de arquitectura y fases

| Fase | Módulos y decisión |
| --- | --- |
| 01 Auditoría | `src/main.js` orquesta; `state.js` permite transiciones; `camera.js` espera el primer fotograma; `timeline.js` mide tiempo; `composition.js` crea celdas; `renderer.js` dibuja WebGL2; `views/archive.js` y `views/about.js` implementaban Archivo y modal. Se inspeccionaron `AGENTS.md`, estado, implementación anterior, pruebas, referencias desktop/móvil y experimentos 02–06 y timeline. |
| 02 Base visual | `src/styles.css` adopta los encuadres desktop/móvil, fuentes locales y cabecera; cursores SVG reducidos de 36 a 25,2 px con hotspot 13 px. El viewport permanece sin scroll salvo Replies móvil y el interior del modal. |
| 03 Permiso | `main.js` muestra una pantalla inicial explícita y solicita cámara al activar. `camera.js` mantiene una sola pista sin audio, espera frame y ofrece recuperación ante fallos. Reinicio consulta el permiso cuando la API lo permite. |
| 04 Cámara | `timeline.js` genera un plan reproducible de 24 s: 3 s iniciales de fase 1, 17 s centrales repartidos entre 4–7 apariciones de 1/2/3 y 4 s finales de fase 4. `composition.js` alterna mitad desenfocada, aumenta 1,4× el ritmo de eventos del mosaico y coloca base fotográfica bajo el collage. La fase final aplica inversión/exposición directamente; se conserva un PNG local del canvas para Quest y se cierra la pista. Saltar usa el primer frame válido; Guardar exporta solo el canvas. |
| 05 Quest | `src/effects/generative.js` reutiliza `generateFrame`, `generatePattern`, `generateOutline` y `generateOrnament`, con geometría JSON medida. `vite.config.js` elimina solo el arranque del preview al importar con `?generator`, sin modificar los experimentos. Orden: captura, marco 04, ruido 02, contorno 03. Pregunta y acciones exactas de V2. |
| 06 Replies | `src/data/replies.js` conserva nueve ejemplos y respuestas nuevas solo en memoria con ID e idempotencia. Archivo desktop mantiene XYZ y elimina la restricción artificial de visibilidad. Móvil monta una composición vertical propia con dos tamaños sembrados. |
| 07 About/Video | Modal existente conserva su estado, copia curatorial y foco; el ornamento 06 rodea la ventana. `src/views/video.js` reproduce el WebM original, con línea base 1,3 px, progreso 3,6 px, búsqueda y presentación rotada 90° en móvil. Cerrar vuelve a Quest. |
| 08–09 Integración | `src/main.js` coordina permisos, fondo preservado, navegación, recursos y resize; tests y Chrome CDP recorren la experiencia. |

Los previews originales no se modificaron. No se añadió ninguna dependencia ni servicio remoto. `src/renderer.js` y el shader existente se conservaron.

## Verificaciones realizadas

- `npm test`: 21/21 pruebas correctas. Se actualizaron aserciones V1 incompatibles con 24 s y el collage sin huecos.
- `npm run build`: compilación estática Vite correcta.
- `node scripts/browser-v2.mjs`: recorrido con webcam simulada, permiso, secuencia completa, PNG descargado, Quest, envío y respuesta visible, Z desktop, cambio desktop↔móvil, scroll móvil, modal, video, Escape/foco, vuelta a Quest, reinicio, Saltar y denegación simulada.
- Capturas y comprobaciones de overflow/controles a 1920×1080, 1440×900, 1024×768, 768×1024, 390×844 y 360×800 en `qa/v2/`. Las capturas no son video procesado de una cámara física.

## Límites y revisión artística

- Falta revisión con cámara física, equipo y navegador de exhibición. La webcam simulada produce bloques verdes y no permite juzgar rostros, textura del blur ni exposición.
- La correspondencia visual de geometría generativa procede de los algoritmos experimentales y ajustes CSS, por lo que requiere aprobación artística final frente a los PNG de referencia.
- En navegadores que bloquean autoplay, Video presenta **Reproducir**. El permiso de cámara al reiniciar depende del navegador.

## Refinamiento V2.1

- **Cámara:** `buildCameraSequence()` conserva la fase 1 inicial y genera grupos A (1–3 de 1/2/3), B (1–2 de 1/2/3) y C (1–2 de 2/3), con selección repetible por semilla y 24 s totales. La fase blanca procesa la última composición y la textura ya renderizada: no toma un fotograma limpio. Saltar crea una composición inicial si aún no existe; Guardar mantiene el canvas sin interfaz.
- **Quest/Replies:** La pregunta vuelve a usar `createExperimentalParagraph()` con escala horizontal independiente por palabra. Navegación, botones y enlace tienen la transición original `scaleX` de 180 ms. El generador 05 produce un marco de primer plano en ambas vistas; ruido 02 y contorno 03 bajan mediante CSS. Nuevas respuestas se insertan al principio del repositorio en memoria y del orden XYZ/vertical.
- **About:** El adaptador del ornamento 06 une los ocho extremos de rieles usando su geometría medida. El cuadro ajusta altura, posición, márgenes, logo y columna de texto para desktop, tablet y móvil; el enlace al video es mayor. Se conserva toda la copia curatorial y el control del estado modal.
- **Video:** El progreso sigue `currentTime / duration` mediante eventos del medio y `requestAnimationFrame` solo durante reproducción, incluidos pausa, búsqueda, fin y reapertura. El WebM local informa duración infinita en Chrome; `video-time.js` usa como respaldo los 88,44 s estimados a partir del último paquete del archivo, y cancela los listeners al cerrar. La etiqueta editorial `01:35 min` se mantiene tal como estaba.
- **Verificación:** `npm test` 24/24, `npm run build` correcto. `scripts/browser-v21.mjs` recorrió Quest, envío, Replies, About, Video, progreso y búsqueda con Chrome y cámara simulada; se inspeccionaron capturas a 1920×1080, 1440×900, 1024×768, 768×1024, 390×844 y 360×800. La cámara física y las dos imágenes nuevas mencionadas como “Image 1/2” no estaban disponibles en este entorno; la comparación del modal se hizo con `refs_/páginas/desktop/-Modal.png` y su versión móvil.
