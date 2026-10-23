const SVG_NS = "http://www.w3.org/2000/svg";

function pathPoints(random) {
  const a = Math.round(random.range(68, 105));
  const b = Math.round(random.range(22, 34));
  const c = Math.round(random.range(135, 195));
  const d = Math.round(random.range(58, 100));
  return [
    `M 0 ${c} H ${b} V ${a} H ${a} V 0`,
    `M ${1920 - a} 0 V ${b} H ${1920 - d} V ${a} H 1920`,
    `M 0 ${1080 - c} H ${b} V ${1080 - a} H ${a} V 1080`,
    `M ${1920 - a} 1080 V ${1080 - b} H ${1920 - d} V ${1080 - a} H 1920`,
  ];
}

export function createFramePaths(container, random) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 1920 1080");
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("edge-frame");
  const animations = [];
  for (const [index, data] of pathPoints(random).entries()) {
    const track = document.createElementNS(SVG_NS, "path");
    track.setAttribute("d", data);
    track.setAttribute("class", "frame-track");
    svg.append(track);
    const signal = document.createElementNS(SVG_NS, "path");
    signal.setAttribute("d", data);
    signal.setAttribute("class", "frame-signal");
    svg.append(signal);
    animations.push({ track, signal, index });
  }
  container.replaceChildren(svg);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  for (const { track, signal, index } of animations) {
    const length = track.getTotalLength();
    track.style.strokeDasharray = `${length}`;
    signal.style.strokeDasharray = `${Math.round(length * 0.16)} ${Math.round(length * 2)}`;
    if (!reduced) {
      track.animate(
        [{ strokeDashoffset: length }, { strokeDashoffset: 0 }],
        { duration: 1600 + index * 130, delay: index * 90, easing: "ease-out", fill: "both" },
      );
      signal.animate(
        [{ strokeDashoffset: length }, { strokeDashoffset: -length * 0.25 }],
        { duration: 1900 + index * 100, delay: index * 120, easing: "ease-out", fill: "both" },
      );
    }
  }
}
