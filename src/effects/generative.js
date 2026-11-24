import { generateFrame } from '../../experiments/04-generative-frame/frame.js?generator';
import { generatePattern } from '../../experiments/02-geometric-noise/noise.js?generator';
import noiseGeometry from '../../experiments/02-geometric-noise/analysis/geometry.json';
import outlineArtwork from '../../experiments/outline-01.svg?raw';
import { generateOrnament } from '../../experiments/06-generative-ornament/ornament.js?generator';
import ornamentGeometry from '../../experiments/06-generative-ornament/analysis/geometry.json';
import { generateLineframe } from '../../experiments/05-generative-lineframe/lineframe.js?generator';
import lineframeGeometry from '../../experiments/05-generative-lineframe/analysis/geometry.json';
import { createOrnamentBridges } from './ornament-bridges.js';
import { createRandom } from '../random.js';

const NS = 'http://www.w3.org/2000/svg';
let outlineMotion = null;
let outlineMotionSeed = null;
const el = (name, attributes = {}) => {
  const node = document.createElementNS(NS, name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  return node;
};

function drawNoisePattern(canvas, pattern, ratio, cluster = null) {
  canvas.width = Math.round(pattern.width * ratio);
  canvas.height = Math.round(pattern.height * ratio);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  for (const cell of pattern.cells) {
    if (cluster !== null && cell.motif !== cluster) continue;
    ctx.fillStyle = cell.color;
    ctx.fillRect(cell.x, cell.y, pattern.moduleWidth + 1 / ratio, pattern.moduleHeight + 1 / ratio);
  }
}

export function stopOutlineMotion() {
  outlineMotion?.cancel();
  outlineMotion = null;
  outlineMotionSeed = null;
}

function startOutlineMotion(layer, seed) {
  if (outlineMotion && outlineMotionSeed === seed) return;
  stopOutlineMotion();
  outlineMotionSeed = seed;
  const random = createRandom(`${seed}:outline-motion`);
  const cycle = () => {
    const previous = outlineMotion;
    const animation = layer.animate([
      { transform:'translateY(60px)', offset:0, easing:'ease-in-out' },
      { transform:'translateY(85px)', offset:.25, easing:'ease-in-out' },
      { transform:'translateY(35px)', offset:.75, easing:'ease-in-out' },
      { transform:'translateY(60px)', offset:1 },
    ], { duration:random.range(6000, 10000), fill:'forwards' });
    outlineMotion = animation;
    previous?.cancel();
    animation.onfinish = () => { if (outlineMotion === animation) cycle(); };
  };
  cycle();
}

export function renderGenerativeLayers(root, seed, width, height) {
  const frame = generateFrame({ width, height, seed: `${seed}:frame` });
  const frameSvg = root.querySelector('.gen-frame');
  frameSvg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  frameSvg.replaceChildren(...frame.paths.map(path => el('path', {
    d: path.d, fill: 'none', stroke: '#222', 'stroke-width': path.strokeWidth,
    'vector-effect': 'non-scaling-stroke',
  })), ...frame.rectangles.map(rect => el('rect', { ...rect, fill: 'none', stroke: '#222',
    'stroke-width': rect.strokeWidth, 'vector-effect': 'non-scaling-stroke' })));

  const ratio = Math.min(devicePixelRatio || 1, 1.5);
  drawNoisePattern(root.querySelector('.gen-noise'),
    generatePattern(noiseGeometry, { width, height, seed: `${seed}:noise`, density: .18, moduleScale: 1 }), ratio);
  const motion = createRandom(`${seed}:noise-motion`);
  const targets = [.95, .82, 1];
  root.querySelectorAll('.gen-noise-dense').forEach((canvas, cluster) => {
    drawNoisePattern(canvas,
      generatePattern(noiseGeometry, { width, height, seed: `${seed}:noise`, density: targets[cluster], moduleScale: 1 }),
      ratio, cluster);
    const duration = motion.range(10, 18);
    canvas.style.animationDuration = `${duration}s`;
    canvas.style.animationDelay = `-${motion.range(0, duration)}s`;
  });

  const outlineLayer = root.querySelector('.gen-outline');
  if (!outlineLayer.firstElementChild) {
    outlineLayer.innerHTML = outlineArtwork;
    outlineLayer.querySelector('svg').setAttribute('preserveAspectRatio', 'none');
  }
  startOutlineMotion(outlineLayer, seed);

  const lineframe = generateLineframe(lineframeGeometry, { width, height, seed: `${seed}:lineframe` });
  const lineframeSvg = root.querySelector('.gen-lineframe');
  lineframeSvg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  const definitions = el('defs');
  lineframe.definitions.forEach(item => definitions.append(el('path', { id: item.id, d: item.d })));
  lineframeSvg.replaceChildren(definitions,
    ...lineframe.marks.map(mark => el('use', { href: `#mark-${mark.variant}`,
      transform: `translate(${mark.x} ${mark.y}) rotate(${mark.angle}) scale(${mark.scale})`, fill: '#000' })),
    ...lineframe.corners.map(corner => el('path', { d: corner.d,
      transform: `translate(${corner.x} ${corner.y}) rotate(${corner.angle}) scale(${corner.scale})`, fill: '#000' })));
}

export function renderOrnament(svg, seed, width, height) {
  const frame = generateOrnament(ornamentGeometry, { width, height, seed });
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  const defs = el('defs');
  frame.definitions.forEach(item => defs.append(el('path', { id: item.id, d: item.d })));
  frame.corners.forEach(item => {
    const clip = el('clipPath', { id: item.id });
    clip.append(el('polygon', { points: item.points.map(pair => pair.join(',')).join(' ') }));
    defs.append(clip);
  });
  svg.replaceChildren(defs,
    ...frame.rails.map(r => el('rect', { ...r, fill: '#000' })),
    ...createOrnamentBridges(frame).map(bridge => el('path', {
      class: 'corner-bridge',
      d: `M ${bridge.points.map(point => point.join(' ')).join(' L ')}`,
      fill: 'none', stroke: '#000', 'stroke-width': bridge.width,
      'stroke-linejoin': 'round', 'stroke-linecap': 'butt',
    })),
    ...frame.motifs.map(m => el('use', { href: `#ornament-${m.variant}`, transform: `translate(${m.x} ${m.y}) rotate(${m.angle}) scale(${m.scale})` })),
    ...frame.corners.map(c => el('use', { href: `#ornament-${c.variant}`, transform: `translate(${c.x} ${c.y}) rotate(${c.angle}) scale(${c.scaleX} ${c.scaleY})`, 'clip-path': `url(#${c.id})` })));
}
