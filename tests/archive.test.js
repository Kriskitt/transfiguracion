import test from "node:test";
import assert from "node:assert/strict";
import { clampDepth, clampPan, isArchivePanelVisible } from "../src/archive-math.js";
import { archiveEntries } from "../src/data/archive.js";

test("depth stays within nine planes and pan keeps part of the active panel visible", () => {
  assert.equal(clampDepth(-50), 0);
  assert.equal(clampDepth(99999), 6700);
  const panel = { center: 500, size: 800, z: 0 };
  const pan = clampPan(-9999, panel, 1920, 1100, 650);
  assert.ok(pan >= -650);
  const scale = 1100 / (1100 - panel.z);
  const right = (panel.center + pan + panel.size / 2) * scale;
  assert.ok(right >= -960 + 100);
});

test("archive has nine distinct replaceable text entries", () => {
  assert.equal(archiveEntries.length, 9);
  assert.equal(new Set(archiveEntries.map((entry) => entry.text)).size, 9);
  assert.ok(archiveEntries.every((entry) => entry.text.length > 100));
});

test("distant archive panels leave the reading field instead of overlapping it", () => {
  assert.equal(isArchivePanelVisible(-1800), false);
  assert.equal(isArchivePanelVisible(-250), true);
  assert.equal(isArchivePanelVisible(1100), false);
});
