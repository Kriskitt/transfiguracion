const MIN_VISIBLE = 64;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function installQuestionDrag(form) {
  let x = 0;
  let y = 0;
  let drag = null;

  function position(nextX, nextY) {
    x = nextX;
    y = nextY;
    form.style.setProperty('--drag-x', `${x}px`);
    form.style.setProperty('--drag-y', `${y}px`);
  }

  function bounds(rect) {
    return {
      minX: MIN_VISIBLE - rect.right + x,
      maxX: window.innerWidth - MIN_VISIBLE - rect.left + x,
      minY: MIN_VISIBLE - rect.bottom + y,
      maxY: window.innerHeight - MIN_VISIBLE - rect.top + y,
    };
  }

  function constrain() {
    if (!form.getClientRects().length) return;
    const limits = bounds(form.getBoundingClientRect());
    position(clamp(x, limits.minX, limits.maxX), clamp(y, limits.minY, limits.maxY));
  }

  form.addEventListener('pointerdown', event => {
    if (drag || (event.pointerType === 'mouse' && event.button !== 0) || event.target.closest('textarea, button')) return;
    drag = { id: event.pointerId, startX: event.clientX, startY: event.clientY, x, y };
    form.setPointerCapture(event.pointerId);
    event.preventDefault();
  });

  form.addEventListener('pointermove', event => {
    if (event.pointerId !== drag?.id) return;
    const limits = bounds(form.getBoundingClientRect());
    position(
      clamp(drag.x + event.clientX - drag.startX, limits.minX, limits.maxX),
      clamp(drag.y + event.clientY - drag.startY, limits.minY, limits.maxY),
    );
    event.preventDefault();
  });

  const stop = event => {
    if (event.pointerId !== drag?.id) return;
    drag = null;
    if (form.hasPointerCapture(event.pointerId)) form.releasePointerCapture(event.pointerId);
  };
  form.addEventListener('pointerup', stop);
  form.addEventListener('pointercancel', stop);
  window.addEventListener('resize', constrain);

  return {
    reset() {
      drag = null;
      position(0, 0);
    },
  };
}
