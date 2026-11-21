import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateOrnament } from '../experiments/06-generative-ornament/ornament.js';
import { createOrnamentBridges } from '../src/effects/ornament-bridges.js';
const geometry = JSON.parse(readFileSync(new URL('../experiments/06-generative-ornament/analysis/geometry.json', import.meta.url)));

test('ornament bridges join both measured rails at each corner', () => {
  for (const [width, height] of [[470, 900], [320, 640]]) {
    const frame = generateOrnament(geometry, { width, height, seed: 'join-check' });
    const bridges = createOrnamentBridges(frame);
    assert.equal(bridges.length, 8);
    assert.deepEqual(bridges.map(bridge => bridge.corner).sort(), ['bl','bl','br','br','tl','tl','tr','tr']);
    assert.ok(bridges.every(bridge => bridge.width === frame.rails[0].height));
    assert.ok(bridges.every(bridge => bridge.points.length === 3));
    assert.ok(bridges.every(bridge => bridge.points.flat().every(Number.isFinite)));
  }
});
