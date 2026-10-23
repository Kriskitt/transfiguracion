# Implementación Codex — 22 de octubre de 2026

## Entrega

Se completaron Cámara, Pregunta, Archivo y About según `TRANSFIGURACION_CODEX_MASTER.md`, manteniendo Vite, JavaScript vanilla y WebGL2. La transición desde el primer frame útil hasta Pregunta dura aproximadamente 20 s. Cámara se libera al congelar el fotograma cerca del segundo 16; el shader continúa invirtiendo y sobreexponiendo la textura local, que luego conserva un movimiento residual sutil.

## Archivos

- Modificados: `index.html`, `package.json`, `src/main.js`, `src/config.js`, `src/camera.js`, `src/composition.js`, `src/renderer.js`, `src/timeline.js`, `src/ui.js`, `src/styles.css`, `rsc_/cursor-01.svg`, `rsc_/cursor-02.svg`, `ESTADO_PROYECTO.md`.
- Creados: `src/state.js`, `src/response.js`, `src/archive-math.js`, `src/data/about.js`, `src/data/archive.js`, `src/views/about.js`, `src/views/archive.js`, `src/effects/frame-paths.js`, `src/effects/logo.js`, `src/effects/typography.js`, `tests/`, `scripts/browser-smoke.mjs`, `scripts/browser-permission.mjs`, `README.md`, este documento y el plan local en `docs/superpowers/plans/`.
- Se añadió a la raíz `TRANSFIGURACION_CODEX_MASTER.md`, que al iniciar solo estaba disponible en el directorio de respaldo contiguo. No se borraron los recursos ni las exploraciones originales.

## Decisiones gráficas y técnicas

- Los fragmentos del collage proceden de una única textura del video de cámara; tienen recortes UV, tamaños, solapes y orientaciones variables. Una prueba de cobertura comprueba que quedan intersticios blancos. Los trazos magenta de las referencias nunca se dibujan.
- El tramo de mosaico mantiene las 4 columnas × 3 filas de `vista2-grid.png` y de la configuración previa. Sus tres mutaciones aumentan los recortes alterados sin cambiar ese número de celdas.
- El blur horizontal, la inversión de luminancia y la sobreexposición se ejecutan en GLSL. La textura congelada evita reabrir cámara en las vistas posteriores.
- Marcos y logos SVG se animan a partir de la geometría original. El Archivo usa perspectiva CSS y textos locales distintos; no incorpora respuestas simuladas como datos.
- `?seed=` controla composiciones y sus mutaciones; no modifica el video del usuario ni su privacidad.
- Las referencias PNG y las exploraciones HTML se inspeccionaron como guía; ningún PNG se muestra en runtime.
- Los dos SVG de cursor declaran ahora 36 × 36 px y un hotspot central (18, 18), el doble de su tamaño inicial integrado. El cursor de acción cubre botones, enlaces, respuesta y arrastre XYZ; el normal cubre el resto de la experiencia.

## Pruebas y revisión

- `npm test`: 15 pruebas, 15 correctas. Incluye límites temporales y de mutación, estados, permiso tardío, espera del primer frame, cobertura del collage, semilla, respuesta vacía y límites XYZ.
- `npm run build`: correcto, 25 módulos transformados. `npm run preview` respondió HTTP 200 en localhost. La compilación base anterior a los cambios también pasó.
- Chrome Headless con webcam sintética: recorrido Cámara → Pregunta → About → enviar vacío → Archivo → scroll Z → arrastre X/Y → About sin perder coordenadas → reinicio. Verifica además 333 caracteres al insertar 340, hover 100→200%, foco retenido en el modal, Escape, ausencia de excepciones de página y pista liberada en Pregunta. Si se abre About durante la confirmación simulada, la navegación a Archivo espera al cierre del modal.
- Sesión independiente de Chrome: permiso denegado, botón de reintento, cámara reanudada y resize 1920×1080 → 1440×900 → 1920×1080 correctos.
- Las cinco exploraciones HTML cargaron en Chrome Headless. Se revisaron capturas a 1920 × 1080 en `qa/` frente a las referencias. La fuente visual era sintética y no equivale a una prueba con cámara real.

## Pendientes reales

- Sustituir `QUESTION_TEXT` por la pregunta editorial final.
- Revisar composición, permisos y rendimiento con cámara física y navegador de destino.

El recurso `rsc_/about.rtfd/TXT.rtf` contiene instrucciones, no el texto curatorial; `src/data/about.js` transcribe el texto legible en `refs_/páginas/about-popup.png`.

No se añadieron dependencias, servicios externos ni despliegues.
