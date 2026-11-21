import test from "node:test";
import assert from "node:assert/strict";
import { buildCameraSequence, getStageAt, Timeline } from "../src/timeline.js";
import { createRandom } from "../src/random.js";

test("seeded phases cut exactly and end at 24 seconds", () => {
  const stages = buildCameraSequence(createRandom('boundaries'));
  assert.equal(getStageAt(0, stages).id, 1);
  for (const stage of stages) {
    assert.equal(getStageAt(stage.start, stages).occurrence, stage.occurrence);
    assert.equal(getStageAt(stage.start + stage.duration - .01, stages).occurrence, stage.occurrence);
  }
  assert.equal(getStageAt(24000, stages).id, 6);
});

test("timeline starts only when requested and uses elapsed monotonic time", () => {
  const clock = new Timeline();
  assert.equal(clock.getElapsed(900), 0);
  clock.start(1000);
  assert.equal(clock.getElapsed(2425), 1425);
  clock.stop();
  assert.equal(clock.getElapsed(9000), 0);
});
