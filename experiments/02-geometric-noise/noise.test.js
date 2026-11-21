import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generatePattern } from './noise.js';

const geometry = JSON.parse(readFileSync(new URL('./analysis/geometry.json', import.meta.url)));
const generate = (width, height, seed = 'reference', density = 0.5, moduleScale = 1) =>
  generatePattern(geometry, { width, height, seed, density, moduleScale });

test('analysis lattice reconstructs every source rectangle once', () => {
  const svg = readFileSync(new URL('./references/noise.svg', import.meta.url), 'utf8');
  const sourceCells = [...svg.matchAll(/<rect\b([^>]*?)\/>/g)].map(([, attributes]) => {
    const x = Number(attributes.match(/\bx="([^"]+)"/)?.[1] ?? 0);
    const y = Number(attributes.match(/\by="([^"]+)"/)?.[1]);
    return `${Math.round(x / 24)},${Math.round((y - 335.7) / 7.62)}`;
  });
  const latticeCells = geometry.template.rows.flatMap((runs, row) =>
    runs.flatMap(([start, end]) => Array.from({ length: end - start + 1 }, (_, offset) =>
      `${start + offset},${row}`)));
  assert.equal(sourceCells.length, 1361);
  assert.deepEqual(new Set(latticeCells), new Set(sourceCells));
  assert.equal(new Set(sourceCells).size, sourceCells.length);
});

test('seed reproduces the full generated composition and changes it when altered', () => {
  const first = generate(1920, 1080, 'alpha');
  assert.deepEqual(first, generate(1920, 1080, 'alpha'));
  assert.notDeepEqual(first.cells, generate(1920, 1080, 'beta').cells);
});

test('desktop retains compact left and central masses and the right island', () => {
  const result = generate(1920, 1080);
  assert.ok(result.cells.length > 900 && result.cells.length < 1700);
  const occupied = new Set(result.cells.map(cell => `${cell.column},${cell.row}`));
  const adjacent = result.cells.filter(({ column, row }) =>
    occupied.has(`${column - 1},${row}`) || occupied.has(`${column + 1},${row}`) ||
    occupied.has(`${column},${row - 1}`) || occupied.has(`${column},${row + 1}`)).length;
  assert.ok(adjacent / result.cells.length > 0.85);
  assert.ok(result.cells.filter(cell => cell.column < 32).length > 500);
  assert.ok(result.cells.filter(cell => cell.column >= 32 && cell.column < 54).length > 250);
  assert.ok(result.cells.filter(cell => cell.column >= 64).length > 50);
  assert.ok(result.cells.filter(cell => cell.column >= 56 && cell.column < 62).length < 10);
});

test('density changes occupied area while preserving modules and broad gaps', () => {
  const sparse = generate(1920, 1080, 'delta', 0.2);
  const dense = generate(1920, 1080, 'delta', 0.8);
  assert.ok(dense.cells.length > sparse.cells.length + 80);
  assert.ok(Math.abs(sparse.moduleWidth / sparse.moduleHeight - 24 / 7.6) < 1e-10);
  assert.ok(Math.abs(dense.moduleWidth / dense.moduleHeight - 24 / 7.6) < 1e-10);
});

test('tablet and mobile fit without distorting modules; mobile recomposes motifs', () => {
  for (const [width, height] of [[1024, 768], [390, 844]]) {
    const result = generate(width, height, 'responsive');
    assert.ok(Math.abs(result.moduleWidth / result.moduleHeight - 24 / 7.6) < 1e-10);
    assert.ok(result.cells.every(cell => cell.x >= 0 && cell.y >= 0 &&
      cell.x + result.moduleWidth <= width + 0.01 &&
      cell.y + result.moduleHeight <= height + 0.01));
  }
  const mobile = generate(390, 844, 'responsive');
  assert.equal(mobile.layout, 'mobile');
  assert.ok(new Set(mobile.cells.map(cell => cell.motif)).size >= 3);
  assert.ok(Math.max(...mobile.cells.map(cell => cell.y)) - Math.min(...mobile.cells.map(cell => cell.y)) > 400);
});

test('a wide live stage keeps the left cluster at the edge without clipping its occupied height', () => {
  const result = generate(1920, 996, 'reference');
  assert.ok(result.cells.some(cell => cell.column === 0 && cell.x === 0));
  assert.ok(result.cells.every(cell => cell.y >= 0 && cell.y + result.moduleHeight <= 996));
});
