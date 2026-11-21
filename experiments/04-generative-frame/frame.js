const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const mix = (a, b, t) => a + (b - a) * t;

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

function createBuilder(width, height) {
  const segments = [];
  let current = [0, 0];
  const safe = ([x, y]) => [clamp(x, 0, width), clamp(y, 0, height)];
  return {
    segments,
    mark: () => segments.length,
    line(x, y) {
      const to = safe([x, y]);
      if (Math.hypot(to[0] - current[0], to[1] - current[1]) > 0.0001) {
        segments.push({ type: 'L', from: current, to });
        current = to;
      }
    },
    curve(c1, c2, to) {
      const end = safe(to);
      segments.push({ type: 'C', from: current, c1: safe(c1), c2: safe(c2), to: end });
      current = end;
    },
  };
}

function pointOnCubic(segment, t) {
  const u = 1 - t;
  return [0, 1].map(axis => u**3 * segment.from[axis] + 3*u*u*t * segment.c1[axis] +
    3*u*t*t * segment.c2[axis] + t**3 * segment.to[axis]);
}

function finishPath(role, segments, closed, strokeWidth) {
  const fmt = number => (Math.round(number * 100) / 100).toString();
  const pair = point => `${fmt(point[0])},${fmt(point[1])}`;
  const d = `M${pair(segments[0].from)}` + segments.map(segment => segment.type === 'L'
    ? ` L${pair(segment.to)}`
    : ` C${pair(segment.c1)} ${pair(segment.c2)} ${pair(segment.to)}`).join('') + (closed ? ' Z' : '');
  const samples = segments.flatMap((segment, index) => segment.type === 'L'
    ? (index === 0 ? [segment.from, segment.to] : [segment.to])
    : Array.from({ length: 9 }, (_, sample) => pointOnCubic(segment, sample / 8))
      .filter((_, sample) => index === 0 || sample > 0));
  return { role, d, segments, samples, fill: 'none', strokeWidth };
}

// Five measured upper treads form the reference grammar. Complexity merges or
// divides these spans, so each new step changes the silhouette's turning rhythm.
function stepProfile(count) {
  const spans = [[142.1, 28.2], [114.3, 20.9], [112.3, 40.4],
    [121.2, 35.3], [106, 46.2]];
  while (spans.length > count) {
    const at = spans.length === 5 ? 1 : spans.length - 2;
    spans.splice(at, 2, [spans[at][0] + spans[at + 1][0],
      spans[at][1] + spans[at + 1][1]]);
  }
  while (spans.length < count) {
    const at = spans.reduce((best, span, index) => span[0] > spans[best][0] ? index : best, 0);
    const [width, rise] = spans[at];
    spans.splice(at, 1, [width * 0.54, rise * 0.42], [width * 0.46, rise * 0.58]);
  }
  return spans;
}

