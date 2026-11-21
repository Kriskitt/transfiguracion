# Generative outline — Phase 03

Standalone SVG experiment based on the unmodified [`references/outline-01.svg`](./references/outline-01.svg). It shares no code, configuration, or dependencies with the camera application or Phase 02.

## Run

From this directory:

```sh
python3 -m http.server 4175
```

Open `http://localhost:4175/`. The seed can also be supplied as `?seed=...`. **Regenerate** assigns a new seed; editing **Random seed** updates the URL. **Curve complexity** increases cubic sampling and the controlled shoulder and radius changes. **Loop density** adds or removes optional loops, weighted toward the right, while retaining the main gestures. **Responsive preview** selects the live area or an exact 1920 × 1080, 1024 × 768, or 390 × 844 artboard. **Original / Generated** shows the untouched source next to the procedural result.

## Measured vector construction

Run `python3 analysis/analyze.py` to regenerate [`analysis/geometry.json`](./analysis/geometry.json). The analyzer parses absolute and relative SVG path commands, samples the cubics, and records each subpath's control structure, length, area, bounds, direction change, and curvature. Lengths, curvature, areas, and boundary intersections are numerical estimates; the viewBox, path and command counts, coordinates, and CSS declarations come directly from the source.

| Property | Measured result |
| --- | --- |
| Artboard | `0 0 1920 1080` |
| Source integrity | SHA-256 `542b7e1c20bc7dd15aacd7e8cce5dcc8819c7ff147dc9d237ec544ad2c724c7f` |
| Topology | Three `<path>` elements with 1, 51, and 1 closed subpaths; the middle path dominates |
| Curves | 1, 811, and 3 cubic spans; four line spans in the main path |
| Main path length | About 22,312 SVG units across its contour boundaries |
| Drawn bounds | Approximately x 12.3–1907.7, y 321.3–758.8 |
| Main outer contour | One negative-wound contour, x 12.3–1907.7, y 321.3–758.8; length about 5,544 |
| Interior contours | 47 positive-area contours; three nearly degenerate; median interior box about 109 × 81 units |
| Cubic scale | Median chord 17.2 units; median first/second control handles 5.69/5.86 units; median adjacent tangent angle 0.73° |
| Cubic length | Median about 17.2 units; 90th percentile about 69.2 units |
| Direction and curvature | Median cubic tangent turn 6.75° (90th percentile 26.73°); median sampled absolute curvature 0.005686 inverse units (90th percentile 0.109599) |
| Spatial density | Interior-contour centers in 240-unit x bands: 1, 2, 7, 4, 9, 17, 10, 0 from left to right |
| Overlap | 115 pairs of interior contour bounding boxes overlap; sampled contour boundaries intersect twice |
| Styling | `.st0` has white fill, black stroke, `stroke-miterlimit:10`; unspecified stroke width defaults to 1 SVG unit. The default nonzero fill rule applies. |

The sampled boundary crossing count is **not** the number of visible gestural crossings. Illustrator exported a compound filled shape whose outer contour and reverse-wound interior contours resolve most overlaps without intersecting their own boundaries. The black line traces the perimeter of the white shape, giving the appearance of a narrow doubled outline. The two tiny other paths around `(1561, 465)` and `(1560, 468)` contribute almost nothing visible. The upper and lower thirds of the artboard are largely empty. Most of the gesture runs left to right through a middle band; the right half has denser overlapping loops, while a broad isolated loop occupies the far left.

## Inferred generative model

One exported SVG cannot prove how the artist drew it. This prototype uses a **gesture grammar**, not copied or randomly perturbed source path coordinates. Three continuous centerlines travel horizontally. The broad left loop is comparatively isolated; compact gestures accumulate across the center and intersect in a clustered right-hand zone. This progression is informed by the measured interior-contour distribution, whose strongest bands are x = 1200–1680.

Each loop starts from an elliptical excursion but is deformed by a low-frequency angular warp, an uneven radial bulge, and an asymmetric shoulder. Its position, eccentricity, and slant vary through a seeded correlated walk. Adjacent Bézier handles receive unequal lengths from a smooth phase field, preserving tangent direction at their joins. Entry angles, sweep lengths, and winding vary between gestures; cubic bridges follow departure and arrival tangents with asymmetric handles. These linked changes create irregular turning radii and occasional reversals without point-by-point jitter. The optional-loop probability increases toward the right, while required loops preserve the broad negative-space structure. The seed controls every geometry decision.

Each centerline is rendered twice: a 6-unit black stroke followed by a 4-unit white stroke, creating approximately 1-unit black edges around a white ribbon. This mimics the source's white fill and black perimeter, but it does **not** recreate its exact compound fill or winding at crossings. SVG was chosen over Canvas 2D because cubic paths and strokes remain crisp under the preview's arbitrary scaling, and the same markup works without a raster redraw loop or extra dependency.

On desktop and tablet, the horizontal gesture sequence scales uniformly and stays centered vertically, keeping curvature and ribbon width proportional. In portrait layouts below a 0.72 aspect ratio, three differently proportioned gestures are recomposed into stacked bands so loops remain legible at 390 × 844. The portrait bands differ in height, slant, direction, and degree of overlap. A final uniform fit is applied only when a seeded variation approaches an artboard edge; it prevents clipping without distorting the curves. The source comparison always shows the original wide artboard at its own aspect ratio.

## Validation and artistic limits

From the repository root:

```sh
node --test experiments/03-generative-outline/outline.test.js
npx vite build experiments/03-generative-outline --outDir /tmp/transf-outline-dist --emptyOutDir
```

The tests cover source integrity, exact topology counts, seed determinism, finite connected cubics, control response, loop asymmetry, distinct portrait bands, localized crossings, and coordinate bounds for the three target sizes and multiple seeds. Chrome inspection covered 1920 × 1080, 1024 × 768, and 390 × 844, including source comparison, regeneration, SVG bounds, ribbon attributes, and absence of page errors or overflow. A separate 240-composition sample across four viewport sizes, two density settings, and 30 seeds had no sampled out-of-bounds points; the largest automatic fit reduced scale by about 5.3%.

At the default `reference` seed, the generated centerlines have about 32 sampled crossings in x = 1200–1680 versus about 21 in x = 0–720. These are **centerline** crossings and cannot be compared directly with the source's two sampled **compound-boundary** intersections. Side-by-side inspection shows a clearer isolated-left to dense-right progression and less elliptical loop shape. The generated middle remains more open and its crossings more orderly than the Illustrator compound path; the three separately stroked ribbons also lack the source's exact nonzero-winding cutouts and crossing order. A future artistic pass could build a true compound ribbon topology and tune its interior contours against the source. These are visual fidelity limits, not missing runtime assets.
