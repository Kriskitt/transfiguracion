import test from 'node:test';
import assert from 'node:assert/strict';
import { QUESTION_TITLES } from '../src/config.js';
import { QuestionTitles } from '../src/views/question-titles.js';

test('Quest shows every title per cycle, waits 1–3 seconds, and stops cleanly', () => {
  const pending = new Map();
  let id = 0;
  const originalWindow = globalThis.window;
  globalThis.window = {
    setTimeout(callback, delay) {
      pending.set(++id, { callback, delay });
      return id;
    },
    clearTimeout(timer) { pending.delete(timer); },
  };
  try {
    const heading = { textContent: '' };
    const titles = new QuestionTitles(heading, () => 0);
    const shown = [];
    titles.start();
    for (let i = 0; i < 12; i++) {
      shown.push(heading.textContent);
      const [{ callback, delay }] = pending.values();
      assert.ok(delay >= 1000 && delay <= 3000);
      pending.clear();
      callback();
    }
    for (let i = 0; i < shown.length; i += 3) {
      assert.deepEqual(new Set(shown.slice(i, i + 3)), new Set(QUESTION_TITLES));
    }
    for (let i = 1; i < shown.length; i++) assert.notEqual(shown[i], shown[i - 1]);
    titles.stop();
    assert.equal(pending.size, 0);
  } finally {
    globalThis.window = originalWindow;
  }
});