function appendRough(builder, width, height, unit, irregularity, random, start, portrait) {
  const anchors = portrait
    ? [start, [.74, .20], [.78, .28], [.80, .33], [.80, .38], [.87, .47],
      [.89, .47], [.90, .45], [.94, .43], [.97, .42], [1, .414]].map((p, i) => i ? [p[0]*width, p[1]*height] : p)
    : [start, [.77, .262], [.79, .30], [.831, .367], [.832, .425], [.882, .494],
      [.892, .493], [.909, .46], [.939, .433], [.973, .42], [1, .414]].map((p, i) => i ? [p[0]*width, p[1]*height] : p);
  // The long plateau and vertical drop are quiet. Fine strokes accumulate at
  // the broken shoulder and on the valley's rising side, as in the SVG.
  const detail = [1, 9, 10, 0, 7, 0, 3, 9, 6, 3];
  const amplitude = [0.4, 11, 8, 0, 4, 0, 4, 12, 9, 2];
  let drift = 0;
  for (let section = 0; section < anchors.length - 1; section++) {
    const a = anchors[section], b = anchors[section + 1];
    const before = anchors[Math.max(0, section - 1)];
    const after = anchors[Math.min(anchors.length - 1, section + 2)];
    const vertical = section === 3;
    const c1 = vertical ? [a[0], mix(a[1], b[1], 1/3)] :
      [a[0] + (b[0] - before[0]) / 6, a[1] + (b[1] - before[1]) / 6];
    const c2 = vertical ? [b[0], mix(a[1], b[1], 2/3)] :
      [b[0] - (after[0] - a[0]) / 6, b[1] - (after[1] - a[1]) / 6];
    const macro = { from: a, c1, c2, to: b };
    const count = 1 + Math.round(detail[section] * (irregularity ? .35 + .65 * irregularity : 0));
    if (vertical) {
      builder.line(b[0], b[1]);
      continue;
    }
    const positions = [a];
    for (let i = 1; i < count; i++) {
      const t = i / count;
      const p = pointOnCubic(macro, t);
      const left = pointOnCubic(macro, Math.max(0, t - .01));
      const right = pointOnCubic(macro, Math.min(1, t + .01));
      const dx = right[0] - left[0], dy = right[1] - left[1];
      const length = Math.max(.001, Math.hypot(dx, dy));
      drift = clamp(drift * .68 + (random() - .5) * amplitude[section] * unit * 2,
        -amplitude[section] * unit, amplitude[section] * unit);
      const offset = irregularity * drift * Math.sin(Math.PI * t);
      const fold = ((section === 1 && i === Math.round(count * .5)) ||
        (section === 2 && i === Math.round(count * .35)) ||
        (section === 7 && i === Math.round(count * .58)) ||
        (section === 8 && i === Math.round(count * .48)))
        ? irregularity * (section === 8 ? 14 : 24) * unit : 0;
      positions.push([p[0] - dy / length * offset - fold,
        p[1] + dx / length * offset + fold * .08]);
    }
    positions.push(b);
    for (let i = 1; i < positions.length; i++) {
      const previous = positions[i - 1], next = positions[i];
      const beforePoint = positions[Math.max(0, i - 2)];
      const afterPoint = positions[Math.min(positions.length - 1, i + 1)];
      const chord = Math.hypot(next[0] - previous[0], next[1] - previous[1]);
      const incomingLength = Math.max(.001, Math.hypot(next[0] - beforePoint[0], next[1] - beforePoint[1]));
      const outgoingLength = Math.max(.001, Math.hypot(afterPoint[0] - previous[0], afterPoint[1] - previous[1]));
      const handle = chord / 3;
      const first = handle * (1 + (random() - .5) * irregularity * .3);
      const second = handle * (1 + (random() - .5) * irregularity * .3);
      if ((section === 1 || section === 2 || section === 7 || section === 8) && i % 3 === 0) {
        builder.line(next[0], next[1]);
      } else {
        builder.curve([previous[0] + (next[0] - beforePoint[0]) / incomingLength * first,
          previous[1] + (next[1] - beforePoint[1]) / incomingLength * first],
        [next[0] - (afterPoint[0] - previous[0]) / outgoingLength * second,
          next[1] - (afterPoint[1] - previous[1]) / outgoingLength * second], next);
      }
    }
  }
}

