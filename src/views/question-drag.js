const MIN_VISIBLE = 64;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function installQuestionDrag(form) {
  let x = 0;
  let y = 0;
  let drag = null;

  const minimum = () => ({
    width: Math.min(280, window.innerWidth - 16),
    height: Math.min(window.innerWidth <= 700 ? 150 : 210, window.innerHeight - 16),
  });

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
    if (form.style.width) {
      const rect = form.getBoundingClientRect();
      const width = Math.min(rect.width, window.innerWidth - 16);
      const height = Math.min(rect.height, window.innerHeight - 16);
      placeRect(clamp(rect.left, 8, window.innerWidth - 8 - width),
        clamp(rect.top, 8, window.innerHeight - 8 - height), width, height);
      return;
    }
    const limits = bounds(form.getBoundingClientRect());
    position(clamp(x, limits.minX, limits.maxX), clamp(y, limits.minY, limits.maxY));
  }

  function placeRect(left, top, width, height) {
    form.style.minHeight = `${minimum().height}px`;
    form.style.width = `${width}px`;
    form.style.height = `${height}px`;
    position(left - (window.innerWidth - width) / 2,
      top - parseFloat(getComputedStyle(form).top));
  }

  form.addEventListener('pointerdown', event => {
    if (drag || (event.pointerType === 'mouse' && event.button !== 0)) return;
    const handle = event.target.closest('.question-handle');
    if (handle) {
      const side = [...handle.classList].find(name => name !== 'question-handle');
      if (form.style.width) constrain();
      else {
        const rect = form.getBoundingClientRect();
        placeRect(clamp(rect.left, 8, window.innerWidth - 8 - rect.width),
          clamp(rect.top, 8, window.innerHeight - 8 - rect.height), rect.width, rect.height);
      }
      drag = { type:'resize', id:event.pointerId, startX:event.clientX, startY:event.clientY,
        rect:form.getBoundingClientRect(), horizontal:side.endsWith('left') ? 'left' : 'right',
        vertical:side.startsWith('top') ? 'top' : side.startsWith('bottom') ? 'bottom' : null };
    } else {
      if (event.target.closest('textarea, button')) return;
      drag = { type:'move', id: event.pointerId, startX: event.clientX, startY: event.clientY, x, y };
    }
    form.setPointerCapture(event.pointerId);
    event.preventDefault();
  });

  form.addEventListener('pointermove', event => {
    if (event.pointerId !== drag?.id) return;
    if (drag.type === 'resize') {
      const { rect, horizontal, vertical } = drag;
      const min = minimum();
      let { left, right, top, bottom } = rect;
      if (horizontal === 'left') left = clamp(rect.left + event.clientX - drag.startX,
        8, rect.right - min.width);
      else right = clamp(rect.right + event.clientX - drag.startX,
        rect.left + min.width, window.innerWidth - 8);
      if (vertical === 'top') top = clamp(rect.top + event.clientY - drag.startY,
        8, rect.bottom - min.height);
      else if (vertical === 'bottom') bottom = clamp(rect.bottom + event.clientY - drag.startY,
        rect.top + min.height, window.innerHeight - 8);
      placeRect(left, top, right - left, bottom - top);
      event.preventDefault();
      return;
    }
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
      form.style.removeProperty('width');
      form.style.removeProperty('height');
      form.style.removeProperty('min-height');
      position(0, 0);
    },
  };
}
