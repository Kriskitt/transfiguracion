import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
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

test('video import exactly matches the versioned filename on case-sensitive filesystems', () => {
  const source = readFileSync(new URL('../src/views/video.js', import.meta.url), 'utf8');
  const imported = source.match(/rsc_\/video\/([^?']+)\?url/)?.[1];
  const repository = fileURLToPath(new URL('..', import.meta.url));
  const tracked = execFileSync('git', ['ls-files', '-z', 'rsc_/video'], { cwd: repository, encoding: 'utf8' })
    .split('\0').filter(Boolean);
  assert.ok(tracked.includes(`rsc_/video/${imported}`),
    `Import ${JSON.stringify(imported)} differs from the tracked path ${JSON.stringify(tracked)}`);
});
