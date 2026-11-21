const WIDE_GESTURES = [
  { end: [1900, 575], loops: [
    [205, 620, 174, 83, true, 0.45, -0.12, 1.87],
    [655, 581, 148, 126, true, -0.15, 0.23, 1.66],
    [1100, 548, 205, 174, false, 0.16, -0.32, 1.77],
    [1500, 460, 226, 141, true, 0.18, 0.28, 1.91],
  ] },
  { end: [1835, 534], loops: [
    [470, 559, 96, 81, true, -0.19, 0.29, -1.69],
    [805, 626, 150, 126, false, 0.17, -0.20, 1.76],
    [1110, 521, 146, 109, false, -0.14, 0.35, -1.64],
    [1285, 587, 179, 135, true, 0.16, -0.36, 1.85],
    [1480, 564, 142, 101, true, -0.20, 0.26, -1.73],
  ] },
  { end: [1715, 657], loops: [
    [564, 644, 139, 76, true, 0.17, -0.25, 1.68],
    [1030, 445, 158, 89, false, -0.21, 0.31, -1.73],
    [1330, 514, 178, 111, true, 0.19, -0.27, 1.84],
    [1450, 636, 115, 76, true, -0.20, 0.34, -1.66],
  ] },
];

const MOBILE_GESTURES = [
  { end: [375, 232], loops: [
    [98, 168, 80, 42, true, 0.25, -0.14, 1.85],
    [185, 181, 43, 39, false, -0.17, 0.31, -1.55],
    [274, 177, 88, 53, true, 0.20, 0.18, 1.72],
  ] },
  { end: [374, 485], loops: [
    [91, 430, 68, 75, true, -0.15, 0.21, 1.70],
    [181, 453, 54, 53, false, 0.19, -0.24, -1.83],
    [278, 437, 85, 84, true, -0.20, 0.16, 1.91],
  ] },
  { end: [374, 737], loops: [
    [88, 680, 61, 58, true, 0.15, -0.27, -1.71],
    [186, 705, 56, 49, false, -0.22, 0.28, 1.63],
    [268, 681, 92, 72, true, 0.21, -0.17, -1.87],
  ] },
];

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;

