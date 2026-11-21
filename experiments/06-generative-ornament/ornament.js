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

function definition(segments, index, bead) {
  const beadScale = (0.85 + bead * 0.3) * (1 + (index - 4) * .012);
  const transform = ([x, y]) => {
    const endWeight = clamp((Math.abs(y) - 3) / 3.5, 0, 1);
    return [x * (1 + (beadScale - 1) * endWeight), y];
  };
  const first = transform(segments[0].points[0]);
  const commands = segments.map(segment => {
    const points = segment.points.map(transform);
    return segment.type === 'C'
      ? `C${pair(points[1])} ${pair(points[2])} ${pair(points[3])}`
      : `L${pair(points[1])}`;
  });
  return { id: `ornament-${index}`, d: `M${pair(first)} ${commands.join(' ')} Z`, fill: '#000' };
}

function run(motifs, side, start, end, cross, angle, scale, spacing, seed) {
  const span = Math.max(0, end - start);
  const count = Math.max(1, Math.ceil(span / (6.9 * scale * (0.8 + spacing * .4))) + 1);
  for (let index = 0; index < count; index++) {
    const along = count === 1 ? (start + end) / 2 : start + span * index / (count - 1);
    const group = hash(`${seed}:${side}:${Math.floor(index / 11)}`);
    const local = hash(`${seed}:${side}:${index}`);
    const variant = clamp(Math.round(4 + (group - .5) * 5 + (local - .5) * 1.2), 0, 8);
    motifs.push({ side, x: side === 'top' || side === 'bottom' ? along : cross,
      y: side === 'left' || side === 'right' ? along : cross,
      angle, scale, variant });
  }
}

function cornerPair(name, x, y, scale, firstAngle, secondAngle) {
  const half = 9.05 * scale;
  const p = [[x - half, y - half], [x + half, y - half],
    [x + half, y + half], [x - half, y + half]];
  const rotations = { tl: 0, tr: 1, br: 2, bl: 3 };
  const rotation = rotations[name];
  const rotated = p.map((_, index) => p[(index + rotation) % 4]);
  return [
    { id: `clip-${name}-a`, points: [rotated[0], rotated[2], rotated[3]],
      x, y, angle: firstAngle, scaleX: scale * 2.6, scaleY: scale, variant: 4 },
    { id: `clip-${name}-b`, points: [rotated[0], rotated[1], rotated[2]],
      x, y, angle: secondAngle, scaleX: scale * 2.6, scaleY: scale, variant: 4 },
  ];
}

