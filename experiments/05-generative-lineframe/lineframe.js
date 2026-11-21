const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const number = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const fmt = value => String(Math.round(value * 1000) / 1000);
const pair = point => `${fmt(point[0])},${fmt(point[1])}`;

function hash(value) {
  let state = 2166136261;
  for (const character of String(value)) {
    state ^= character.charCodeAt(0);
    state = Math.imul(state, 16777619);
  }
  state ^= state >>> 16;
  state = Math.imul(state, 0x7feb352d);
  state ^= state >>> 15;
  return (state >>> 0) / 4294967296;
}

function definition(segments, index, length, curvature) {
  const variation = (index - 3) * 0.018;
  const stretch = (0.82 + length * 0.36) * (1 + variation);
  const bend = (0.72 + curvature * 0.56) * (1 + variation * 0.4);
  const transform = ([x, y]) => [x * stretch, y + x * variation * 0.018];
  const first = transform(segments[0].points[0]);
  const commands = [];
  for (const segment of segments) {
    const points = segment.points.map(transform);
    if (segment.type === 'L') {
      commands.push(`L${pair(points[1])}`);
    } else {
      const [a, c1, c2, b] = points;
      const firstBase = [a[0] + (b[0]-a[0])/3, a[1] + (b[1]-a[1])/3];
      const secondBase = [a[0] + 2*(b[0]-a[0])/3, a[1] + 2*(b[1]-a[1])/3];
      const curve1 = firstBase.map((value, axis) => value + (c1[axis]-value)*bend);
      const curve2 = secondBase.map((value, axis) => value + (c2[axis]-value)*bend);
      commands.push(`C${pair(curve1)} ${pair(curve2)} ${pair(b)}`);
    }
  }
  return { id: `mark-${index}`, d: `M${pair(first)} ${commands.join(' ')} Z`, fill: '#000' };
}

function run(marks, side, start, end, cross, angle, scale, spacing, seed) {
  const span = Math.max(0, end - start);
  const count = Math.max(1, Math.round(span / (19.3 * scale * (0.78 + spacing * 0.44))) + 1);
  for (let index = 0; index < count; index++) {
    const along = count === 1 ? (start + end) / 2 : start + span * index / (count - 1);
    const group = hash(`${seed}:${side}:${Math.floor(index / 7)}`);
    const local = hash(`${seed}:${side}:${index}`);
    const variant = clamp(Math.round(3 + (group - .5) * 4.2 + (local - .5) * 1.2), 0, 6);
    marks.push({ side, x: side === 'top' || side === 'bottom' ? along : cross,
      y: side === 'left' || side === 'right' ? along : cross,
      angle, scale, variant });
  }
}

export function generateLineframe(geometry, options = {}) {
  const width = clamp(number(options.width, 1920), 1, 10000);
  const height = clamp(number(options.height, 1080), 1, 10000);
  const spacing = clamp(number(options.spacing, .5), 0, 1);
  const length = clamp(number(options.length, .5), 0, 1);
  const curvature = clamp(number(options.curvature, .5), 0, 1);
  const seed = String(options.seed ?? 'reference');
  const scale = Math.min(Math.max(.45, Math.min(width / 1920, height / 1080)),
    width / 80, height / 80);
  const definitions = Array.from({ length: 7 }, (_, index) =>
    definition(geometry.measured.canonicalMotif.segments, index, length, curvature));
  const marks = [];
  const safeRun = (side, start, end, cross, angle) => run(marks, side,
    clamp(start * scale, 0, side === 'top' || side === 'bottom' ? width : height),
    clamp(end, 0, side === 'top' || side === 'bottom' ? width : height), cross, angle,
    scale, spacing, seed);
  safeRun('top', 31.5, width - 37.5 * scale, 10.1 * scale, 180);
  safeRun('bottom', 28.5, width - 21.5 * scale, height - 10.2 * scale, 0);
  safeRun('left', 27.6, height - 30.7 * scale, 9.2 * scale, 90);
  safeRun('right', 40.4, height - 37.3 * scale, width - 9.3 * scale, 270);
  const cornerPath = 'M-1,13 L-1,3 C-1,0 0,-1 3,-1 L13,-1 L13,1 L3,1 C1,1 1,2 1,3 L1,13 Z';
  const corners = [
    { x: 9.2 * scale, y: 10.1 * scale, angle: 0 },
    { x: width - 9.3 * scale, y: 10.1 * scale, angle: 90 },
    { x: width - 9.3 * scale, y: height - 10.2 * scale, angle: 180 },
    { x: 9.2 * scale, y: height - 10.2 * scale, angle: 270 },
  ].map(corner => ({ ...corner, scale, d: cornerPath, fill: '#000' }));
  return { width, height, layout: width / height < .72 ? 'portrait' : 'wide',
    definitions, marks, corners, fill: '#000', stroke: 'none' };
}

