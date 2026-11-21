export function renderFinalFrame(renderer, cells, exposure) {
  renderer.render(null, cells, { invert: 1, exposure });
}
