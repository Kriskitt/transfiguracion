import test from 'node:test';
import assert from 'node:assert/strict';
import { playbackDuration, playbackProgress } from '../src/views/video-time.js';

test('video timeline uses media duration and a safe fallback for unbounded WebM metadata', () => {
  assert.equal(playbackDuration(95), 95);
  assert.equal(playbackDuration(Infinity), 88.44);
  assert.equal(playbackDuration(NaN), 88.44);
  assert.equal(playbackDuration(0), 88.44);
  assert.equal(playbackProgress(44.22, Infinity), .5);
  assert.equal(playbackProgress(100, 88.44), 1);
  assert.equal(playbackProgress(-3, 88.44), 0);
});
