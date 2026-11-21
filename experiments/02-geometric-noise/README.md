# Geometric noise — Phase 02

Standalone Canvas 2D experiment based on the unmodified [`references/noise.svg`](./references/noise.svg). It shares no code, configuration, or dependencies with the main camera application.

## Run

From this directory:

```sh
python3 -m http.server 4174
```

Open `http://localhost:4174/`. A local HTTP server is needed because the page fetches `analysis/geometry.json`. The generator takes `?seed=...`; editing **Random seed** also updates the URL. **Regenerate** makes a new seed. **Cluster density** changes boundary erosion and growth. **Module size** scales the lattice. **Responsive preview** selects the live area or an exact target size. **Original / Generated** displays the untouched SVG next to the canvas.

## What the SVG measures

The complete extraction is in [`analysis/geometry.json`](./analysis/geometry.json), including a run-length encoded occupancy lattice. Measurements come from all 1,361 `<rect>` elements in the 1920 × 1080 viewBox:

| Property | Measured value |
| --- | --- |
| Module width | 24 SVG units for every rectangle |
| Module height | 7.6 for 1,360 rectangles; one at `(767.8, 663.3)` is 7.9 |
| Module proportion | 24 : 7.6, or about 3.158 : 1 |
| Horizontal adjacency | 1,001 exact same-row steps of 24.0; 64 of 23.9 |
| Vertical adjacency | 859 same-column steps of 7.6; 290 of 7.7; two exceptional steps of 7.4–7.5 |
| Approximate lattice | 24 columns pitch × 7.62 rows pitch; 79 occupied columns × 74 occupied rows |
| Occupied bounds | x = 0–1894.9; y = 335.7–899.9 |
| Four-neighbor structure | 52 components; 24 singletons; largest components have 777, 359, and 57 cells |
| Compactness | 1,065 horizontal neighbor pairs, 1,151 vertical pairs, and 898 complete 2 × 2 blocks |
| Palette | 1,298 default black modules; 63 class-filled variations, mostly very dark grays; two near-white fills; transparent background |

The modules share edges in dense areas. The largest component occupies the left part of the artboard, the second extends through the lower middle, and small groups sit at the far right. The middle-right interval from roughly x = 1,344 to 1,536 contains no modules. In 90-unit vertical bands, the peak counts are 395 at y = 450–540 and 351 at y = 540–630; there are none above y = 335.7 or below y = 899.9. Illustrator's decimal coordinates and several offset rows on the far right prevent one exact global origin from describing every rectangle.

## Inferred generation rules

One SVG cannot reveal the original authoring algorithm. This prototype treats its measured occupancy as a **structural prior**, not as a frame to copy unchanged. A seeded smooth displacement field samples the source lattice; neighborhood-dependent erosion and growth reshape boundaries, preserve compact interiors, and leave the broad voids largely open. A few isolated modules survive because they are present in the source structure. The default canvas uses black with sparse near-black variants, matching the SVG's monochrome appearance.

On wide screens, the lattice scales uniformly and remains centered vertically within the usable area. On narrow screens, modules are assigned to the three measured motif groups and arranged in a vertical sequence. Rectangle width and height always scale together. Canvas drawing overlaps adjacent fills by one device pixel to avoid raster seams; the generated geometry retains the source proportion.

## Validation and limits

Run the experiment tests from the repository root:

```sh
node --test experiments/02-geometric-noise/noise.test.js
```

The tests cover deterministic seeds, compact adjacency, occupied regions, the broad horizontal gap, density response, geometry, bounds, and mobile recomposition. Browser inspection was performed at 1920 × 1080, 1024 × 768, and 390 × 844, including the mobile comparison view. The generator is intentionally reference-conditioned: it varies the arrangement locally but does not invent an unrelated silhouette. At high **Module size** values, wide layouts can crop at the artboard edge; the size control acts as a zoom. Near-white source fills are rare and the generated palette approximates their frequency rather than preserving their exact coordinates.

For seed `reference` at default controls, the output contains 1,292 cells versus 1,361 in the SVG. The source and generated lattice have a 0.759 intersection-over-union; their complete 2 × 2 block counts are 898 and 906. In headless Chrome, 20 mobile-preview redraws averaged 5.1 ms each (maximum 5.9 ms, device pixel ratio 1). These figures describe one seed and machine, not a visual-equivalence guarantee or a universal performance bound.
