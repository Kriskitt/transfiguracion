export function fitCoverSource(videoWidth, videoHeight, outputWidth, outputHeight) {
  const videoAspect = videoWidth / videoHeight;
  const outputAspect = outputWidth / outputHeight;

  if (videoAspect > outputAspect) {
    const width = outputAspect / videoAspect;
    return { x: (1 - width) / 2, y: 0, width, height: 1 };
  }

  const height = videoAspect / outputAspect;
  return { x: 0, y: (1 - height) / 2, width: 1, height };
}

export function sourceForDest(dest, cover, outputWidth, outputHeight) {
  return {
    x: cover.x + cover.width * (dest.x / outputWidth),
    y: cover.y + cover.height * (dest.y / outputHeight),
    width: cover.width * (dest.width / outputWidth),
    height: cover.height * (dest.height / outputHeight),
  };
}

export function clampSourceRect(rect) {
  const width = Math.min(rect.width, 1);
  const height = Math.min(rect.height, 1);
  return {
    x: Math.min(Math.max(rect.x, 0), 1 - width),
    y: Math.min(Math.max(rect.y, 0), 1 - height),
    width,
    height,
  };
}