function buildFrame(width, height, random, detailRandom, complexity, irregularity, density) {
  const portrait = width / height < 0.72;
  const unit = Math.min(width / 1920, height / 1080);
  const builder = createBuilder(width, height);
  const ranges = {};
  const section = (name, start) => { ranges[name] = [start, builder.mark()]; };
  const intrusionScale = 0.77 + density * 0.46;

  builder.line(width * (portrait ? 0.19 : 0.375), 0);
  let start = builder.mark();
  const topCount = portrait ? 2 + Math.round(complexity * 2) : 3 + Math.round(complexity * 4);
  const topEndX = width * (portrait ? 0.59 : 0.73);
  const topDepth = Math.min(280 * unit, height * (portrait ? 0.16 : 0.3)) * intrusionScale;
  const topStartX = builder.segments.at(-1).to[0];
  const profile = stepProfile(topCount);
  let treadDrift = 0, riserDrift = 0;
  const weights = profile.map(([width]) => {
    treadDrift = treadDrift * .5 + (random() - .5) * .16;
    return width * (1 + treadDrift);
  });
  const risers = profile.map(([, rise]) => {
    riserDrift = riserDrift * .5 + (random() - .5) * .12;
    return rise * (1 + riserDrift);
  });
  const totalWeight = weights.reduce((sum, value) => sum + value, 0);
  const totalRiser = risers.reduce((sum, value) => sum + value, 0);
  builder.line(topStartX, topDepth * 0.39);
  let x = topStartX, y = topDepth * 0.39;
  for (let index = 0; index < topCount; index++) {
    x = index === topCount - 1 ? topEndX : x + (topEndX - topStartX) * weights[index] / totalWeight;
    builder.line(x, y);
    y = index === topCount - 1 ? topDepth : y + topDepth * 0.61 * risers[index] / totalRiser;
    if (irregularity > 0 && (index === 1 || index === topCount - 1)) {
      const nick = irregularity * (2 + detailRandom() * 3) * unit;
      builder.line(x, y - nick);
      builder.line(x - nick * .5, y - nick * .4);
      builder.curve([x - nick * .3, y - nick * .35], [x + nick * .15, y - nick * .2], [x, y]);
    } else builder.line(x, y);
  }
  builder.line(topEndX, topDepth);
  section('topSteps', start);

  start = builder.mark();
  appendRough(builder, width, height, unit, irregularity, detailRandom, [topEndX, topDepth], portrait);
  section('roughRight', start);

  start = builder.mark();
  builder.line(width, height * 0.91);
  const ridge = height - Math.max(176 * unit, height * 0.16);
  const slope = { from: [width, height * .91],
    c1: [width * .96, height * .875], c2: [width * .88, ridge - 5 * unit],
    to: [width * .84, ridge] };
  const slopeCount = 1 + Math.round(irregularity * 3);
  const slopePoints = [slope.from];
  let slopeDrift = 0;
  for (let i = 1; i < slopeCount; i++) {
    const t = i / slopeCount;
    const p = pointOnCubic(slope, t);
    slopeDrift = .65 * slopeDrift + (detailRandom() - .5) * 2.5 * unit;
    slopePoints.push([p[0], p[1] + irregularity * slopeDrift * Math.sin(Math.PI * t)]);
  }
  slopePoints.push(slope.to);
  if (slopeCount === 1) builder.curve(slope.c1, slope.c2, slope.to);
  else for (let i = 1; i < slopePoints.length; i++) {
    const a = slopePoints[i - 1], b = slopePoints[i];
    const before = slopePoints[Math.max(0, i - 2)];
    const after = slopePoints[Math.min(slopePoints.length - 1, i + 1)];
    builder.curve([a[0] + (b[0] - before[0]) / 3, a[1] + (b[1] - before[1]) / 3],
      [b[0] - (after[0] - a[0]) / 3, b[1] - (after[1] - a[1]) / 3], b);
  }
  const step1 = height - Math.max(111 * unit, height * 0.10);
  const step2 = height - Math.max(53 * unit, height * 0.05);
  const step3 = height - Math.max(25 * unit, height * 0.023);
  const bottomX = [0.79, 0.74, 0.695, 0.635].map((fraction, index) =>
    width * fraction + (random() - 0.5) * unit * (index + 2) * 3);
  const lowerCorner = irregularity * 2.8 * unit;
  builder.line(bottomX[0] + lowerCorner, ridge);
  if (lowerCorner) builder.curve([bottomX[0] + lowerCorner * .45, ridge],
    [bottomX[0], ridge + lowerCorner * .4], [bottomX[0], ridge + lowerCorner]);
  builder.line(bottomX[0], step1);
  builder.line(bottomX[1], step1);
  builder.line(bottomX[1], step2);
  builder.line(bottomX[2], step2);
  builder.line(bottomX[2], step3);
  builder.line(bottomX[3], step3);
  builder.line(bottomX[3], height);
  section('lowerRight', start);

  start = builder.mark();
  builder.line(width * 0.35, height);
  builder.line(width * 0.35, height - 20 * unit);
  builder.line(width * 0.294, height - 20 * unit);
  builder.line(width * 0.294, height - 49 * unit);
  builder.line(width * 0.229, height - 49 * unit);
  builder.line(width * 0.229, height);
  section('bottomPlate', start);

  builder.line(0, height);
  start = builder.mark();
  let leftDrift = 0;
  const leftDepths = [110, 47, 70, 115, 37].map(value => {
    leftDrift = .55 * leftDrift + (random() - .5) * .08;
    return value * unit * intrusionScale * (1 + leftDrift);
  });
  const levels = [0.967, 0.913, 0.809, 0.699, 0.615, 0.453, 0.345].map(fraction =>
    height * fraction + (random() - 0.5) * 4 * unit);
  const [a, b, c, d, e] = leftDepths;
  builder.line(a, height); builder.line(a, levels[0] + irregularity * 2.5 * unit);
  if (irregularity) builder.curve([a, levels[0] + irregularity * unit],
    [a - irregularity * unit, levels[0]], [a - irregularity * 2 * unit, levels[0]]);
  builder.line(b, levels[0]); builder.line(b, levels[1]);
  builder.line(c, levels[1]); builder.line(c, levels[2]);
  builder.line(d, levels[2]); builder.line(d, levels[3] + irregularity * 1.8 * unit);
  if (irregularity) builder.curve([d, levels[3] + irregularity * .7 * unit],
    [d - irregularity * .8 * unit, levels[3]], [d - irregularity * 1.4 * unit, levels[3]]);
  builder.line(c, levels[3]); builder.line(c, levels[4]);
  builder.line(d, levels[4]); builder.line(d, levels[5]);
  builder.line(e, levels[5]); builder.line(e, levels[6]);
  builder.line(0, levels[6]);
  section('lowerLeft', start);

  start = builder.mark();
  const leftTop = height * (portrait ? 0.20 : 0.314);
  const leftScale = intrusionScale * (1 + (random() - 0.5) * 0.08);
  builder.line(0, leftTop);
  builder.line(2.3 * unit, leftTop - 14 * unit);
  builder.line(2.3 * unit, leftTop - 89 * unit);
  builder.line(51 * unit * leftScale, leftTop - 89 * unit);
  builder.line(51 * unit * leftScale, leftTop - 176 * unit);
  builder.line(101 * unit * leftScale, leftTop - 176 * unit);
  builder.line(101 * unit * leftScale, leftTop - 211 * unit);
  builder.line(130 * unit * leftScale, leftTop - 211 * unit);
  builder.line(130 * unit * leftScale, 0);
  builder.line(0, 0);
  section('upperLeft', start);

  const rectScale = Math.min(portrait ? Math.max(unit, 0.36) : unit, width / 180, height / 160);
  const scale = rectScale * (0.85 + density * 0.3);
  const upperWidth = 44.9 * scale, upperHeight = 136.7 * scale;
  const lowerWidth = 145.7 * scale, lowerHeight = 68.9 * scale;
  const rectangles = [
    { x: width - width * 0.075 - upperWidth, y: height * 0.212, width: upperWidth,
      height: upperHeight, fill: 'none', strokeWidth: 0.5 },
    { x: width - width * 0.073 - lowerWidth, y: height - lowerHeight, width: lowerWidth,
      height: lowerHeight, fill: 'none', strokeWidth: 0.5 },
  ];
  return { segments: builder.segments, ranges, rectangles,
    stepCount: topCount + 4, maxIntrusion: Math.max(topDepth, ...leftDepths), portrait };
}

