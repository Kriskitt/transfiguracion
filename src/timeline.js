import { TIMING } from './config.js';

export function buildCameraSequence(random) {
  const middle = [
    ...Array.from({ length: random.int(1, 3) }, () => ({ group: 'A', id: random.pick([1, 2, 3]) })),
    ...Array.from({ length: random.int(1, 2) }, () => ({ group: 'B', id: random.pick([1, 2, 3]) })),
    ...Array.from({ length: random.int(1, 2) }, () => ({ group: 'C', id: random.pick([2, 3]) })),
  ];
  const entries = [{ group: 'initial', id: 1 }, ...middle, { group: 'final', id: 4 }];
  const middleEnd = TIMING.firstDuration + TIMING.middleDuration;
  let start = 0;
  return entries.map(({ id, group }, index) => {
    const duration = index === 0 ? TIMING.firstDuration :
      index === entries.length - 1 ? TIMING.totalDuration - start :
      index === entries.length - 2 ? middleEnd - start :
      TIMING.middleDuration / middle.length;
    const stage = { id, group, start, duration, occurrence: index };
    start += duration;
    return stage;
  });
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
