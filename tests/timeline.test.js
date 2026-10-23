import test from "node:test";
import assert from "node:assert/strict";
import { getStageAt, Timeline } from "../src/timeline.js";

test("the six visual phases cut at their specified boundaries and end at 20 seconds", () => {
  for (const [time, expected] of [
    [0, 0], [999, 0], [1000, 1], [3999, 1], [4000, 2],
    [8999, 2], [9000, 3], [15999, 3], [16000, 4],
    [17999, 4], [18000, 5], [19999, 5], [20000, 6],
  ]) {
    assert.equal(getStageAt(time).id, expected, `at ${time} ms`);
  }
});

test("timeline starts only when requested and uses elapsed monotonic time", () => {
  const clock = new Timeline();
  assert.equal(clock.getElapsed(900), 0);
  clock.start(1000);
  assert.equal(clock.getElapsed(2425), 1425);
  clock.stop();
  assert.equal(clock.getElapsed(9000), 0);
});