function render(svg, frame) {
  const ns = 'http://www.w3.org/2000/svg';
  const node = name => document.createElementNS(ns, name);
  svg.setAttribute('viewBox', `0 0 ${frame.width} ${frame.height}`);
  const defs = node('defs');
  for (const definition of frame.definitions) {
    const path = node('path');
    path.setAttribute('id', definition.id);
    path.setAttribute('d', definition.d);
    defs.append(path);
  }
  svg.replaceChildren(defs);
  for (const mark of frame.marks) {
    const use = node('use');
    use.setAttribute('href', `#mark-${mark.variant}`);
    use.setAttribute('transform', `translate(${mark.x} ${mark.y}) rotate(${mark.angle}) scale(${mark.scale})`);
    use.setAttribute('fill', '#000');
    svg.append(use);
  }
  for (const corner of frame.corners) {
    const path = node('path');
    path.setAttribute('d', corner.d);
    path.setAttribute('transform', `translate(${corner.x} ${corner.y}) rotate(${corner.angle}) scale(${corner.scale})`);
    path.setAttribute('fill', '#000');
    svg.append(path);
  }
}

async function boot() {
  const geometry = await fetch(new URL('./analysis/geometry.json', import.meta.url)).then(response => {
    if (!response.ok) throw new Error('Measured geometry unavailable');
    return response.json();
  });
  const stage = document.querySelector('#stage');
  const originalPanel = document.querySelector('#original-panel');
  const generatedFrame = document.querySelector('#generated-frame');
  const originalFrame = document.querySelector('#original-frame');
  const svg = document.querySelector('#generated');
  const seedInput = document.querySelector('#seed');
  const spacingInput = document.querySelector('#spacing');
  const lengthInput = document.querySelector('#length');
  const curvatureInput = document.querySelector('#curvature');
  const previewInput = document.querySelector('#preview');
  const comparisonInput = document.querySelector('#comparison');
  const presets = { desktop: [1920, 1080], tablet: [1024, 768], mobile: [390, 844] };
  seedInput.value = new URLSearchParams(location.search).get('seed') || 'reference';

  function draw() {
    const comparing = comparisonInput.checked;
    const [width, height] = presets[previewInput.value] ||
      [Math.max(1, stage.clientWidth), Math.max(1, stage.clientHeight)];
    const availableWidth = Math.max(1, stage.clientWidth / (comparing ? 2 : 1) - 24);
    const availableHeight = Math.max(1, stage.clientHeight - 32);
    const scale = Math.min(availableWidth / width, availableHeight / height);
    generatedFrame.style.width = `${Math.max(1, Math.floor(width * scale))}px`;
    generatedFrame.style.height = `${Math.max(1, Math.floor(height * scale))}px`;
    const referenceScale = Math.min(availableWidth / 1920, availableHeight / 1080);
    originalFrame.style.width = `${Math.max(1, Math.floor(1920 * referenceScale))}px`;
    originalFrame.style.height = `${Math.max(1, Math.floor(1080 * referenceScale))}px`;
    originalPanel.hidden = !comparing;
    stage.classList.toggle('comparing', comparing);
    const frame = generateLineframe(geometry, { width, height, seed: seedInput.value,
      spacing: spacingInput.value, length: lengthInput.value, curvature: curvatureInput.value });
    render(svg, frame);
    document.querySelector('#count').textContent = `${frame.marks.length} marks`;
    const url = new URL(location.href);
    url.searchParams.set('seed', seedInput.value || 'reference');
    history.replaceState(null, '', url);
  }

  document.querySelector('#regenerate').addEventListener('click', () => {
    seedInput.value = `${seedInput.value || 'reference'}-${Math.floor(Math.random() * 1e9)}`;
    draw();
  });
  for (const control of [seedInput, spacingInput, lengthInput, curvatureInput, previewInput, comparisonInput]) {
    control.addEventListener(control === seedInput ? 'change' : 'input', draw);
  }
  new ResizeObserver(draw).observe(stage);
  draw();
}

if (typeof document !== 'undefined') boot().catch(error => {
  document.querySelector('#count').textContent = error.message;
});
