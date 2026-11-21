import test from 'node:test';
import assert from 'node:assert/strict';
import { createRandom } from '../src/random.js';
import { buildCameraSequence, getStageAt } from '../src/timeline.js';
import { ReplyRepository } from '../src/data/replies.js';
import { CompositionController } from '../src/composition.js';
import { renderFinalFrame } from '../src/final-frame.js';
import { TIMING } from '../src/config.js';

test('camera sequence has exact V2.2 boundaries and seeded short occurrences', () => {
  const a = buildCameraSequence(createRandom('v2'));
  const b = buildCameraSequence(createRandom('v2'));
  assert.deepEqual(a, b);
  assert.deepEqual(TIMING, {
    totalDuration: 24000, firstDuration: 2000, middleDuration: 16000,
    randomDurationRange: [500, 1500], randomCountRange: [16, 24],
    collageDuration: 4000, finalDuration: 2000,
  });
  assert.equal(a[0].id, 1);
  assert.equal(a[0].duration, 2000);
  assert.ok(a.slice(1, -2).every(s => s.group === 'random' && [2, 3].includes(s.id)));
  assert.ok(a.slice(1, -2).every(s => s.duration >= 500 && s.duration <= 1500));
  assert.equal(a.slice(1, -2).reduce((sum, stage) => sum + stage.duration, 0), 16000);
  assert.deepEqual(a.at(-2), { id: 3, group: 'final-collage', start: 18000, duration: 4000, occurrence: a.length - 2 });
  assert.deepEqual(a.at(-1), { id: 4, group: 'final', start: 22000, duration: 2000, occurrence: a.length - 1 });
  assert.ok(a.every((stage, index) => index === 0 || stage.start === a[index - 1].start + a[index - 1].duration));
  assert.equal(a.at(-1).start + a.at(-1).duration, 24000);
  assert.equal(getStageAt(1999, a).id, 1);
  assert.ok([2, 3].includes(getStageAt(2000, a).id));
  assert.equal(getStageAt(18000, a).id, 3);
  assert.equal(getStageAt(22000, a).id, 4);
  assert.equal(getStageAt(23999, a).id, 4);
  assert.equal(getStageAt(24000, a).id, 6);
});

test('random section varies phase and duration without overshooting 18 seconds', () => {
  let repeated = false;
  let bothPhases = false;
  let variedDuration = false;
  for (let seed = 0; seed < 100; seed += 1) {
    const stages = buildCameraSequence(createRandom(`sequence-${seed}`));
    const random = stages.slice(1, -2);
    assert.ok(random.length >= 16 && random.length <= 24);
    assert.ok(random.every(stage => [2, 3].includes(stage.id) && stage.duration >= 500 && stage.duration <= 1500));
    assert.equal(random.at(-1).start + random.at(-1).duration, 18000);
    const ids = random.map(stage => stage.id);
    if (ids.some((id, index) => index && id === ids[index - 1])) repeated = true;
    if (new Set(ids).size === 2) bothPhases = true;
    if (new Set(random.map(stage => stage.duration)).size > 1) variedDuration = true;
    assert.equal(stages.at(-1).start + stages.at(-1).duration, 24000);
  }
  assert.equal(repeated, true);
  assert.equal(bothPhases, true);
  assert.equal(variedDuration, true);
});

test('duration randomization stays distributed through the end of the middle section', () => {
  const random = buildCameraSequence(createRandom('revision:sequence'))
    .filter(stage => stage.group === 'random');
  assert.ok(new Set(random.slice(-5).map(stage => stage.duration)).size > 1);
  assert.ok(random.slice(-5).some(stage => stage.duration > TIMING.randomDurationRange[0]));
});

test('final tone keeps the preceding composition and reuses its captured texture', () => {
  const composition = new CompositionController(createRandom('continuity'));
  composition.updateFrame(1280, 720, 1920, 1080);
  const prior = structuredClone(composition.getCells({ id: 3, occurrence: 6, duration: 3000 }, 2000));
  const finalCells = composition.getCells({ id: 4, occurrence: 7, duration: 2000 }, 0);
  assert.deepEqual(finalCells, prior);
  const calls = [];
  renderFinalFrame({ render(...args) { calls.push(args); } }, finalCells, .92);
  assert.equal(calls[0][0], null);
  assert.equal(calls[0][1], finalCells);
  assert.deepEqual(calls[0][2], { invert: 1, exposure: .92 });
});

test('repeated randomized phases change composition but final collage continues a preceding collage', () => {
  const c = new CompositionController(createRandom('short-repetitions'));
  c.updateFrame(1280, 720, 1920, 1080);
  const mosaicA = structuredClone(c.getCells({ id: 2, group: 'random', occurrence: 1, duration: 800 }, 0));
  const mosaicB = structuredClone(c.getCells({ id: 2, group: 'random', occurrence: 2, duration: 800 }, 0));
  assert.notDeepEqual(mosaicB, mosaicA);
  const collageA = structuredClone(c.getCells({ id: 3, group: 'random', occurrence: 3, duration: 800 }, 0));
  const collageB = structuredClone(c.getCells({ id: 3, group: 'random', occurrence: 4, duration: 800 }, 0));
  assert.notDeepEqual(collageB, collageA);
  const continuous = structuredClone(c.getCells({ id: 3, group: 'final-collage', occurrence: 5, duration: 4000 }, 0));
  assert.deepEqual(continuous, collageB);
  const evolved = structuredClone(c.getCells({ id: 3, group: 'final-collage', occurrence: 5, duration: 4000 }, 1000));
  assert.notDeepEqual(evolved, continuous);
  assert.deepEqual(c.getCells({ id: 4, group: 'final', occurrence: 6, duration: 2000 }, 0), evolved);
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

test('short mosaic occurrences mutate four times before their next cut', () => {
  const c = new CompositionController(createRandom('frequency'));
  assert.deepEqual(c.getSchedule(2, 500), [100, 200, 300, 400]);
  assert.deepEqual(c.getSchedule(2, 1500), [300, 600, 900, 1200]);
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
