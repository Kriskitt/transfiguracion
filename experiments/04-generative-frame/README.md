# Generative frame — Phase 04

Standalone SVG experiment based on the byte-identical [`references/marco-04.svg`](./references/marco-04.svg). It shares no code, configuration, or dependencies with the main application or the earlier experiments.

## Run

From this directory:

```sh
python3 -m http.server 4177
```

Open `http://localhost:4177/`. `?seed=...` sets a reproducible variation. **Regenerate** assigns a new seed; editing **Random seed** updates the URL. **Step complexity** merges or divides upper step spans, changing the number of turns. **Geometric irregularity** changes the frequency and amplitude of local nicks, short curves and reversals while keeping the main contour anchors fixed. **Frame density** changes how far the profiles enter the canvas and the size of the two detached apertures. **Responsive preview** selects Live, 1920 × 1080, 1024 × 768 or 390 × 844. **Original / Generated** displays the unmodified source next to the generator.

## Measured source geometry

Run `python3 analysis/analyze.py` to regenerate [`analysis/geometry.json`](./analysis/geometry.json). The script parses absolute and relative `M`, `L`, `H`, `V`, `C` and `Z` commands and measures all seven paths and both rectangles. Cubic lengths and bounds are sampled estimates. Counts, declared style, rectangle geometry and repeated segment coordinates are taken directly from the SVG.

| Property | Measured result |
| --- | --- |
| ViewBox | `0 0 1920 1080` |
| Source integrity | SHA-256 `e69b8be0d59164b6cdaf933658463719a8e90fd8b3bccca220e7713bf7478c06` |
| Topology | Seven paths with 1, 2, 2, 1, 1, 1, 1 subpaths; two rectangles |
| Dominant contour | Path 4: 104 line spans, 95 cubic spans, sampled perimeter length about 6485 units; it reaches every artboard edge |
| All path spans | 222 lines and 192 cubics; 74 near-horizontal lines, 72 near-vertical, 76 short oblique lines |
| Orthogonal weight | Near-horizontal and near-vertical line lengths total about 12,636 units versus 793 units of other lines; about 94% of straight-line length |
| Step scale | Median horizontal span 44.8 units; median vertical span 36.81 units; largest runs include the canvas-edge lines |
| Axis deviation | Median off-axis drift 0.1 unit for both horizontal and vertical line classes; 90th percentile 0.4–0.5 unit |
| Curve transitions | Median cubic chord 7.84 units; 44 cubics have chords shorter than 5 units. Of 192 cubic midpoints, 86 are in the right region. |
| Repeated geometry | Paths 0 and 4 share nine exact 0.1-unit segments; paths 2 and 4 share five; paths 1 and 6 share two. The upper rectangle repeats all four sides of path 2's second subpath; three lower-rectangle sides repeat path 5. |
| Detached apertures | `(1731.4, 229.4)` at `44.9 × 136.7`; `(1635, 1011.1)` at `145.7 × 68.9` |
| Central space | No sampled path points in x = 250–1200, y = 320–850 |
| Stroke | `.st0` declares `fill:none`, black stroke, width `0.5` and miter limit `10` |

### Boundary measurements added in Phase 04.5

The upper contour of path 2 contains five long treads of **142.1, 114.3, 112.3, 121.2 and 106.0** units; a further 35-unit horizontal span leads into the rough shoulder. Its directly measurable straight risers are **19.1, 13.0, 22.3, 31.5 and 34.2** units. Curved corners add to some of those changes in height. The reference right edge descends almost vertically around x = 1596 from y = 397 to 459. Sampled path 2 points reach their lowest point at **(1697.05, 534.83)**; the worked transition from x ≈ 1401 to 1920 contains **80 segments**, including **45 cubic chords shorter than 16 units**.

