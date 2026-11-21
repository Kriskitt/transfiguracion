import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, mkdtempSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const here = new URL('./', import.meta.url);
const geometry = () => JSON.parse(readFileSync(new URL('analysis/geometry.json', here)));

test('analysis reproduces the motif hierarchy and corner clipping structure', () => {
  const check = spawnSync('python3', ['analysis/analyze.py', '--check'],
    { cwd: new URL('.', here), encoding: 'utf8' });
  assert.equal(check.status, 0, check.stderr || check.stdout);
  const source = readFileSync(new URL('references/ornament-06.svg', here));
  const data = geometry();
  assert.equal(createHash('sha256').update(source).digest('hex'), data.sha256);
  assert.deepEqual(data.measured.viewBox, [0, 0, 1920, 1080]);
  assert.equal(data.measured.pathCount, 806);
  assert.equal(data.measured.groupCount, 810);
  assert.equal(data.measured.commandCounts.cubic, 20956);
  assert.equal(data.measured.commandCounts.line, 2418);
  assert.equal(data.measured.clipPathCount, 8);
  assert.equal(data.measured.clippedPathCount, 8);
  assert.equal(data.measured.regularMotifCount, 798);
  assert.equal(data.measured.sides.top.count, 266);
  assert.equal(data.measured.sides.left.count, 133);
  assert.equal(data.measured.centralEmptyRegion.sampledPointCount, 0);
  assert.ok(data.measured.templateFamilies.length < 30);
});

test('the ornament generator exists and keeps a seeded border within each viewport', async () => {
  assert.ok(existsSync(new URL('ornament.js', here)));
  const { generateOrnament } = await import('./ornament.js');
  const source = geometry();
  for (const [width, height] of [[1920, 1080], [1024, 768], [390, 844]]) {
    const a = generateOrnament(source, { width, height, seed: 'same' });
    assert.deepEqual(a, generateOrnament(source, { width, height, seed: 'same' }));
    assert.equal(a.definitions.length, 9);
    assert.ok(a.motifs.length > 200);
    assert.equal(a.corners.length, 8);
    assert.ok(a.definitions.every(def => /^M[-\d.,]+(?: [CL][-\d., ]+)+ Z$/.test(def.d)));
    assert.ok(a.motifs.every(motif => motif.x >= 0 && motif.x <= width &&
      motif.y >= 0 && motif.y <= height && Number.isFinite(motif.x + motif.y)));
  }
  assert.notDeepEqual(generateOrnament(source, { seed: 'a' }).motifs,
    generateOrnament(source, { seed: 'b' }).motifs);
});

test('repeat interval, bead scale and frame inset have distinct effects', async () => {
  assert.ok(existsSync(new URL('ornament.js', here)));
  const { generateOrnament } = await import('./ornament.js');
  const source = geometry();
  const base = generateOrnament(source);
  const open = generateOrnament(source, { spacing: 1 });
  const largeBeads = generateOrnament(source, { bead: 1 });
  const inset = generateOrnament(source, { inset: 1 });
  assert.ok(open.motifs.length < base.motifs.length);
  assert.equal(largeBeads.motifs.length, base.motifs.length);
  assert.notEqual(largeBeads.definitions[0].d, base.definitions[0].d);
  assert.ok(inset.bounds.left > base.bounds.left);
});

test('default desktop runs match measured cadence and corners use bounded triangle clips', async () => {
  const { generateOrnament } = await import('./ornament.js');
  const source = geometry();
  const frame = generateOrnament(source, { width: 1920, height: 1080 });
  for (const side of ['top', 'right', 'bottom', 'left']) {
    const motifs = frame.motifs.filter(motif => motif.side === side);
    assert.equal(motifs.length, source.measured.sides[side].count, side);
    const positions = motifs.map(motif => side === 'top' || side === 'bottom' ? motif.x : motif.y);
    const pitch = (positions.at(-1) - positions[0]) / (positions.length - 1);
    assert.ok(Math.abs(pitch - 6.9) < .1, `${side} pitch ${pitch}`);
  }
  assert.ok(frame.rails.every(rail => Math.min(rail.width, rail.height) >= .8));
  assert.ok(frame.corners.every(corner => corner.points.length === 3 &&
    corner.points.every(([x, y]) => x >= 0 && x <= 1920 && y >= 0 && y <= 1080)));
});

test('standalone build packages the measured geometry for runtime loading', () => {
  const output = mkdtempSync(join(tmpdir(), 'transf-ornament-'));
  try {
    const build = spawnSync('npx', ['vite', 'build', 'experiments/06-generative-ornament',
      '--outDir', output, '--emptyOutDir'],
    { cwd: new URL('../../', here), encoding: 'utf8' });
    assert.equal(build.status, 0, build.stderr || build.stdout);
    assert.ok(readdirSync(join(output, 'assets')).some(file => file.endsWith('.json')));
  } finally { rmSync(output, { recursive: true, force: true }); }
});

test('narrow live artboards retain positive ground, rails and clipped bounds', async () => {
  const { generateOrnament } = await import('./ornament.js');
  for (const [width, height] of [[10, 100], [100, 10], [1, 100], [100, 1]]) {
    const frame = generateOrnament(geometry(), { width, height, spacing: 1, inset: 1 });
    assert.ok(frame.ground.width > 0 && frame.ground.height > 0);
    assert.ok(frame.rails.every(rail => rail.width > 0 && rail.height > 0));
    assert.ok(frame.bounds.left >= 0 && frame.bounds.right <= width &&
      frame.bounds.top >= 0 && frame.bounds.bottom <= height);
    assert.ok(frame.corners.every(corner => corner.points.every(([x, y]) =>
      x >= 0 && x <= width && y >= 0 && y <= height)));
  }
});
