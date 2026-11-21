import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { generateOutline } from './outline.js';

const root = new URL('./', import.meta.url);
const draw = (width, height, seed = 'reference', complexity = 0.5, density = 0.5) =>
  generateOutline({ width, height, seed, complexity, density });

test('analysis identifies the intact compound source geometry', () => {
  const svg = readFileSync(new URL('references/outline-01.svg', root));
  const geometry = JSON.parse(readFileSync(new URL('analysis/geometry.json', root)));
  assert.equal(createHash('sha256').update(svg).digest('hex'), geometry.sha256);
  assert.deepEqual(geometry.measured.viewBox, [0, 0, 1920, 1080]);
  assert.equal(geometry.measured.pathCount, 3);
  assert.deepEqual(geometry.measured.paths.map(path => path.subpathCount), [1, 51, 1]);
  assert.equal(geometry.measured.paths[1].cubicCount, 811);
});

test('same seed and controls reproduce commands; changing seed changes geometry', () => {
  const first = draw(1920, 1080, 'alpha');
  assert.deepEqual(first, draw(1920, 1080, 'alpha'));
  assert.notDeepEqual(first.paths.map(path => path.d), draw(1920, 1080, 'beta').paths.map(path => path.d));
});

test('trajectories are connected and use finite cubic geometry', () => {
  const result = draw(1920, 1080);
  assert.ok(result.paths.length >= 3);
  for (const path of result.paths) {
    assert.match(path.d, /^M[-\d.]+,[-\d.]+(?: C[-\d., ]+)+$/);
    assert.ok(path.segments.length > 10);
    for (const [index, segment] of path.segments.entries()) {
      assert.equal(segment.length, 4);
      assert.ok(segment.flat().every(Number.isFinite));
      if (index) assert.deepEqual(segment[0], path.segments[index - 1][3]);
    }
  }
});

test('loop density and curve complexity change structure independently', () => {
  const sparse = draw(1920, 1080, 'delta', 0.5, 0);
  const dense = draw(1920, 1080, 'delta', 0.5, 1);
  assert.ok(dense.loopCount > sparse.loopCount);
  const simple = draw(1920, 1080, 'delta', 0, 0.5);
  const complex = draw(1920, 1080, 'delta', 1, 0.5);
  assert.ok(complex.segmentCount > simple.segmentCount);
  assert.equal(complex.loopCount, simple.loopCount);
});

test('desktop, tablet and mobile coordinates remain inside their artboards', () => {
  for (const [width, height, expected] of [
    [1920, 1080, 'wide'], [1024, 768, 'wide'], [390, 844, 'portrait'],
  ]) {
    const result = draw(width, height, 'bounds', 1, 1);
    assert.equal(result.layout, expected);
    assert.equal(result.width, width);
    assert.equal(result.height, height);
    assert.ok(result.paths.every(path => path.samples.length > 20));
    for (const path of result.paths) {
      for (const [x, y] of path.samples) {
        assert.ok(x >= 0 && x <= width, `${width}: x=${x}`);
        assert.ok(y >= 0 && y <= height, `${height}: y=${y}`);
      }
    }
  }
});

test('invalid control values are normalized without creating nonfinite paths', () => {
  const result = generateOutline({ width: 0, height: Number.NaN, seed: '', complexity: 99, density: -4 });
  assert.ok(result.width > 0 && result.height > 0);
  assert.ok(result.paths.every(path => path.segments.flat(2).every(Number.isFinite)));
});

test('very small live preview sizes retain valid in-artboard coordinates', () => {
  const result = draw(10, 10, 'tiny');
  for (const path of result.paths) {
    for (const [x, y] of path.samples) {
      assert.ok(x >= 0 && x <= 10 && y >= 0 && y <= 10, `${x},${y}`);
    }
  }
});

test('seeded shape variation stays inside desktop and portrait artboards', () => {
  for (const [width, height] of [[1920, 1080], [390, 844]]) {
    for (let seed = 0; seed < 20; seed++) {
      for (const density of [0, 1]) {
        const result = draw(width, height, `s${seed}`, 1, density);
        for (const path of result.paths) {
          for (const [x, y] of path.samples) {
            assert.ok(x >= 0 && x <= width && y >= 0 && y <= height,
              `${width}×${height}, seed s${seed}, density ${density}: ${x},${y}`);
          }
        }
      }
    }
  }
});

test('the isolated left loop has a displaced shoulder rather than elliptical symmetry', () => {
  const points = draw(1920, 1080).paths[0].samples.filter(([x]) => x < 380);
  const top = points.reduce((a, b) => a[1] < b[1] ? a : b);
  const bottom = points.reduce((a, b) => a[1] > b[1] ? a : b);
  assert.ok(Math.abs(top[0] - bottom[0]) > 45);
});

test('portrait bands have different vertical spans instead of repeated loop silhouettes', () => {
  const bands = draw(390, 844).paths.map(path => {
    const ys = path.samples.map(([, y]) => y);
    const xs = path.samples.map(([x]) => x);
    const height = Math.max(...ys) - Math.min(...ys);
    return { height, aspect: (Math.max(...xs) - Math.min(...xs)) / height };
  });
  assert.ok(bands[0].height < bands[1].height * 0.7, `band spans: ${JSON.stringify(bands)}`);
  assert.ok(Math.abs(bands[0].aspect - bands[2].aspect) > 0.4, `band spans: ${JSON.stringify(bands)}`);
});

test('overlapping crossings concentrate in the measured middle-right region', () => {
  const lines = draw(1920, 1080).paths.flatMap((path, group) =>
    path.samples.slice(1).map((end, index) => ({ start: path.samples[index], end, group, index })));
  const bins = Array(8).fill(0);
  for (let a = 0; a < lines.length; a++) {
    for (let b = a + 1; b < lines.length; b++) {
      const first = lines[a], second = lines[b];
      if (first.group === second.group && Math.abs(first.index - second.index) < 3) continue;
      const [x1, y1] = first.start, [x2, y2] = first.end;
      const [x3, y3] = second.start, [x4, y4] = second.end;
      if (Math.max(x1, x2) < Math.min(x3, x4) || Math.max(x3, x4) < Math.min(x1, x2) ||
          Math.max(y1, y2) < Math.min(y3, y4) || Math.max(y3, y4) < Math.min(y1, y2)) continue;
      const divisor = (x2-x1)*(y4-y3) - (y2-y1)*(x4-x3);
      if (Math.abs(divisor) < 1e-9) continue;
      const t = ((x3-x1)*(y4-y3) - (y3-y1)*(x4-x3)) / divisor;
      const u = ((x3-x1)*(y2-y1) - (y3-y1)*(x2-x1)) / divisor;
      if (t > 0 && t < 1 && u > 0 && u < 1) {
        bins[Math.min(7, Math.floor((x1 + t*(x2-x1)) / 240))]++;
      }
    }
  }
  const right = bins[5] + bins[6];
  const left = bins[0] + bins[1] + bins[2];
  assert.ok(right > left * 1.3, `crossings by x band: ${bins}`);
});
