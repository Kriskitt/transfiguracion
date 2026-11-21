import test from 'node:test';
import assert from 'node:assert/strict';
import { createRandom } from '../src/random.js';
import { buildCameraSequence, getStageAt } from '../src/timeline.js';
import { ReplyRepository } from '../src/data/replies.js';
import { CompositionController } from '../src/composition.js';
import { renderFinalFrame } from '../src/final-frame.js';

test('camera sequence is seeded, bounded and ends at 24 seconds', () => {
  const a = buildCameraSequence(createRandom('v2'));
  const b = buildCameraSequence(createRandom('v2'));
  assert.deepEqual(a, b);
  assert.equal(a[0].id, 1);
  assert.equal(a.at(-1).id, 4);
  assert.ok(a.slice(1, -1).every(s => [1, 2, 3].includes(s.id)));
  assert.equal(a.at(-1).start + a.at(-1).duration, 24000);
  assert.equal(getStageAt(23999, a).id, 4);
  assert.equal(getStageAt(24000, a).id, 6);
});

test('camera groups obey their own counts and allowed phases with seeded repetition', () => {
  let repeated = false;
  for (let seed = 0; seed < 100; seed += 1) {
    const stages = buildCameraSequence(createRandom(`sequence-${seed}`));
    assert.equal(stages[0].id, 1);
    assert.equal(stages.at(-1).id, 4);
    for (const [group, min, max, allowed] of [['A', 1, 3, [1, 2, 3]], ['B', 1, 2, [1, 2, 3]], ['C', 1, 2, [2, 3]]]) {
      const selected = stages.filter(stage => stage.group === group);
      assert.ok(selected.length >= min && selected.length <= max);
      assert.ok(selected.every(stage => allowed.includes(stage.id)));
    }
    const ids = stages.slice(1, -1).map(stage => stage.id);
    if (ids.some((id, index) => index && id === ids[index - 1])) repeated = true;
    assert.equal(stages.at(-1).start + stages.at(-1).duration, 24000);
  }
  assert.equal(repeated, true);
});

test('final tone keeps the preceding composition and reuses its captured texture', () => {
  const composition = new CompositionController(createRandom('continuity'));
  composition.updateFrame(1280, 720, 1920, 1080);
  const prior = structuredClone(composition.getCells({ id: 3, occurrence: 6, duration: 3000 }, 2000));
  const finalCells = composition.getCells({ id: 4, occurrence: 7, duration: 4000 }, 0);
  assert.deepEqual(finalCells, prior);
  const calls = [];
  renderFinalFrame({ render(...args) { calls.push(args); } }, finalCells, .92);
  assert.equal(calls[0][0], null);
  assert.equal(calls[0][1], finalCells);
  assert.deepEqual(calls[0][2], { invert: 1, exposure: .92 });
});

test('stage 1 alternates distortion sides and collage covers viewport', () => {
  const c = new CompositionController(createRandom('v2'));
  c.updateFrame(1280, 720, 1920, 1080);
  const first = c.getCells({id:1, duration:3000}, 0).map(x => x.blurPx);
  const next = c.getCells({id:1, duration:3000}, 900).map(x => x.blurPx);
  assert.notDeepEqual(first, next);
  const cells = c.getCells({id:3, duration:3000}, 0);
  assert.deepEqual(cells[0].dest, {x:0,y:0,width:1920,height:1080});
});

test('mosaic distortion event interval is 40 percent more frequent than V1', () => {
  const c = new CompositionController(createRandom('frequency'));
  const schedule = c.getSchedule(2, 5000);
  assert.ok(Math.abs(schedule[0] - 5000 / (3 * 1.4)) < .001);
  assert.equal(schedule.length, 4);
});

test('reply repository stores one nonempty submission per identifier only in memory', () => {
  const repo = new ReplyRepository();
  const initial = repo.getAll().length;
  assert.equal(repo.add('  ', 'one'), null);
  assert.ok(repo.add('un futuro', 'one'));
  assert.equal(repo.add('un futuro', 'one'), null);
  assert.equal(repo.getAll().length, initial + 1);
  assert.equal(repo.getAll()[0].text, 'un futuro');
  repo.add('otro futuro', 'two');
  assert.deepEqual(repo.getAll().slice(0, 2).map(entry => entry.text), ['otro futuro', 'un futuro']);
  assert.equal(new ReplyRepository().getAll().length, initial);
});
