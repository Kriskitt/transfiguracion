# Generative ornament — Phase 06

Independent SVG experiment based on the byte-identical [`references/ornament-06.svg`](./references/ornament-06.svg). Run `python3 -m http.server 4186` from this folder and open `http://localhost:4186/`. `?seed=...` selects a reproducible variation; the comparison toggle shows the untouched original.

## Direct measurements

`python3 analysis/analyze.py` regenerates [`analysis/geometry.json`](./analysis/geometry.json); `--check` verifies it without writing. The analyzer parses all paths and samples cubics for bounds and handle statistics. XML counts, declared styles and clip polygons are direct measurements; sampled bounds and curvature are estimates.

| Property | Measured result |
| --- | --- |
| Source SHA-256 | `10634ab280049ce0b099a486743c03741c9a422650d033bfced5d232385dc303` |
| ViewBox and hierarchy | 1920 × 1080; 810 groups, 806 paths, one rectangle |
| Path commands | 20,956 cubic Béziers, 2,418 lines, 806 moves and 806 closes |
| Regular repetition | 798 regular 29-span motifs: 266 top, 266 bottom, 133 left and 133 right |
| Motif proportions | About 6.88 × 18.04 units on horizontal edges, quarter-turned on vertical edges; center pitch 6.9 units |
| Corner construction | Eight clipped paths, two triangular masks in each of four 18.1-unit corner squares |
| Defs and use | Eight polygon definitions and eight `<use>` references, all for corner masks; no source motif instancing or transform attributes |
| Template families | 21 translation-normalized signatures at 0.1-unit precision, mostly small export-rounding differences plus eight corner shapes |
| Drawing order | White `.st0` rectangle `(35.2, 73)` at 1849.5 × 934, then default black-filled, unstroked motif paths |
| Negative space | No sampled motif points in x = 45–1875, y = 83–997 |

The regular path is an ornate filled bar with a narrow straight shaft and rosette-like terminals. Its 29 spans contain 26 cubics and three lines. Repeated rounded terminals almost meet at the 6.9-unit pitch, making two continuous-looking rails around the large white field. The clipping masks are only used by the final eight corner paths. CSS classes `.st1`–`.st8` declare clip paths but are not assigned to elements; the actual corner paths use inline `clip-path` styles. The many groups reflect exported nesting, not hundreds of unique motifs.

## Inferred construction and generator

The working hypothesis is a **single four-way bar vocabulary**: translation builds each run, quarter-turns orient the sides, and two clipped enlarged copies resolve each corner. One source-measured canonical motif supplies the topology. Nine compact definitions vary terminal width while leaving the narrow shaft and overall length stable. A seed chooses nearby variants in correlated groups. **Motif cadence** changes repeat interval; **Rosette scale** changes the terminal spread; **Frame inset** moves the whole border while preserving its structure.

SVG `<defs>` and `<use>` render the dense border efficiently. The generated DOM contains nine motif paths, repeated instances, eight triangular clips, one white ground rectangle and thin connecting rails. It does not carry 806 independently copied source path strings. The rails were strengthened in the refinement pass after Chrome comparison showed they were weaker than the source at native size. Black fill and no stroke match the source paths.

Desktop follows the measured 6.9-unit pitch and all four repeat counts. Tablet and mobile recompute instance counts and insets for their artboards, keeping the motif's 6.88:18.04 proportion through uniform scaling. Mobile uses a minimum readable motif scale and retains a large empty field instead of stretching or cropping the desktop SVG.

## Validation and limits

From the repository root:

```sh
node --test experiments/06-generative-ornament/ornament.test.js
npx vite build experiments/06-generative-ornament --outDir /tmp/transf-ornament-dist --emptyOutDir
```

All six experiment tests pass. They cover reproducible analysis and source integrity, path/clip structure, seed determinism, finite placement, parameter response, measured repeat counts, narrow live viewport handling and corner triangle bounds. The main application's 15 tests and its production build also pass; this experiment builds independently without a project configuration change.

Chrome comparisons at 1920 × 1080, 1024 × 768 and 390 × 844 showed the linked four-sided ornament, a substantial empty center, legible terminals and valid corner clips without page errors. The default desktop run counts (266/266/133/133) and 6.9-unit pitch match the measured source. The production build was served separately and rendered generated SVG with all eight clips in Chrome. The refinement strengthened the connecting rails after the first comparison showed them too weak, and reduced the scale cap for very narrow live viewports.

The exact Illustrator corner paths, locally distorted terminals and tiny repeat-to-repeat coordinate differences remain approximations. The nine variant definitions preserve the regular motif topology and broad density but do not replicate every exported Bézier detail.
