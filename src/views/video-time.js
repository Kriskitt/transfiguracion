// The supplied local WebM has no finite duration in its container metadata.
// Its final packet ends at approximately 88.44 s; prefer metadata when available.
const LOCAL_VIDEO_SECONDS = 88.44;
export function playbackDuration(duration) {
  return Number.isFinite(duration) && duration > 0 ? duration : LOCAL_VIDEO_SECONDS;
}
export function playbackProgress(currentTime, duration) {
  return Math.min(1, Math.max(0, (Number.isFinite(currentTime) ? currentTime : 0) /
    playbackDuration(duration)));
}
