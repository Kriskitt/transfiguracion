import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { generateFrame } from './frame.js';

const here = new URL('./', import.meta.url);
const make = (width = 1920, height = 1080, seed = 'reference', complexity = 0.5,
  irregularity = 0.5, density = 0.5) =>
  generateFrame({ width, height, seed, complexity, irregularity, density });

test('analysis describes the byte-identical source, topology, and shared boundaries', () => {
  const source = readFileSync(new URL('references/marco-04.svg', here));
  const geometry = JSON.parse(readFileSync(new URL('analysis/geometry.json', here)));
  assert.equal(createHash('sha256').update(source).digest('hex'), geometry.sha256);
  assert.deepEqual(geometry.measured.viewBox, [0, 0, 1920, 1080]);
  assert.equal(geometry.measured.pathCount, 7);
  assert.equal(geometry.measured.rectangleCount, 2);
  assert.deepEqual(geometry.measured.paths.map(path => path.subpathCount), [1, 2, 2, 1, 1, 1, 1]);
  assert.equal(geometry.measured.centralEmptyRegion.sampledPointCount, 0);
  assert.ok(geometry.measured.sharedPathSegments.length >= 2);
});

test('seed reproduces the complete frame and changes the geometry when changed', () => {
  const first = make(1920, 1080, 'alpha');
  assert.deepEqual(first, make(1920, 1080, 'alpha'));
  assert.notDeepEqual(first.paths.map(path => path.d), make(1920, 1080, 'beta').paths.map(path => path.d));
});

test('frame paths are finite, valid, connected, and mostly orthogonal', () => {
  const result = make();
  assert.ok(result.paths.length >= 5);
  assert.match(result.paths[0].d, /^M[-\d.]+,[-\d.]+(?: [LC][-\d., ]+)+ Z$/);
  let axisLength = 0, totalLineLength = 0;
  for (const path of result.paths) {
    assert.ok(!path.d.includes('NaN') && !path.d.includes('Infinity'));
    for (const [index, segment] of path.segments.entries()) {
      assert.ok(Object.values(segment).flat().filter(Number.isFinite).length >= 4);
      assert.ok(segment.from.every(Number.isFinite) && segment.to.every(Number.isFinite));
      if (index) assert.deepEqual(segment.from, path.segments[index - 1].to);
      if (segment.type === 'L') {
        const dx = segment.to[0] - segment.from[0];
        const dy = segment.to[1] - segment.from[1];
        const length = Math.hypot(dx, dy);
        totalLineLength += length;
        if (Math.abs(dx) < length * 0.02 + 1 || Math.abs(dy) < length * 0.02 + 1) axisLength += length;
      }
    }
  }
  assert.ok(axisLength / totalLineLength > 0.8);
});

test('secondary contours retrace the same primary geometry', () => {
  const result = make();
  const source = new Set(result.paths[0].segments.map(segment => JSON.stringify(segment)));
  for (const fragment of result.paths.slice(1)) {
    assert.ok(fragment.segments.length > 0);
    assert.ok(fragment.segments.every(segment => source.has(JSON.stringify(segment))));
  }
});

test('center stays empty while geometry reaches all four boundaries', () => {
  const result = make();
  const points = result.paths[0].samples;
  assert.ok(points.some(([x]) => x === 0));
  assert.ok(points.some(([x]) => x === 1920));
  assert.ok(points.some(([, y]) => y === 0));
  assert.ok(points.some(([, y]) => y === 1080));
  assert.ok(points.every(([x, y]) => !(x > 250 && x < 1200 && y > 320 && y < 850)));
});

test('controls alter step count, contour imperfection, and intrusion', () => {
  const simple = make(1920, 1080, 'controls', 0);
  const complex = make(1920, 1080, 'controls', 1);
  assert.ok(complex.stepCount > simple.stepCount);
  const exact = make(1920, 1080, 'controls', 0.5, 0);
  const irregular = make(1920, 1080, 'controls', 0.5, 1);
  assert.notEqual(exact.paths[0].d, irregular.paths[0].d);
  const light = make(1920, 1080, 'controls', 0.5, 0.5, 0);
  const dense = make(1920, 1080, 'controls', 0.5, 0.5, 1);
  assert.ok(dense.maxIntrusion > light.maxIntrusion);
});

test('desktop, tablet and mobile recompose steps inside their artboards', () => {
  for (const [width, height, layout] of [[1920, 1080, 'wide'], [1024, 768, 'wide'], [390, 844, 'portrait']]) {
    const result = make(width, height, 'bounds', 1, 1, 1);
    assert.equal(result.layout, layout);
    for (const path of result.paths) {
      for (const [x, y] of path.samples) {
        assert.ok(x >= 0 && x <= width && y >= 0 && y <= height,
          `${width}×${height}: ${x},${y}`);
      }
    }
    for (const rect of result.rectangles) {
      assert.ok(rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= width && rect.y + rect.height <= height);
    }
  }
  assert.ok(make(1920, 1080).stepCount > make(390, 844).stepCount);
});

