export const ARCHIVE_MAX_DEPTH = 6700;

export function clampDepth(value) {
  return Math.min(ARCHIVE_MAX_DEPTH, Math.max(0, value));
}

export function isArchivePanelVisible(z) {
  return z >= -1500 && z <= 1050;
}

export function clampPan(value, panel, viewportSize, perspective, maxPan) {
  const scale = perspective / Math.max(1, perspective - panel.z);
  const margin = 100;
  const minVisible = (-viewportSize / 2 + margin) / scale - panel.center - panel.size / 2;
  const maxVisible = (viewportSize / 2 - margin) / scale - panel.center + panel.size / 2;
  const min = Math.max(-maxPan, minVisible);
  const max = Math.min(maxPan, maxVisible);
  return Math.min(Math.max(value, min), max < min ? min : max);
}