The dominant path has **45 short cubics and 24 short lines** in the right region, compared with 15/6 at the left, 10/6 at the top and 10/10 at the bottom. Direction changes above 20° number 53 on the right, 27 on the left, 20 at the bottom and 18 at the top. The right-side cubic deviation from each chord has a median of 0.57 units and a 90th percentile of 2.1 units; the largest is 4.18. Across the frame, long axis-aligned spans still dominate: path 4 has 19 such runs at the left, 11 at the bottom, 9 at the top and 4 at the right. These counts use region cutoffs and span thresholds recorded in `analysis/analyze.py`; lengths and curve extrema are sampled estimates. They distinguish the **macro** runs and valley shape from the **micro** fragments and small bends.

The source has a broad top-left and left-side staircase, an upper run that drops in irregular steps across the canvas, a heavily worked right-hand transition, a shallow lower-right curve and a bottom staircase. Small cubic spans soften or disturb otherwise square corners. The line-work is not a symmetric frame: the right boundary has a rough descending and rising interruption, while the left edge is almost entirely orthogonal. Exact shared segments show that several paths retrace sections of the dominant contour. The rectangles are likewise partly or wholly retraced. These overlaps can slightly darken lines despite the consistent declared stroke width.

## Inferred construction and generator

One Illustrator export cannot prove the original authoring sequence. The evidence supports a **shared perimeter grammar with retraced fragments**, rather than seven unrelated strokes or a mirrored left/right motif. The generator creates one closed edge-anchored contour, then derives six shorter paths from sections of that same contour. This makes alignment exact while preserving the source's fragmented, occasionally doubled edge. Two detached rectangles occupy analogous upper-right and lower-right positions.

Upper steps now derive from the five measured tread/riser pairs. The complexity control joins or splits these spans rather than adding evenly spaced points. A seeded, correlated variation changes their relative dimensions; two turns receive small localized nicks. Left-side step depths vary together within narrow limits, and two joins have short curved imperfections. The lower-right slope uses a few gently uneven cubic spans and a rounded transition into the first bottom step.

The right boundary is built in two scales. Fixed anchor points preserve the descending shoulder, near-vertical drop, short valley floor, asymmetric rise and edge contact. Detail is concentrated on the broken shoulder and rising side: correlated lateral displacement, uneven Bézier handles, a few short straight spans and controlled local reversals. The long plateau and vertical drop stay comparatively quiet. A separate seed stream drives this detail, so changing irregularity does not move the large step and valley anchors. The center remains empty.

SVG preserves the thin vector stroke and exact contour sharing. Every generated shape uses transparent fill and a 0.5-unit black stroke. `vector-effect: non-scaling-stroke` keeps the apparent line width steady when the preview is resized. No raster or new dependency is needed.

Desktop follows the source's four-edge composition. Tablet recomputes step spans and edge anchoring at its own width and height. Portrait uses fewer upper steps, a longer right-hand descent, and vertically distributed left steps; the source is not stretched into a tall artboard. The detached rectangles retain their proportions and are bounded for narrow live viewports.

## Validation and limits

From the repository root:

```sh
node --test experiments/04-generative-frame/frame.test.js
npm test
npm run build -- --outDir /tmp/transf-main-dist --emptyOutDir
npx vite build experiments/04-generative-frame --outDir /tmp/transf-frame-dist --emptyOutDir
```

The experiment tests cover source integrity, measured boundary detail, determinism, valid and finite SVG paths, orthogonal weight, contour sharing, macro silhouette stability under irregularity changes, local right-side reversals, meaningful step segmentation, central space, controls, bounds, responsiveness and stroke consistency. A 480-composition sweep across three sizes, 20 seeds and both extremes of all three sliders found finite, bounded control points and no desktop central-space incursions. Chrome comparison at all three breakpoints confirmed the measured trough, unequal stairs, boundary framing, thin strokes and clear center; the preview, seed, regenerate and comparison controls also worked without page errors. The right edge is visibly more fragmented, but it remains smoother and more orderly than the exact Illustrator contour in places. Its tiny self-overlaps and individual hand-drawn kinks are not copied. Mobile is a deliberate vertical recomposition of the same grammar, not a direct coordinate map.
