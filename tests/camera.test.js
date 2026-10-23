import test from "node:test";
import assert from "node:assert/strict";
import { CameraController } from "../src/camera.js";

test("a permission grant arriving after stop releases its track", async () => {
  let grant;
  let stops = 0;
  const track = { stop() { stops += 1; }, onended: null };
  const stream = { getTracks: () => [track], getVideoTracks: () => [track] };
  const mediaDevices = { getUserMedia: () => new Promise((resolve) => { grant = resolve; }) };
  const video = {
    pause() {}, load() {}, removeAttribute() {}, srcObject: null,
    play: async () => {}, videoWidth: 640, videoHeight: 480,
    requestVideoFrameCallback(callback) { queueMicrotask(callback); },
  };
  const previousNavigator = globalThis.navigator;
  const previousWindow = globalThis.window;
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { mediaDevices } });
  globalThis.window = { setTimeout, clearTimeout };
  try {
    const camera = new CameraController(video, mediaDevices);
    const pending = camera.start();
    camera.stop();
    grant(stream);
    await assert.rejects(pending, (error) => error.code === "CANCELLED");
    assert.equal(stops, 1);
    assert.equal(video.srcObject, null);
  } finally {
    Object.defineProperty(globalThis, "navigator", { configurable: true, value: previousNavigator });
    globalThis.window = previousWindow;
  }
});

test("camera clock can wait for an actual video-frame callback even after dimensions appear", async () => {
  let deliverFrame;
  const track = { stop() {}, onended: null };
  const stream = { getTracks: () => [track], getVideoTracks: () => [track] };
  const video = {
    pause() {}, load() {}, removeAttribute() {}, srcObject: null,
    play: async () => {}, videoWidth: 640, videoHeight: 480,
    requestVideoFrameCallback(callback) { deliverFrame = callback; return 1; },
    cancelVideoFrameCallback() {},
  };
  const camera = new CameraController(video, { getUserMedia: async () => stream });
  let started = false;
  const pending = camera.start().then(() => { started = true; });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(typeof deliverFrame, "function");
  assert.equal(started, false);
  deliverFrame();
  await pending;
  assert.equal(started, true);
  camera.stop();
});