test('all rendered geometry has transparent fill and one thin stroke width', () => {
  const result = make(390, 844);
  assert.equal(result.strokeWidth, 0.5);
  assert.ok(result.paths.every(path => path.fill === 'none' && path.strokeWidth === result.strokeWidth));
  assert.ok(result.rectangles.every(rect => rect.fill === 'none' && rect.strokeWidth === result.strokeWidth));
});

test('right transition has localized deviations instead of a straight diagonal', () => {
  const rough = make().paths.find(path => path.role === 'roughRight').segments.slice(0, 7);
  const first = rough[0].from, last = rough.at(-1).to;
  const deviations = rough.map(segment => {
    const [x, y] = segment.to;
    const lineY = first[1] + (x - first[0]) / (last[0] - first[0]) * (last[1] - first[1]);
    return Math.abs(y - lineY);
  });
  assert.ok(Math.max(...deviations) > 5, `deviations: ${deviations}`);
});

test('a narrow live viewport keeps detached rectangles within the frame', () => {
  const result = make(10, 100, 'narrow');
  assert.ok(result.rectangles.every(rect => rect.x >= 0 && rect.x + rect.width <= 10 &&
    rect.y >= 0 && rect.y + rect.height <= 100));
});

test('measured contour detail separates large steps from local right-hand fragments', () => {
  const geometry = JSON.parse(readFileSync(new URL('analysis/geometry.json', here)));
  const detail = geometry.measured.boundaryDetail;
  assert.ok(detail.upperStepTreads.length >= 5);
  assert.ok(detail.upperStepRisers.length >= 4);
  assert.ok(detail.rightValley.lowestPoint[0] > 1680 && detail.rightValley.lowestPoint[0] < 1730);
  assert.ok(detail.rightValley.lowestPoint[1] > 525 && detail.rightValley.lowestPoint[1] < 545);
  assert.ok(detail.shortCubicCounts.right > detail.shortCubicCounts.left + detail.shortCubicCounts.bottom);
});

test('irregularity changes local right detail while preserving the main silhouette', () => {
  const plain = make(1920, 1080, 'macro', 0.5, 0);
  const worked = make(1920, 1080, 'macro', 0.5, 1);
  for (const role of ['topSteps', 'lowerLeft', 'lowerRight']) {
    const a = plain.paths.find(path => path.role === role).segments;
    const b = worked.paths.find(path => path.role === role).segments;
    const extent = segments => [Math.min(...segments.map(s => s.to[0])),
      Math.max(...segments.map(s => s.to[0])), Math.min(...segments.map(s => s.to[1])),
      Math.max(...segments.map(s => s.to[1]))];
    assert.ok(extent(a).every((value, index) => Math.abs(value - extent(b)[index]) < 3), role);
  }
  const right = worked.paths.find(path => path.role === 'roughRight').segments;
  const shortCurves = right.filter(segment => segment.type === 'C' &&
    Math.hypot(segment.to[0] - segment.from[0], segment.to[1] - segment.from[1]) < 16);
  assert.ok(shortCurves.length >= 12, `short right curves: ${shortCurves.length}`);
  assert.ok(right.length > plain.paths.find(path => path.role === 'roughRight').segments.length);
  const folds = right.filter(segment => segment.to[0] < segment.from[0] - 2 &&
    ((segment.from[0] > 1460 && segment.from[0] < 1560) ||
      (segment.from[0] > 1740 && segment.from[0] < 1840)));
  assert.ok(folds.length >= 2, `localized reversals: ${folds.length}`);
});

test('step complexity changes the number of turns, with unequal tread and riser spans', () => {
  const simple = make(1920, 1080, 'steps', 0, 0.7).paths.find(path => path.role === 'topSteps');
  const complex = make(1920, 1080, 'steps', 1, 0.7).paths.find(path => path.role === 'topSteps');
  const spans = path => path.segments.filter(s => s.type === 'L').map(s => [
    Math.abs(s.to[0] - s.from[0]), Math.abs(s.to[1] - s.from[1])]);
  const treads = spans(complex).filter(([dx, dy]) => dx > 20 && dy < 3).map(([dx]) => dx);
  const risers = spans(complex).filter(([dx, dy]) => dy > 10 && dx < 3).map(([, dy]) => dy);
  assert.ok(complex.segments.length > simple.segments.length + 6);
  assert.ok(Math.max(...treads) / Math.min(...treads) > 1.5);
  assert.ok(Math.max(...risers) / Math.min(...risers) > 1.8);
});

test('step profiles merge safely at both complexity extremes on every breakpoint', () => {
  for (const [width, height] of [[1920, 1080], [1024, 768], [390, 844]]) {
    const simple = make(width, height, 'minimum', 0, 0.5);
    const complex = make(width, height, 'minimum', 1, 0.5);
    assert.ok(simple.paths[0].segments.length > 0);
    assert.ok(complex.stepCount > simple.stepCount);
  }
});

test('the lower-right macro slope stays curved when irregularity is zero', () => {
  const slope = make(1920, 1080, 'slope', 0.5, 0).paths
    .find(path => path.role === 'lowerRight').segments.find(segment => segment.type === 'C');
  const [a, b] = [slope.from, slope.to];
  const chordY = a[1] + (slope.c1[0] - a[0]) / (b[0] - a[0]) * (b[1] - a[1]);
  assert.ok(Math.abs(slope.c1[1] - chordY) > 5);
});
