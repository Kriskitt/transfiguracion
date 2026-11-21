import { TIMING } from './config.js';

export function buildCameraSequence(random) {
  const [minDuration, maxDuration] = TIMING.randomDurationRange;
  const count = random.int(...TIMING.randomCountRange);
  const baseline = Math.floor(TIMING.middleDuration / count);
  const remainder = TIMING.middleDuration - baseline * count;
  const durations = Array.from({ length: count }, (_, index) => baseline + (index < remainder ? 1 : 0));
  for (let round = 0; round < 4; round += 1) {
    for (let from = 0; from < count; from += 1) {
      let to = random.int(0, count - 2);
      if (to >= from) to += 1;
      const available = Math.min(durations[from] - minDuration, maxDuration - durations[to]);
      if (available <= 0) continue;
      const amount = random.int(1, available);
      durations[from] -= amount;
      durations[to] += amount;
    }
  }
  for (let index = count - 1; index > 0; index -= 1) {
    const other = random.int(0, index);
    [durations[index], durations[other]] = [durations[other], durations[index]];
  }

  const stages = [{ id: 1, group: 'initial', start: 0, duration: TIMING.firstDuration, occurrence: 0 }];
  let start = TIMING.firstDuration;

  for (const duration of durations) {
    stages.push({ id: random.pick([2, 3]), group: 'random', start, duration, occurrence: stages.length });
    start += duration;
  }

  stages.push({ id: 3, group: 'final-collage', start, duration: TIMING.collageDuration, occurrence: stages.length });
  stages.push({ id: 4, group: 'final', start: start + TIMING.collageDuration,
    duration: TIMING.finalDuration, occurrence: stages.length });
  return stages;
}

export function getStageAt(elapsedMs, stages) {
  if (elapsedMs >= TIMING.totalDuration) return { id: 6, localTime: elapsedMs - TIMING.totalDuration, progress: 1 };
  const stage = stages?.find(entry => elapsedMs >= entry.start && elapsedMs < entry.start + entry.duration);
  return { ...stage, id: stage?.id ?? 1, localTime: elapsedMs - (stage?.start ?? 0),
    progress: stage ? (elapsedMs - stage.start) / stage.duration : 0 };
}

export class Timeline {
  constructor() { this.startedAt = 0; this.running = false; }
  start(now = performance.now()) { this.startedAt = now; this.running = true; }
  stop() { this.running = false; }
  getElapsed(now = performance.now()) { return this.running ? now - this.startedAt : 0; }
}
