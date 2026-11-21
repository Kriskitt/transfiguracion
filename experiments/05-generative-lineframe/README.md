# Generative lineframe — Phase 05

Independent SVG experiment based on the byte-identical [`references/lineframe-05.svg`](./references/lineframe-05.svg). Run `python3 -m http.server 4185` from this folder and open `http://localhost:4185/`. `?seed=...` selects a reproducible variation. The comparison toggle displays the untouched original beside the generator.

## Direct measurements

`python3 analysis/analyze.py` regenerates [`analysis/geometry.json`](./analysis/geometry.json); add `--check` to verify reproducibility without writing. The analyzer parses all path commands and samples cubics for bounds and curvature. Direct XML counts and path coordinates are distinguished from sampled estimates.

| Property | Measured result |
| --- | --- |
| Source SHA-256 | `f896f4038106ad50ff2a29f1749326fb4170d5d82c0b2c6ddf62bd96afc3a40b` |
| ViewBox and hierarchy | 1920 × 1080; 310 groups, 307 paths, no SVG transforms |
| Commands | 307 moves, 1,250 cubic Béziers, 630 lines, 307 closes |
| Repeated shape | 302 six-span filled marks; five more complex corner/join paths |
| Template families | 12 translation-normalized coordinate signatures at 0.1-unit precision, including small export-rounding variants |
| Side runs | 97 upper, 98 lower, 54 left and 53 right six-span marks |
| Motif size | Long axis about 19.2 units, short axis about 3.52 units |
| Spacing | Median center pitch 19.3 units on all four runs; small gaps between consecutive long-axis bounds |
| Occupied bounds | Approximately x = 7.4–1912.6, y = 8.3–1071.6 |
| Drawing style | SVG default black fill, no stroke; white/transparent center |
| Negative space | No sampled geometry within x = 50–1870, y = 50–1030 |

The first regular path is a narrow, slightly slanted capsule with two line spans and four cubic end spans. Its opposite-edge counterparts have the same local construction after a half-turn, and side counterparts after quarter-turns. The 310 groups mostly reflect Illustrator nesting around individual paths; they are not 310 visually distinct designs. There are no `<use>` instances or transform attributes in the source. Similarity of normalized geometry supports repetition, but the original editing method is unknown.

## Inferred construction and generator

The working hypothesis is a **single tapered mark vocabulary** repeated on four perimeter runs, with a few special corner connections. The generator uses one source-measured canonical motif, converts it into seven controlled variants, and places instances along edge-specific runs. Correlated seed choices vary length and end curvature over small groups of adjacent marks. **Mark cadence** changes the repeat interval; **Mark length** changes the long axis; **End curvature** changes Bézier handle departure from a straight chord. The default desktop cadence was refined against the measured 19.3-unit pitch and reproduces each side's measured mark count.

SVG `<defs>` and `<use>` keep the DOM compact while retaining filled, un-stroked contours. Four small parametric elbows resolve the corners. The default outline is a composition of about 302 instances, seven definitions and four corner pieces, not hundreds of copied source paths. The source's precise five irregular corner paths are approximated.

Desktop uses the measured edge insets and near-regular pitch. Tablet and mobile recompute the four run lengths and motif count. Motifs scale uniformly; a minimum readable feature size stops the mobile frame from turning into a faint continuous line. The center stays empty. At very small live sizes, feature size is reduced to keep marks inside the viewport.

## Validation and limits

From the repository root:

```sh
node --test experiments/05-generative-lineframe/lineframe.test.js
npx vite build experiments/05-generative-lineframe --outDir /tmp/transf-lineframe-dist --emptyOutDir
```

All six experiment tests pass. They cover reproducible analysis and source integrity, path topology, seeded output, finite coordinates, transformed motif and corner bounds, parameter response, measured default cadence and production asset packaging. The main application's 15 tests and its production build also pass; this experiment builds independently without a project configuration change.

Chrome comparisons at 1920 × 1080, 1024 × 768 and 390 × 844 showed four readable dashed runs, a clear center, and no stretched marks or page errors. The default desktop run counts (97/98/54/53) and approximately 19.3-unit pitch match the measured source. The production build was served separately and rendered generated SVG in Chrome. Refinement tightened the run spacing after the first comparison, which had appeared too sparse.

The four parametric corner elbows approximate the five irregular exported joins. Fine end-cap differences and slight hand-adjusted alignment in the source remain outside the seven-variant vocabulary; the model reproduces the perimeter construction rather than replaying every path.