export function generateFrame(options = {}) {
  const width = clamp(finite(options.width, 1920), 1, 10000);
  const height = clamp(finite(options.height, 1080), 1, 10000);
  const complexity = clamp(finite(options.complexity, 0.5), 0, 1);
  const irregularity = clamp(finite(options.irregularity, 0.5), 0, 1);
  const density = clamp(finite(options.density, 0.5), 0, 1);
  const seed = options.seed ?? 'reference';
  const random = randomSource(seed);
  const detailRandom = randomSource(`${seed}:detail`);
  const built = buildFrame(width, height, random, detailRandom, complexity, irregularity, density);
  const strokeWidth = 0.5;
  const paths = [finishPath('primary', built.segments, true, strokeWidth)];
  for (const [name, [start, end]] of Object.entries(built.ranges)) {
    paths.push(finishPath(name, built.segments.slice(start, end), false, strokeWidth));
  }
  return { width, height, layout: built.portrait ? 'portrait' : 'wide', paths,
    rectangles: built.rectangles, strokeWidth, stepCount: built.stepCount,
    maxIntrusion: built.maxIntrusion };
}

function render(svg, frame) {
  const namespace = 'http://www.w3.org/2000/svg';
  svg.setAttribute('viewBox', `0 0 ${frame.width} ${frame.height}`);
  svg.replaceChildren();
  for (const path of frame.paths) {
    const node = document.createElementNS(namespace, 'path');
    node.setAttribute('d', path.d);
    node.setAttribute('fill', 'none');
    node.setAttribute('stroke', '#000');
    node.setAttribute('stroke-width', path.strokeWidth);
    node.setAttribute('stroke-linejoin', 'miter');
    node.setAttribute('stroke-miterlimit', '10');
    node.setAttribute('vector-effect', 'non-scaling-stroke');
    svg.append(node);
  }
  for (const rectangle of frame.rectangles) {
    const node = document.createElementNS(namespace, 'rect');
    for (const key of ['x', 'y', 'width', 'height']) node.setAttribute(key, rectangle[key]);
    node.setAttribute('fill', 'none');
    node.setAttribute('stroke', '#000');
    node.setAttribute('stroke-width', rectangle.strokeWidth);
    node.setAttribute('stroke-miterlimit', '10');
    node.setAttribute('vector-effect', 'non-scaling-stroke');
    svg.append(node);
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
  const irregularityInput = document.querySelector('#irregularity');
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
    const referenceScale = Math.min(availableWidth / 1920, availableHeight / 1080);
    originalFrame.style.width = `${Math.max(1, Math.floor(1920 * referenceScale))}px`;
    originalFrame.style.height = `${Math.max(1, Math.floor(1080 * referenceScale))}px`;
    originalPanel.hidden = !comparing;
    stage.classList.toggle('comparing', comparing);
    const frame = generateFrame({ width: targetWidth, height: targetHeight, seed: seedInput.value,
      complexity: complexityInput.value, irregularity: irregularityInput.value,
      density: densityInput.value });
    render(svg, frame);
    document.querySelector('#count').textContent = `${frame.stepCount} steps · ${frame.paths.length} contours`;
    const url = new URL(location.href);
    url.searchParams.set('seed', seedInput.value || 'reference');
    history.replaceState(null, '', url);
  }

  document.querySelector('#regenerate').addEventListener('click', () => {
    seedInput.value = `${seedInput.value || 'reference'}-${Math.floor(Math.random() * 1e9)}`;
    draw();
  });
  for (const control of [seedInput, complexityInput, irregularityInput, densityInput, previewInput, comparisonInput]) {
    control.addEventListener(control === seedInput ? 'change' : 'input', draw);
  }
  new ResizeObserver(draw).observe(stage);
  draw();
}

if (typeof document !== 'undefined') boot();
