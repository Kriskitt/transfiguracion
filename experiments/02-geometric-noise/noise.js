const REFERENCE = { width: 1920, height: 1080, xPitch: 24, yPitch: 7.62, yOrigin: 335.7 };
const MODULE_RATIO = 7.6 / 24;

function hashSeed(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function randomAt(x, y, seed) {
  let value = Math.imul(x + 0x9e3779b9, 0x85ebca6b) ^
    Math.imul(y + 0xc2b2ae35, 0x27d4eb2f) ^ seed;
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}

function smoothNoise(x, y, seed) {
  const left = Math.floor(x);
  const top = Math.floor(y);
  const sx = (x - left) ** 2 * (3 - 2 * (x - left));
  const sy = (y - top) ** 2 * (3 - 2 * (y - top));
  const upper = randomAt(left, top, seed) * (1 - sx) + randomAt(left + 1, top, seed) * sx;
  const lower = randomAt(left, top + 1, seed) * (1 - sx) + randomAt(left + 1, top + 1, seed) * sx;
  return upper * (1 - sy) + lower * sy;
}

function readTemplate(geometry) {
  const occupied = new Set();
  geometry.template.rows.forEach((runs, row) => {
    for (const [start, end] of runs) {
      for (let column = start; column <= end; column++) occupied.add(`${column},${row}`);
    }
  });
  return occupied;
}

function labelMotifs(occupied) {
  const components = [];
  const visited = new Set();
  for (const key of occupied) {
    if (visited.has(key)) continue;
    const stack = [key];
    const component = [];
    visited.add(key);
    while (stack.length) {
      const current = stack.pop();
      component.push(current);
      const [x, y] = current.split(',').map(Number);
      for (const neighbor of [`${x - 1},${y}`, `${x + 1},${y}`, `${x},${y - 1}`, `${x},${y + 1}`]) {
        if (occupied.has(neighbor) && !visited.has(neighbor)) {
          visited.add(neighbor);
          stack.push(neighbor);
        }
      }
    }
    components.push(component);
  }
  components.sort((a, b) => b.length - a.length);
  const labels = new Map();
  components.forEach((component, index) => {
    const columns = component.map(key => Number(key.split(',')[0]));
    const rows = component.map(key => Number(key.split(',')[1]));
    const x = columns.reduce((sum, value) => sum + value, 0) / component.length;
    const y = rows.reduce((sum, value) => sum + value, 0) / component.length;
    const motif = index === 0 ? 0 : index === 1 ? 1 : x >= 60 ? 2 :
      x < 31 && y < 43 ? 0 : 1;
    component.forEach(key => labels.set(key, motif));
  });
  return labels;
}

function nearbyCount(occupied, x, y) {
  return Number(occupied.has(`${x - 1},${y}`)) + Number(occupied.has(`${x + 1},${y}`)) +
    Number(occupied.has(`${x},${y - 1}`)) + Number(occupied.has(`${x},${y + 1}`));
}

function colorFor(column, row, seed) {
  const tint = randomAt(column, row, seed ^ 0x6435f41a);
  if (tint > 0.999) return '#f7f7f7';
  if (tint < 0.049) {
    const shade = Math.floor(randomAt(column, row, seed ^ 0xf832914a) * 31);
    const hex = shade.toString(16).padStart(2, '0');
    return `#${hex}${hex}${hex}`;
  }
  return '#000000';
}

function generateCells(geometry, seed, density) {
  const source = readTemplate(geometry);
  const labels = labelMotifs(source);
  const result = [];
  const seedNumber = hashSeed(seed);
  for (let row = 0; row < geometry.template.gridHeight; row++) {
    for (let column = 0; column < geometry.template.gridWidth; column++) {
      const sourceX = Math.round(column + (smoothNoise(column / 10, row / 9, seedNumber) - 0.5) * 3.2);
      const sourceY = Math.round(row + (smoothNoise(column / 9, row / 11, seedNumber ^ 0x7a4b9e17) - 0.5) * 2.2);
      const sourceKey = `${sourceX},${sourceY}`;
      const inside = source.has(sourceKey);
      const neighbors = nearbyCount(source, sourceX, sourceY);
      const boundary = smoothNoise(column / 3.4, row / 4.2, seedNumber ^ 0x390b7c59);
      const keep = inside
        ? neighbors >= 3 || boundary > 0.55 - density * 0.45
        : neighbors >= 2 && boundary > 0.92 - density * 0.35;
      if (!keep) continue;
      const motif = labels.get(sourceKey) ?? (sourceX >= 60 ? 2 : sourceX < 31 && sourceY < 43 ? 0 : 1);
      result.push({ column, row, motif, color: colorFor(column, row, seedNumber) });
    }
  }
  return result;
}

function placeWide(cells, width, height, moduleScale) {
  const scale = Math.min(width / REFERENCE.width, height / 720) * moduleScale;
  const moduleWidth = REFERENCE.xPitch * scale;
  const moduleHeight = 7.6 * scale;
  const originX = (width - REFERENCE.width * scale) / 2;
  const originY = (height - REFERENCE.height * scale) / 2;
  return {
    layout: 'wide', width, height, moduleWidth, moduleHeight,
    cells: cells.map(cell => ({
      ...cell,
      x: originX + cell.column * moduleWidth,
      y: originY + (REFERENCE.yOrigin + cell.row * REFERENCE.yPitch) * scale
    })).filter(cell => cell.x >= 0 && cell.y >= 0 &&
      cell.x + moduleWidth <= width + 0.01 && cell.y + moduleHeight <= height + 0.01)
  };
}

function placeMobile(cells, width, height, moduleScale) {
  const groups = [0, 1, 2].map(motif => cells.filter(cell => cell.motif === motif));
  const bounds = groups.map(group => ({
    minX: Math.min(...group.map(cell => cell.column)),
    minY: Math.min(...group.map(cell => cell.row)),
    columns: Math.max(...group.map(cell => cell.column)) - Math.min(...group.map(cell => cell.column)) + 1,
    rows: Math.max(...group.map(cell => cell.row)) - Math.min(...group.map(cell => cell.row)) + 1
  }));
  const maxColumns = Math.max(...bounds.map(box => box.columns));
  const totalRows = bounds.reduce((sum, box) => sum + box.rows, 0) + 30;
  const moduleWidth = Math.min(width / (maxColumns * 1.27 + 2),
    height / (totalRows * REFERENCE.yPitch / REFERENCE.xPitch * 1.27)) * moduleScale;
  const moduleHeight = moduleWidth * MODULE_RATIO;
  const pitchY = moduleWidth * REFERENCE.yPitch / REFERENCE.xPitch;
  const gap = pitchY * 15;
  const totalHeight = bounds.reduce((sum, box) => sum + box.rows * pitchY, 0) + gap * 2;
  let top = (height - totalHeight) / 2;
  const placed = [];
  groups.forEach((group, motif) => {
    const box = bounds[motif];
    const motifWidth = box.columns * moduleWidth;
    const left = motif === 0 ? Math.max(0, width * 0.04) :
      motif === 1 ? width - motifWidth - width * 0.04 : width - motifWidth - width * 0.075;
    group.forEach(cell => placed.push({
      ...cell,
      x: left + (cell.column - box.minX) * moduleWidth,
      y: top + (cell.row - box.minY) * pitchY
    }));
    top += box.rows * pitchY + gap;
  });
  return { layout: 'mobile', width, height, moduleWidth, moduleHeight,
    cells: placed.filter(cell => cell.x >= 0 && cell.y >= 0 &&
      cell.x + moduleWidth <= width + 0.01 && cell.y + moduleHeight <= height + 0.01) };
}

export function generatePattern(geometry, options) {
  const width = Math.max(1, Number(options.width));
  const height = Math.max(1, Number(options.height));
  const density = Math.min(1, Math.max(0, Number(options.density ?? 0.5)));
  const moduleScale = Math.min(1.2, Math.max(0.7, Number(options.moduleScale ?? 1)));
  const cells = generateCells(geometry, options.seed ?? 'reference', density);
  return width / height < 0.7
    ? placeMobile(cells, width, height, moduleScale)
    : placeWide(cells, width, height, moduleScale);
}

function render(canvas, pattern) {
  const context = canvas.getContext('2d', { alpha: false });
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(pattern.width * ratio);
  canvas.height = Math.round(pattern.height * ratio);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, pattern.width, pattern.height);
  const seamOverlap = 1 / ratio;
  const occupied = new Set(pattern.cells.map(cell => `${cell.motif}:${cell.column},${cell.row}`));
  for (const cell of pattern.cells) {
    context.fillStyle = cell.color;
    const right = occupied.has(`${cell.motif}:${cell.column + 1},${cell.row}`);
    const below = occupied.has(`${cell.motif}:${cell.column},${cell.row + 1}`);
    context.fillRect(cell.x, cell.y, pattern.moduleWidth + (right ? seamOverlap : 0),
      pattern.moduleHeight + (below ? seamOverlap : 0));
  }
}

