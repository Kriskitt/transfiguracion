# Estado del proyecto — Transfiguración

Actualizado: 22 de octubre de 2026. Implementación integral de la experiencia de cámara, Pregunta, Archivo y About. Aplicación estática Vite + JavaScript vanilla + WebGL2; sin backend ni despliegue.

## Experiencia implementada

| Estado | Funcionamiento |
| --- | --- |
| Cámara (0–20 s) | Solicitud de video local sin audio; espera del primer frame; visión completa, desdoblamiento horizontal, mosaico progresivo, collage irregular, inversión y sobreexposición. |
| Pregunta | Fotograma final casi blanco con movimiento residual, pregunta fija provisional, respuesta opcional de hasta 333 caracteres, enviar con confirmación simulada, salir, volver y acceso a About/Archivo. |
| Archivo | Nueve textos de ejemplo distintos en planos XYZ; rueda para Z, arrastre para X/Y, límites, contador y coordenadas. |
| About | Modal sobre Pregunta o Archivo, logo animado, fondo desenfocado con velo blanco, cierre con botón o Escape y retorno del foco. |

La pista de cámara se libera al congelar el frame cerca del segundo 16. El video no se graba, almacena ni envía. El último frame permanece como textura WebGL para el tramo final y el fondo de Pregunta/Archivo. `?seed=...` reproduce las decisiones de composición; no puede reproducir el contenido de cámara. El mosaico conserva las **4 columnas × 3 filas** de la referencia y del ajuste previo durante sus tres mutaciones; cambian los recortes dentro de las celdas. Esas dimensiones siguen configurables en `src/config.js`.

## Herramientas y recursos usados

| Herramienta o recurso | Uso |
| --- | --- |
| Vite 8.3.0, npm y Node.js | Desarrollo, compilación y pruebas. Vite es la única dependencia declarada. |
| JavaScript ES modules, HTML y CSS | Estados, navegación, composición y vistas. |
| `getUserMedia`, `requestVideoFrameCallback`, `requestAnimationFrame`, `performance.now()` | Captura, primer frame, render y reloj. |
| WebGL2 / GLSL ES 3.00 | Una textura de video, fragmentos, desenfoque horizontal, inversión y sobreexposición. |
| CSS 3D transforms | Campo tipográfico XYZ de Archivo, sin librería 3D. |
| SVG y fuentes locales | Logos, marcos, cursores y Neue Haas Display Light/Roman/Medium. |
| Node `--test` | Pruebas de reloj, estados, cámara, composición, respuesta y límites XYZ. |
| Chrome Headless/CDP con webcam simulada | Recorrido visual e interacciones a 1920 × 1080. Las capturas de `qa/` son evidencia de esa fuente sintética. |

Las imágenes en `refs_/` solo sirvieron como referencias; no se importan en el runtime. `rsc_/about.rtfd/TXT.rtf` contiene instrucciones y no el texto curatorial. El texto de About se transcribió de la referencia visual en `src/data/about.js`.

Los cursores SVG originales se muestran a 36 × 36 px: cruz/cuadrado para el estado normal y aspa/rombo para botones, enlaces, textarea y la navegación XYZ. El hotspot se ubica en el centro (18, 18).

## Verificación y pendientes

La compilación base pasaba antes de los cambios. Las pruebas Node y el build final se registran en `IMPLEMENTACION_CODEX.md`. El recorrido automatizado con Chrome y webcam simulada cubre Cámara → Pregunta → About → envío vacío → Archivo → navegación XYZ → reinicio. Se verifican límites de 333 caracteres, liberación de la pista al llegar a Pregunta y cambios de tamaño del lienzo.

Pendientes reales: revisión artística y funcional con cámara física en el navegador objetivo, y sustitución de `QUESTION_TEXT` por la pregunta definitiva del autor. La captura sintética de Chrome no representa el aspecto de un rostro real. El render requiere WebGL2; si no está disponible se muestra un mensaje de error y reintento.

## Ejecución

```sh
npm install
npm run dev
npm test
npm run build
npm run preview
```

Para servirlo fuera de localhost se necesitará un origen HTTPS que permita cámara. La salida estática es `dist/`; no se ha desplegado.