export function generateOrnament(geometry, options = {}) {
  const width = clamp(number(options.width, 1920), 1, 10000);
  const height = clamp(number(options.height, 1080), 1, 10000);
  const spacing = clamp(number(options.spacing, .5), 0, 1);
  const bead = clamp(number(options.bead, .5), 0, 1);
  const inset = clamp(number(options.inset, .5), 0, 1);
  const seed = String(options.seed ?? 'reference');
  const scale = Math.min(Math.max(.75, Math.min(width / 1920, height / 1080)),
    width / 120, height / 200);
  const insetFactor = .82 + inset * .36;
  const xLeft = 35.2 * scale * insetFactor;
  const xRight = width - xLeft;
  const yTop = 73 * scale * insetFactor;
  const yBottom = height - yTop;
  const definitions = Array.from({ length: 9 }, (_, index) =>
    definition(geometry.measured.canonicalMotif.segments, index, bead));
  const motifs = [];
  run(motifs, 'top', xLeft + 12.6 * scale, xRight - 12.6 * scale, yTop, 0, scale, spacing, seed);
  run(motifs, 'right', yTop + 12.6 * scale, yBottom - 12.6 * scale, xRight, 90, scale, spacing, seed);
  run(motifs, 'bottom', xLeft + 12.6 * scale, xRight - 12.6 * scale, yBottom, 180, scale, spacing, seed);
  run(motifs, 'left', yTop + 12.6 * scale, yBottom - 12.6 * scale, xLeft, 270, scale, spacing, seed);
  const corners = [
    ...cornerPair('tl', xLeft, yTop, scale, 0, 270),
    ...cornerPair('tr', xRight, yTop, scale, 0, 90),
    ...cornerPair('br', xRight, yBottom, scale, 180, 90),
    ...cornerPair('bl', xLeft, yBottom, scale, 180, 270),
  ];
  const rail = .9 * scale;
  const beadOffset = 6.7 * scale;
  const rails = [];
  for (const y of [yTop, yBottom]) for (const offset of [-beadOffset, beadOffset]) {
    rails.push({ x: xLeft + 9 * scale, y: y + offset - rail/2,
      width: xRight - xLeft - 18 * scale, height: rail });
  }
  for (const x of [xLeft, xRight]) for (const offset of [-beadOffset, beadOffset]) {
    rails.push({ x: x + offset - rail/2, y: yTop + 9 * scale,
      width: rail, height: yBottom - yTop - 18 * scale });
  }
  return { width, height, layout: width / height < .72 ? 'portrait' : 'wide',
    definitions, motifs, corners, rails,
    ground: { x: xLeft, y: yTop, width: xRight - xLeft, height: yBottom - yTop },
    bounds: { left: xLeft - 9.05 * scale, right: xRight + 9.05 * scale,
      top: yTop - 9.05 * scale, bottom: yBottom + 9.05 * scale },
    fill: '#000', stroke: 'none' };
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
  for (const corner of frame.corners) {
    const clip = node('clipPath');
    clip.setAttribute('id', corner.id);
    const polygon = node('polygon');
    polygon.setAttribute('points', corner.points.map(pair).join(' '));
    clip.append(polygon);
    defs.append(clip);
  }
  svg.replaceChildren(defs);
  const ground = node('rect');
  for (const key of ['x', 'y', 'width', 'height']) ground.setAttribute(key, frame.ground[key]);
  ground.setAttribute('fill', '#fff');
  svg.append(ground);
  for (const rail of frame.rails) {
    const rect = node('rect');
    for (const key of ['x', 'y', 'width', 'height']) rect.setAttribute(key, rail[key]);
    rect.setAttribute('fill', '#000');
    svg.append(rect);
  }
  for (const motif of frame.motifs) {
    const use = node('use');
    use.setAttribute('href', `#ornament-${motif.variant}`);
    use.setAttribute('transform', `translate(${motif.x} ${motif.y}) rotate(${motif.angle}) scale(${motif.scale})`);
    use.setAttribute('fill', '#000');
    svg.append(use);
  }
  for (const corner of frame.corners) {
    const use = node('use');
    use.setAttribute('href', `#ornament-${corner.variant}`);
    use.setAttribute('transform', `translate(${corner.x} ${corner.y}) rotate(${corner.angle}) scale(${corner.scaleX} ${corner.scaleY})`);
    use.setAttribute('clip-path', `url(#${corner.id})`);
    use.setAttribute('fill', '#000');
    svg.append(use);
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
  const beadInput = document.querySelector('#bead');
  const insetInput = document.querySelector('#inset');
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
    const frame = generateOrnament(geometry, { width, height, seed: seedInput.value,
      spacing: spacingInput.value, bead: beadInput.value, inset: insetInput.value });
    render(svg, frame);
    document.querySelector('#count').textContent = `${frame.motifs.length} motifs`;
    const url = new URL(location.href);
    url.searchParams.set('seed', seedInput.value || 'reference');
    history.replaceState(null, '', url);
  }

  document.querySelector('#regenerate').addEventListener('click', () => {
    seedInput.value = `${seedInput.value || 'reference'}-${Math.floor(Math.random() * 1e9)}`;
    draw();
  });
  for (const control of [seedInput, spacingInput, beadInput, insetInput, previewInput, comparisonInput]) {
    control.addEventListener(control === seedInput ? 'change' : 'input', draw);
  }
  new ResizeObserver(draw).observe(stage);
  draw();
}

if (typeof document !== 'undefined') boot().catch(error => {
  document.querySelector('#count').textContent = error.message;
});
