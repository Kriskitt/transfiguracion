import { archiveEntries } from "../data/archive.js";
import { ARCHIVE_MAX_DEPTH, clampDepth, clampPan, isArchivePanelVisible } from "../archive-math.js";
import { createExperimentalParagraph } from "../effects/typography.js";

const SPOTS = [
  [-410, -290, -250], [505, -210, -690], [-500, 275, -1130],
  [490, 280, -1670], [-100, -80, -2410], [490, -270, -3080],
  [-550, 200, -3830], [240, 230, -4560], [-150, -150, -6300],
];

export class ArchiveView {
  constructor(root, random) {
    this.root = root;
    this.viewport = root.querySelector("#archiveViewport");
    this.random = random;
    this.screen = root.querySelector("#archiveScreen");
    this.world = root.querySelector("#archiveWorld");
    this.counter = root.querySelector("#archiveCounter");
    this.coordinates = root.querySelector("#archiveCoordinates");
    this.panels = [];
    this.targetZ = 0;
    this.cameraZ = 0;
    this.targetX = 0;
    this.targetY = 0;
    this.panX = 0;
    this.panY = 0;
    this.last = 0;
    this.raf = 0;
    this.drag = null;
    this.active = false;
    this.disposed = false;
    this.onWheel = this.onWheel.bind(this);
    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);
    this.onKeyDown = this.onKeyDown.bind(this);
    this.resize = this.resize.bind(this);
    this.tick = this.tick.bind(this);
  }

  async mount() {
    await Promise.all(["HaasLight", "HaasRoman", "HaasMedium"].map((font) => document.fonts.load(`64px ${font}`)));
    if (this.disposed) return;
    this.world.replaceChildren();
    this.panels = archiveEntries.map((entry, index) => {
      const [spotX, spotY, spotZ] = SPOTS[index];
      const width = this.random.range(640, 990);
      const fontSize = this.random.range(43, 68);
      const panel = document.createElement("div");
      panel.className = "archive-panel";
      panel.style.width = `${width}px`;
      panel.append(createExperimentalParagraph(entry.text, width - 8, fontSize, this.random));
      this.world.append(panel);
      return {
        element: panel,
        x: spotX + this.random.range(-130, 130),
        y: spotY + this.random.range(-85, 85),
        z: spotZ + this.random.range(-65, 65),
        width,
        height: panel.offsetHeight,
      };
    });
    this.viewport.addEventListener("wheel", this.onWheel, { passive: false });
    this.viewport.addEventListener("pointerdown", this.onPointerDown);
    this.viewport.addEventListener("pointermove", this.onPointerMove);
    this.viewport.addEventListener("pointerup", this.onPointerUp);
    this.viewport.addEventListener("pointercancel", this.onPointerUp);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("resize", this.resize);
    this.resize();
    this.update();
    this.resume();
  }

  resize() {
    const scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    this.screen.style.transform = `translate(-50%, -50%) scale(${scale})`;
  }

  onWheel(event) {
    if (!this.active) return;
    event.preventDefault();
    const unit = event.deltaMode === 1 ? 28 : event.deltaMode === 2 ? 700 : 1;
    this.targetZ = clampDepth(this.targetZ + event.deltaY * unit * 2.1);
  }

  onKeyDown(event) {
    if (!this.active || ["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)) return;
    if (!["ArrowDown", "PageDown", " ", "ArrowUp", "PageUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    if (event.key === "Home") this.targetZ = 0;
    else if (event.key === "End") this.targetZ = ARCHIVE_MAX_DEPTH;
    else this.targetZ = clampDepth(this.targetZ + (["ArrowUp", "PageUp"].includes(event.key) ? -620 : 620));
  }

  onPointerDown(event) {
    if (!this.active || (event.pointerType === "mouse" && event.button !== 0)) return;
    this.drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
    this.viewport.setPointerCapture(event.pointerId);
    this.viewport.classList.add("dragging");
  }

  onPointerMove(event) {
    if (!this.active || !this.drag || event.pointerId !== this.drag.id) return;
    const scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    this.targetX += (event.clientX - this.drag.x) / scale;
    this.targetY += (event.clientY - this.drag.y) / scale;
    this.drag.x = event.clientX;
    this.drag.y = event.clientY;
    this.limitPan();
  }

  onPointerUp(event) {
    if (!this.drag || event.pointerId !== this.drag.id) return;
    this.drag = null;
    this.viewport.classList.remove("dragging");
    if (this.viewport.hasPointerCapture(event.pointerId)) this.viewport.releasePointerCapture(event.pointerId);
  }

  limitPan() {
    if (!this.panels.length) return;
    const index = Math.min(this.panels.length - 1, Math.floor((this.cameraZ / ARCHIVE_MAX_DEPTH) * this.panels.length));
    const panel = this.panels[index];
    const z = Math.min(800, panel.z + this.cameraZ);
    this.targetX = clampPan(this.targetX, { center: panel.x, size: panel.width, z }, 1920, 1100, 650);
    this.targetY = clampPan(this.targetY, { center: panel.y, size: panel.height, z }, 1080, 1100, 380);
  }

  update() {
    this.world.style.transform = `translate3d(${this.panX}px, ${this.panY}px, 0)`;
    for (const panel of this.panels) {
      const z = panel.z + this.cameraZ;
      panel.element.style.transform = `translate3d(${panel.x}px, ${panel.y}px, ${z}px) translate(-50%, -50%)`;
      panel.element.style.visibility = isArchivePanelVisible(z) ? "visible" : "hidden";
      panel.element.style.opacity = z > 800 ? String(Math.max(0, (1040 - z) / 240)) : "1";
    }
    const index = Math.min(this.panels.length, Math.floor(this.cameraZ / ARCHIVE_MAX_DEPTH * this.panels.length) + 1);
    this.counter.textContent = `${index}/${this.panels.length}`;
    this.coordinates.textContent = `X ${Math.round(this.panX)} / ±650   Y ${Math.round(this.panY)} / ±380   Z ${Math.round(this.cameraZ)}`;
  }

  tick(now) {
    if (!this.active || this.disposed) return;
    const delta = Math.min(64, now - (this.last || now));
    this.last = now;
    this.cameraZ += (this.targetZ - this.cameraZ) * (1 - Math.exp(-delta * 0.009));
    this.limitPan();
    this.panX += (this.targetX - this.panX) * (1 - Math.exp(-delta * 0.024));
    this.panY += (this.targetY - this.panY) * (1 - Math.exp(-delta * 0.024));
    this.update();
    this.raf = requestAnimationFrame(this.tick);
  }

  pause() {
    this.active = false;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.last = 0;
    this.drag = null;
    this.viewport.classList.remove("dragging");
  }

  resume() {
    if (this.disposed || this.active) return;
    this.active = true;
    this.raf = requestAnimationFrame(this.tick);
  }

  dispose() {
    this.pause();
    this.disposed = true;
    this.viewport.removeEventListener("wheel", this.onWheel);
    this.viewport.removeEventListener("pointerdown", this.onPointerDown);
    this.viewport.removeEventListener("pointermove", this.onPointerMove);
    this.viewport.removeEventListener("pointerup", this.onPointerUp);
    this.viewport.removeEventListener("pointercancel", this.onPointerUp);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("resize", this.resize);
    this.world.replaceChildren();
  }
}
