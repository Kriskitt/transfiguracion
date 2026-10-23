import test from "node:test";
import assert from "node:assert/strict";
import { ResponseController } from "../src/response.js";

test("empty answers are accepted once and only simulate confirmation", async () => {
  let navigations = 0;
  const response = new ResponseController(5);
  assert.equal(response.submit("", () => { navigations += 1; }), true);
  assert.equal(response.submit("duplicate", () => { navigations += 10; }), false);
  await new Promise((resolve) => setTimeout(resolve, 15));
  assert.equal(navigations, 1);
});

test("cancelled confirmation never navigates", async () => {
  let navigations = 0;
  const response = new ResponseController(5);
  response.submit("hello", () => { navigations += 1; });
  response.cancel();
  await new Promise((resolve) => setTimeout(resolve, 15));
  assert.equal(navigations, 0);
});
