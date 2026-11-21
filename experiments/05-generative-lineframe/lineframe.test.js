import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, mkdtempSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const here = new URL('./', import.meta.url);
const geometry = () => JSON.parse(readFileSync(new URL('analysis/geometry.json', here)));

test('analysis is reproducible and identifies the repeated perimeter motif', () => {
  const check = spawnSync('python3', ['analysis/analyze.py', '--check'],
    { cwd: new URL('.', here), encoding: 'utf8' });
  assert.equal(check.status, 0, check.stderr || check.stdout);
  const source = readFileSync(new URL('references/lineframe-05.svg', here));
  const geometry = JSON.parse(readFileSync(new URL('analysis/geometry.json', here)));
  assert.equal(createHash('sha256').update(source).digest('hex'), geometry.sha256);
  assert.deepEqual(geometry.measured.viewBox, [0, 0, 1920, 1080]);
  assert.equal(geometry.measured.pathCount, 307);
  assert.equal(geometry.measured.groupCount, 310);
  assert.equal(geometry.measured.commandCounts.cubic, 1250);
  assert.equal(geometry.measured.commandCounts.line, 630);
  assert.ok(geometry.measured.templateFamilies.length < 20);
  assert.ok(geometry.measured.sides.top.count > 90);
  assert.ok(geometry.measured.sides.left.count > 50);
  assert.equal(geometry.measured.centralEmptyRegion.sampledPointCount, 0);
});

test('a seeded perimeter generator returns reproducible bounded marks', async () => {
  assert.ok(existsSync(new URL('lineframe.js', here)));
  const { generateLineframe } = await import('./lineframe.js');
  const source = geometry();
  for (const [width, height] of [[1920, 1080], [1024, 768], [390, 844]]) {
    const a = generateLineframe(source, { width, height, seed: 'repeat' });
    const b = generateLineframe(source, { width, height, seed: 'repeat' });
    assert.deepEqual(a, b);
    assert.ok(a.marks.length > 100);
    assert.equal(a.definitions.length, 7);
    assert.ok(a.definitions.every(def => /^M[-\d.,]+(?: [CL][-\d., ]+)+ Z$/.test(def.d)));
    assert.ok(a.marks.every(mark => Number.isFinite(mark.x) && Number.isFinite(mark.y) &&
      mark.x >= 0 && mark.x <= width && mark.y >= 0 && mark.y <= height));
    assert.ok(a.marks.every(mark => mark.side !== 'interior'));
  }
  assert.notDeepEqual(generateLineframe(source, { seed: 'a' }).marks,
    generateLineframe(source, { seed: 'b' }).marks);
});

test('cadence, length and curvature controls change different geometric properties', async () => {
  assert.ok(existsSync(new URL('lineframe.js', here)));
  const { generateLineframe } = await import('./lineframe.js');
  const source = geometry();
  const base = generateLineframe(source, { seed: 'controls' });
  const sparse = generateLineframe(source, { seed: 'controls', spacing: 1 });
  const long = generateLineframe(source, { seed: 'controls', length: 1 });
  const round = generateLineframe(source, { seed: 'controls', curvature: 1 });
  assert.ok(sparse.marks.length < base.marks.length);
  assert.equal(long.marks.length, base.marks.length);
  assert.notEqual(long.definitions[0].d, base.definitions[0].d);
  assert.equal(round.marks.length, base.marks.length);
  assert.notEqual(round.definitions[0].d, base.definitions[0].d);
});

test('the default desktop cadence follows the measured count on each edge', async () => {
  const { generateLineframe } = await import('./lineframe.js');
  const source = geometry();
  const frame = generateLineframe(source, { width: 1920, height: 1080 });
  for (const side of ['top', 'right', 'bottom', 'left']) {
    const marks = frame.marks.filter(mark => mark.side === side);
    assert.equal(marks.length, source.measured.sides[side].count, side);
    const positions = marks.map(mark => side === 'top' || side === 'bottom' ? mark.x : mark.y);
    const pitch = (positions.at(-1) - positions[0]) / (positions.length - 1);
    assert.ok(Math.abs(pitch - 19.3) < 0.5, `${side} pitch ${pitch}`);
  }
});

test('standalone build packages the measured geometry for runtime loading', () => {
  const output = mkdtempSync(join(tmpdir(), 'transf-lineframe-'));
  try {
    const build = spawnSync('npx', ['vite', 'build', 'experiments/05-generative-lineframe',
      '--outDir', output, '--emptyOutDir'],
    { cwd: new URL('../../', here), encoding: 'utf8' });
    assert.equal(build.status, 0, build.stderr || build.stdout);
    assert.ok(readdirSync(join(output, 'assets')).some(file => file.endsWith('.json')));
  } finally { rmSync(output, { recursive: true, force: true }); }
});

test('transformed motif and corner coordinates remain inside responsive artboards', async () => {
  const { generateLineframe } = await import('./lineframe.js');
  const points = d => [...d.matchAll(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g)]
    .map(match => [Number(match[1]), Number(match[2])]);
  for (const [width, height] of [[1920, 1080], [1024, 768], [390, 844], [10, 100]]) {
    const frame = generateLineframe(geometry(), { width, height, spacing: 0, length: 1, curvature: 1 });
    for (const mark of frame.marks) {
      const angle = mark.angle * Math.PI / 180;
      for (const [x, y] of points(frame.definitions[mark.variant].d)) {
        const px = mark.x + mark.scale * (x * Math.cos(angle) - y * Math.sin(angle));
        const py = mark.y + mark.scale * (x * Math.sin(angle) + y * Math.cos(angle));
        assert.ok(px >= -.01 && px <= width + .01 && py >= -.01 && py <= height + .01,
          `${width}×${height}: ${px},${py}`);
      }
    }
    for (const corner of frame.corners) {
      const angle = corner.angle * Math.PI / 180;
      for (const [x, y] of points(corner.d)) {
        const px = corner.x + corner.scale * (x * Math.cos(angle) - y * Math.sin(angle));
        const py = corner.y + corner.scale * (x * Math.sin(angle) + y * Math.cos(angle));
        assert.ok(px >= -.01 && px <= width + .01 && py >= -.01 && py <= height + .01);
      }
    }
  }
});
