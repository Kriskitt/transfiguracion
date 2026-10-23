const NS = "http://www.w3.org/2000/svg";
let maskCounter = 0;

function element(name, attributes) {
  const node = document.createElementNS(NS, name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  return node;
}

export function createAnimatedLogo(container, markup, kind, random) {
  container.innerHTML = markup.replace(/^<\?xml[^>]*>\s*/, "");
  const svg = container.querySelector("svg");
  const art = [...svg.children].find((child) => child.tagName.toLowerCase() === "g");
  const view = svg.viewBox.baseVal;
  const defs = element("defs", {});
  const maskId = `logo-reveal-${++maskCounter}`;
  const mask = element("mask", {
    id: maskId, maskUnits: "userSpaceOnUse", x: view.x, y: view.y,
    width: view.width, height: view.height,
  });
  const black = element("rect", { x: view.x, y: view.y, width: view.width, height: view.height, fill: "black" });
  mask.append(black);
  defs.append(mask);
  svg.insertBefore(defs, art);
  art.setAttribute("mask", `url(#${maskId})`);
  let animations = [];
  let raf = 0;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  function play() {
    animations.forEach((animation) => animation.cancel());
    animations = [];
    cancelAnimationFrame(raf);
    mask.replaceChildren(black);
    if (reduced) {
      mask.append(element("rect", { x: view.x, y: view.y, width: view.width, height: view.height, fill: "white" }));
      return;
    }
    const duration = random.range(1250, 1900);
    if (kind === "main") {
      const brushes = element("g", { fill: "none", stroke: "white", "stroke-linecap": "round" });
      mask.append(brushes);
      for (let index = 0; index < 90; index += 1) {
        const x = random.range(view.x - 15, view.x + view.width + 15);
        const y = random.range(view.y - 10, view.y + view.height + 10);
        const dx = random.range(-95, 95);
        const dy = random.range(-45, 45);
        const brush = element("path", {
          d: `M ${x} ${y} Q ${x + dx * 0.43 + random.range(-25, 25)} ${y + dy * 0.43 + random.range(-25, 25)} ${x + dx} ${y + dy}`,
          "stroke-width": random.range(16, 36),
        });
        brushes.append(brush);
        const length = brush.getTotalLength();
        brush.style.strokeDasharray = `${length}`;
        animations.push(brush.animate(
          [{ strokeDashoffset: length }, { strokeDashoffset: 0 }],
          { duration: duration * random.range(0.38, 0.78), delay: duration * random.range(0, 0.52), easing: "ease-out", fill: "both" },
        ));
      }
    } else {
      const circles = [];
      for (let row = 0; row < 9; row += 1) for (let column = 0; column < 14; column += 1) {
        const cellW = view.width / 14;
        const cellH = view.height / 9;
        const x = view.x + column * cellW + random.range(0.15, 0.85) * cellW;
        const y = view.y + row * cellH + random.range(0.15, 0.85) * cellH;
        const circle = element("circle", { cx: x, cy: y, r: 0, fill: "white" });
        mask.append(circle);
        circles.push({ circle, x, y, maxR: Math.hypot(cellW, cellH) * 1.7, delay: random.range(0, 0.6) });
      }
      const started = performance.now();
      const frame = (now) => {
        const progress = Math.min(1, (now - started) / duration);
        for (const item of circles) {
          const t = Math.max(0, Math.min(1, (progress - item.delay) / 0.45));
          item.circle.setAttribute("r", item.maxR * (1 - (1 - t) ** 3));
        }
        if (progress < 1) raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
    }
    const finish = element("rect", { x: view.x, y: view.y, width: view.width, height: view.height, fill: "white", opacity: 0 });
    mask.append(finish);
    animations.push(finish.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: duration * 0.22, delay: duration * 0.78, easing: "ease-in", fill: "forwards",
    }));
  }

  function dispose() {
    animations.forEach((animation) => animation.cancel());
    cancelAnimationFrame(raf);
    container.replaceChildren();
  }

  play();
  return { play, dispose };
}