function randomSource(seed) {
  let state = 2166136261;
  for (const character of String(seed)) {
    state ^= character.charCodeAt(0);
    state = Math.imul(state, 16777619);
  }
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

const distance = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const normalize = vector => {
  const length = Math.hypot(...vector) || 1;
  return [vector[0] / length, vector[1] / length];
};

function curveAt(loop, angle) {
  const { x, y, rx, ry, tilt, bulge, pinch, shear, shoulder, phase } = loop;
  // Coherent angular and radial deformation keeps a loop organic without per-point jitter.
  const bent = angle + pinch * Math.sin(angle + phase) + pinch * 0.32 * Math.sin(2 * angle - phase);
  const ripple = 1 + bulge * Math.sin(bent + phase) + pinch * 0.45 * Math.sin(2 * bent - phase);
  const localX = rx * (ripple * Math.cos(bent) + shear * Math.sin(bent) + shoulder * Math.sin(2 * bent + phase));
  const localY = ry * (ripple * Math.sin(bent) + shoulder * 0.52 * Math.cos(2 * bent - phase));
  return [x + localX * Math.cos(tilt) - localY * Math.sin(tilt),
          y + localX * Math.sin(tilt) + localY * Math.cos(tilt)];
}

function tangentAt(loop, angle) {
  const epsilon = 0.0001;
  const before = curveAt(loop, angle - epsilon);
  const after = curveAt(loop, angle + epsilon);
  return [(after[0] - before[0]) / (2 * epsilon), (after[1] - before[1]) / (2 * epsilon)];
}

function makeLoop([x, y, rx, ry, required, slant, entry, turns], random, complexity, portrait, drift) {
  const zone = portrait ? x / 390 : x / 1920;
  drift[0] = drift[0] * 0.62 + (random() - 0.5) * (portrait ? 9 : 16 + 33 * zone);
  drift[1] = drift[1] * 0.68 + (random() - 0.5) * (portrait ? 12 : 20 + 65 * zone);
  drift[2] = drift[2] * 0.55 + (random() - 0.5) * 0.11;
  const variation = portrait ? 0.09 : 0.08 + zone * 0.10;
  return {
    x: x + drift[0], y: y + drift[1],
    rx: rx * (1 + (random() - 0.5) * variation),
    ry: ry * (1 + (random() - 0.5) * variation * 1.2),
    tilt: (random() - 0.5) * (portrait ? 0.16 : 0.24),
    shear: slant + drift[2],
    shoulder: (0.055 + complexity * 0.06) * (random() < 0.5 ? -1 : 1),
    bulge: (0.06 + complexity * 0.10) * (0.7 + random() * 0.6),
    pinch: (0.045 + complexity * 0.035) * (0.7 + random() * 0.6),
    phase: random() * Math.PI * 2,
    handlePhase: random() * Math.PI * 2,
    handleSkew: 0.08 + zone * 0.10,
    start: Math.PI + entry + (random() - 0.5) * 0.17,
    sweep: Math.PI * (turns + Math.sign(turns) * (random() - 0.5) * 0.15),
  };
}

function handleScaleAt(loop, angle) {
  return 1 + loop.handleSkew * Math.sin(angle + loop.handlePhase);
}

function appendLoop(segments, loop, complexity) {
  const count = 7 + Math.round(complexity * 6);
  const step = loop.sweep / count;
  for (let index = 0; index < count; index++) {
    const a = loop.start + index * step;
    const b = a + step;
    const p0 = segments.length ? segments.at(-1)[3] : curveAt(loop, a);
    const p3 = curveAt(loop, b);
    const ta = tangentAt(loop, a).map(value => value * handleScaleAt(loop, a));
    const tb = tangentAt(loop, b).map(value => value * handleScaleAt(loop, b));
    segments.push([p0,
      [p0[0] + ta[0] * step / 3, p0[1] + ta[1] * step / 3],
      [p3[0] - tb[0] * step / 3, p3[1] - tb[1] * step / 3], p3]);
  }
}

function bridge(segments, fromTangent, nextPoint, toTangent, bias = 0) {
  const start = segments.at(-1)[3];
  const span = distance(start, nextPoint);
  const departingHandle = clamp(span * (0.24 + bias), 15, 110);
  const arrivingHandle = clamp(span * (0.24 - bias), 15, 110);
  const outgoing = normalize(fromTangent);
  const incoming = normalize(toTangent);
  segments.push([start,
    [start[0] + outgoing[0] * departingHandle, start[1] + outgoing[1] * departingHandle],
    [nextPoint[0] - incoming[0] * arrivingHandle, nextPoint[1] - incoming[1] * arrivingHandle],
    nextPoint]);
}

function pointOnCubic(segment, t) {
  const u = 1 - t;
  return [0, 1].map(axis => u**3 * segment[0][axis] + 3*u*u*t * segment[1][axis] +
    3*u*t*t * segment[2][axis] + t**3 * segment[3][axis]);
}

function finishPath(segments, loopCount) {
  const fmt = value => (Math.round(value * 100) / 100).toString();
  const pair = point => `${fmt(point[0])},${fmt(point[1])}`;
  const d = `M${pair(segments[0][0])}` + segments.map(segment =>
    ` C${pair(segment[1])} ${pair(segment[2])} ${pair(segment[3])}`).join('');
  const samples = segments.flatMap((segment, index) =>
    Array.from({ length: 9 }, (_, sample) => pointOnCubic(segment, sample / 8))
      .filter((_, sample) => index === 0 || sample > 0));
  return { d, segments, samples, loopCount };
}

function makePath(gesture, random, complexity, density, portrait, transform) {
  const drift = [0, 0, 0];
  const loops = gesture.loops.filter(item => item[4] || density > 0.05)
    .filter(item => item[4] || random() < Math.min(1, (density * 0.85 + 0.15) * (0.58 + item[0] / (portrait ? 390 : 1920) * 0.65)))
    .map(item => makeLoop(item, random, complexity, portrait, drift));
  const segments = [];
  for (const [index, loop] of loops.entries()) {
    if (index) {
      const previous = loops[index - 1];
      bridge(segments, tangentAt(previous, previous.start + previous.sweep),
        curveAt(loop, loop.start), tangentAt(loop, loop.start),
        (random() - 0.5) * (portrait ? 0.055 : 0.09));
    }
    appendLoop(segments, loop, complexity);
  }
  const last = loops.at(-1);
  bridge(segments, tangentAt(last, last.start + last.sweep), gesture.end,
    [1, (gesture.end[1] - segments.at(-1)[3][1]) / Math.max(30, gesture.end[0] - segments.at(-1)[3][0])]);
  const mapped = segments.map(segment => segment.map(transform));
  return finishPath(mapped, loops.length);
}

function fitPaths(paths, width, height) {
  const points = paths.flatMap(path => path.samples);
  const xs = points.map(point => point[0]);
  const ys = points.map(point => point[1]);
  const left = Math.min(...xs), right = Math.max(...xs);
  const top = Math.min(...ys), bottom = Math.max(...ys);
  const inset = Math.min(8, width * 0.02, height * 0.02);
  const factor = Math.min(1, (width - 2 * inset) / (right - left),
    (height - 2 * inset) / (bottom - top));
  const offsetX = clamp(0, inset - left * factor, width - inset - right * factor);
  const offsetY = clamp(0, inset - top * factor, height - inset - bottom * factor);
  if (factor === 1 && offsetX === 0 && offsetY === 0) return { paths, correction: 1 };
  const fitted = paths.map(path => finishPath(path.segments.map(segment => segment.map(([x, y]) =>
    [x * factor + offsetX, y * factor + offsetY])), path.loopCount));
  return { paths: fitted, correction: factor };
}

export function generateOutline(options = {}) {
  const width = clamp(finite(options.width, 1920), 1, 10000);
  const height = clamp(finite(options.height, 1080), 1, 10000);
  const complexity = clamp(finite(options.complexity, 0.5), 0, 1);
  const density = clamp(finite(options.density, 0.5), 0, 1);
  const portrait = width / height < 0.72;
  const random = randomSource(options.seed ?? 'reference');
  const source = portrait ? MOBILE_GESTURES : WIDE_GESTURES;
  const scale = portrait ? Math.min(width / 390, height / 844) :
    Math.min(Math.max(1, width - 16) / 1920, Math.max(1, height - 16) / 1080);
  const transform = portrait
    ? ([x, y]) => [width / 2 + (x - 195) * scale, height / 2 + (y - 422) * scale]
    : ([x, y]) => [width / 2 + (x - 960) * scale, height / 2 + (y - 540) * scale];
  const fitted = fitPaths(source.map(gesture =>
    makePath(gesture, random, complexity, density, portrait, transform)), width, height);
  const paths = fitted.paths;
  return {
    width, height, layout: portrait ? 'portrait' : 'wide', paths,
    loopCount: paths.reduce((sum, path) => sum + path.loopCount, 0),
    segmentCount: paths.reduce((sum, path) => sum + path.segments.length, 0),
    stroke: { outer: 6, inner: 4, edge: 1, correction: fitted.correction },
  };
}

function render(svg, result) {
  svg.setAttribute('viewBox', `0 0 ${result.width} ${result.height}`);
  svg.replaceChildren();
  const scale = result.layout === 'portrait' ? Math.min(result.width / 390, result.height / 844) :
    Math.min(Math.max(1, result.width - 16) / 1920, Math.max(1, result.height - 16) / 1080);
  for (const path of result.paths) {
    for (const [color, width] of [['#000000', 6], ['#ffffff', 4]]) {
      const node = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      node.setAttribute('d', path.d);
      node.setAttribute('fill', 'none');
      node.setAttribute('stroke', color);
      node.setAttribute('stroke-width', width * scale * result.stroke.correction);
      node.setAttribute('stroke-linecap', 'round');
      node.setAttribute('stroke-linejoin', 'round');
      svg.append(node);
    }
  }
}

function boot() {
  const stage = document.querySelector('#stage');
  const originalPanel = document.querySelector('#original-panel');
  const generatedFrame = document.querySelector('#generated-frame');
  const originalFrame = document.querySelector('#original-frame');
  const svg = document.querySelector('#generated');
  const seedInput = document.querySelector('#seed');
  const complexityInput = document.querySelector('#complexity');
  const densityInput = document.querySelector('#density');
  const previewInput = document.querySelector('#preview');
  const comparisonInput = document.querySelector('#comparison');
  const presets = { desktop: [1920, 1080], tablet: [1024, 768], mobile: [390, 844] };
  seedInput.value = new URLSearchParams(location.search).get('seed') || 'reference';

  function draw() {
    const comparing = comparisonInput.checked;
    const [targetWidth, targetHeight] = presets[previewInput.value] ||
      [Math.max(1, stage.clientWidth), Math.max(1, stage.clientHeight)];
    const availableWidth = Math.max(1, stage.clientWidth / (comparing ? 2 : 1) - 24);
    const availableHeight = Math.max(1, stage.clientHeight - 32);
    const scale = Math.min(availableWidth / targetWidth, availableHeight / targetHeight);
    generatedFrame.style.width = `${Math.max(1, Math.floor(targetWidth * scale))}px`;
    generatedFrame.style.height = `${Math.max(1, Math.floor(targetHeight * scale))}px`;
    const originalScale = Math.min(availableWidth / 1920, availableHeight / 1080);
    originalFrame.style.width = `${Math.max(1, Math.floor(1920 * originalScale))}px`;
    originalFrame.style.height = `${Math.max(1, Math.floor(1080 * originalScale))}px`;
    originalPanel.hidden = !comparing;
    stage.classList.toggle('comparing', comparing);
    const result = generateOutline({ width: targetWidth, height: targetHeight,
      seed: seedInput.value, complexity: complexityInput.value, density: densityInput.value });
    render(svg, result);
    document.querySelector('#count').textContent = `${result.loopCount} loops · ${result.segmentCount} curves`;
    const url = new URL(location.href);
    url.searchParams.set('seed', seedInput.value || 'reference');
    history.replaceState(null, '', url);
  }

  document.querySelector('#regenerate').addEventListener('click', () => {
    seedInput.value = `${seedInput.value || 'reference'}-${Math.floor(Math.random() * 1e9)}`;
    draw();
  });
  for (const control of [seedInput, complexityInput, densityInput, previewInput, comparisonInput]) {
    control.addEventListener(control === seedInput ? 'change' : 'input', draw);
  }
  new ResizeObserver(draw).observe(stage);
  draw();
}

if (typeof document !== 'undefined') boot();
