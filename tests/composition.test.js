import test from "node:test";
import assert from "node:assert/strict";
import { CompositionController } from "../src/composition.js";
import { sourceForDest } from "../src/geometry.js";
import { createRandom } from "../src/random.js";

function controller(seed = "collage-check") {
  const composition = new CompositionController(createRandom(seed));
  composition.updateFrame(1280, 720, 1920, 1080);
  return composition;
}

test("the referenced 4 by 3 mosaic keeps its dimensions while image fragmentation progresses", () => {
  const composition = controller();
  const stage = { id: 2 };
  const snapshots = [0, 1200, 2500, 3900, 10000].map((time) =>
    composition.getCells(stage, time).map((cell) => structuredClone(cell)),
  );
  assert.deepEqual(snapshots.map((cells) => cells.length), [12, 12, 12, 12, 12]);
  const altered = snapshots.map((cells) => cells.filter((cell) => {
    const natural = sourceForDest(cell.dest, composition.cover, 1920, 1080);
    return Math.abs(cell.source.x - natural.x) > 0.001 || Math.abs(cell.source.width - natural.width) > 0.001;
  }).length);
  assert.deepEqual(altered.slice(0, 4), [3, 6, 9, 12]);
  assert.deepEqual(snapshots[4], snapshots[3]);
  assert.equal(composition.mutationIndex, 3);
});

test("final collage is irregular, layered, seeded and samples only valid camera UVs", () => {
  const first = controller("same-seed").getCells({ id: 3 }, 0);
  const second = controller("same-seed").getCells({ id: 3 }, 0);
  assert.deepEqual(first, second);
  assert.ok(first.length >= 25);
  assert.ok(new Set(first.map((cell) => cell.dest.width)).size > 12);
  assert.ok(first.some((cell) => cell.rotation === 180));
  assert.ok(first.some((cell) => cell.dest.x < 0 || cell.dest.y < 0));
  assert.ok(first.some((cell, index) => first.slice(index + 1).some((other) =>
    cell.dest.x < other.dest.x + other.dest.width &&
    cell.dest.x + cell.dest.width > other.dest.x &&
    cell.dest.y < other.dest.y + other.dest.height &&
    cell.dest.y + cell.dest.height > other.dest.y,
  )));
  for (const cell of first) {
    assert.ok(cell.source.x >= 0 && cell.source.y >= 0);
    assert.ok(cell.source.x + cell.source.width <= 1.000001);
    assert.ok(cell.source.y + cell.source.height <= 1.000001);
  }
});

test("collage keeps visible white space between photographic fragments", () => {
  for (const seed of ["same-seed", "collage-check", "review"]) {
    const cells = controller(seed).getCells({ id: 3 }, 0);
    let covered = 0;
    let sampled = 0;
    for (let y = 0; y < 1080; y += 12) {
      for (let x = 0; x < 1920; x += 12) {
        sampled += 1;
        if (cells.some(({ dest }) =>
          x >= dest.x && x < dest.x + dest.width &&
          y >= dest.y && y < dest.y + dest.height
        )) covered += 1;
      }
    }
    assert.ok(covered / sampled < 0.87, `${seed} cubre demasiado el viewport`);
    assert.ok(covered / sampled > 0.55, `${seed} deja demasiados vacíos`);
  }
});

test("collage rescales finite rectangles when viewport or camera resolution changes", () => {
  const composition = controller();
  composition.getCells({ id: 3 }, 1000);
  composition.updateFrame(640, 480, 1440, 900);
  const cells = composition.getCells({ id: 3 }, 1000);
  for (const cell of cells) {
    assert.ok(Object.values(cell.dest).every(Number.isFinite));
    assert.ok(Object.values(cell.source).every(Number.isFinite));
    assert.ok(cell.dest.width > 0 && cell.dest.height > 0);
  }
});