async function boot() {
  const geometry = await fetch('./analysis/geometry.json').then(response => {
    if (!response.ok) throw new Error(`Geometry unavailable (${response.status})`);
    return response.json();
  });
  const stage = document.querySelector('#stage');
  const frame = document.querySelector('#generated-frame');
  const originalFrame = document.querySelector('#original-frame');
  const originalPanel = document.querySelector('#original-panel');
  const canvas = document.querySelector('#generated');
  const seedInput = document.querySelector('#seed');
  const densityInput = document.querySelector('#density');
  const moduleInput = document.querySelector('#module-size');
  const previewInput = document.querySelector('#preview');
  const comparisonInput = document.querySelector('#comparison');
  const presets = { desktop: [1920, 1080], tablet: [1024, 768], mobile: [390, 844] };
  const urlSeed = new URLSearchParams(location.search).get('seed');
  seedInput.value = urlSeed || 'reference';

  function draw() {
    const [targetWidth, targetHeight] = presets[previewInput.value] || [stage.clientWidth, stage.clientHeight];
    const availableWidth = Math.max(1, stage.clientWidth / (comparisonInput.checked ? 2 : 1) - 24);
    const availableHeight = Math.max(1, stage.clientHeight - 24);
    const displayScale = Math.min(availableWidth / targetWidth, availableHeight / targetHeight);
    const displayWidth = Math.floor(targetWidth * displayScale);
    const displayHeight = Math.floor(targetHeight * displayScale);
    for (const panel of [frame, originalFrame]) {
      panel.style.width = `${displayWidth}px`;
      panel.style.height = `${displayHeight}px`;
    }
    originalPanel.hidden = !comparisonInput.checked;
    stage.classList.toggle('comparing', comparisonInput.checked);
    const pattern = generatePattern(geometry, {
      width: targetWidth, height: targetHeight,
      seed: seedInput.value, density: densityInput.value,
      moduleScale: moduleInput.value
    });
    render(canvas, pattern);
    const url = new URL(location.href);
    url.searchParams.set('seed', seedInput.value || 'reference');
    history.replaceState(null, '', url);
    document.querySelector('#count').textContent = `${pattern.cells.length.toLocaleString()} modules`;
  }

  document.querySelector('#regenerate').addEventListener('click', () => {
    seedInput.value = `${seedInput.value || 'reference'}-${Math.floor(Math.random() * 1e9)}`;
    draw();
  });
  for (const control of [seedInput, densityInput, moduleInput, previewInput, comparisonInput]) {
    control.addEventListener(control === seedInput ? 'change' : 'input', draw);
  }
  new ResizeObserver(draw).observe(stage);
  draw();
}

if (typeof document !== 'undefined') {
  boot().catch(error => {
    document.querySelector('#status').textContent = error.message;
  });
}
