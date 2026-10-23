import test from "node:test";
import assert from "node:assert/strict";
import { AppState } from "../src/state.js";

test("the visit follows camera, question and archive without losing the underlying state to About", () => {
  const app = new AppState();
  assert.equal(app.current, "camera_idle");
  assert.equal(app.openAbout(), false);
  for (const state of ["camera_permission", "camera_running", "camera_finalizing", "question"]) {
    assert.equal(app.transition(state), true);
  }
  assert.equal(app.openAbout(), true);
  assert.equal(app.current, "question");
  assert.equal(app.aboutOpen, true);
  assert.equal(app.closeAbout(), true);
  assert.equal(app.transition("archive"), true);
  assert.equal(app.openAbout(), true);
  assert.equal(app.transition("camera_idle"), true);
  assert.equal(app.aboutOpen, false);
});

test("invalid state jumps are refused and a permission error can retry", () => {
  const app = new AppState();
  assert.equal(app.transition("archive"), false);
  assert.equal(app.transition("camera_permission"), true);
  assert.equal(app.transition("camera_error"), true);
  assert.equal(app.transition("camera_permission"), true);
  assert.equal(app.current, "camera_permission");
});
