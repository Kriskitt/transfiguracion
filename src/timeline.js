import { TIMING } from "./config.js";

export function getStageAt(elapsedMs) {
  if (elapsedMs >= TIMING.totalDuration) {
    return {
      id: 6,
      localTime: elapsedMs - TIMING.totalDuration,
      progress: 1,
    };
  }

  const stage = TIMING.stages.find(
    (entry) => elapsedMs >= entry.start && elapsedMs < entry.start + entry.duration,
  );
  return {
    id: stage?.id ?? 0,
    localTime: elapsedMs - (stage?.start ?? 0),
    progress: stage ? (elapsedMs - stage.start) / stage.duration : 0,
  };
}

export class Timeline {
  constructor() {
    this.startedAt = 0;
    this.running = false;
  }

  start(now = performance.now()) {
    this.startedAt = now;
    this.running = true;
  }

  stop() {
    this.running = false;
  }

  getElapsed(now = performance.now()) {
    return this.running ? now - this.startedAt : 0;
  }
}
