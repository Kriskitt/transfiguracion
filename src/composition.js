import { MUTATIONS, REFERENCE_SIZE, VISUAL } from "./config.js";
import { clampSourceRect, fitCoverSource, sourceForDest } from "./geometry.js";

export class CompositionController {
  constructor(random) {
    this.random = random;
    this.stageId = null;
    this.mutationIndex = 0;
    this.cells = [];
    this.output = { width: 0, height: 0 };
    this.video = { width: 0, height: 0 };
    this.cover = { x: 0, y: 0, width: 1, height: 1 };
    this.stage1Blur = 1;
    this.stage2Level = 0;
  }

  updateFrame(videoWidth, videoHeight, outputWidth, outputHeight) {
    const previousOutput = this.output;
    const dimensionsChanged =
      this.output.width !== outputWidth ||
      this.output.height !== outputHeight ||
      this.video.width !== videoWidth ||
      this.video.height !== videoHeight;

    this.output = { width: outputWidth, height: outputHeight };
    this.video = { width: videoWidth, height: videoHeight };
    this.cover = fitCoverSource(videoWidth, videoHeight, outputWidth, outputHeight);

    if (dimensionsChanged && this.stageId !== null) {
      if (this.stageId >= 4 && previousOutput.width && previousOutput.height) {
        const scaleX = outputWidth / previousOutput.width;
        const scaleY = outputHeight / previousOutput.height;
        this.cells = this.cells.map((cell) => ({
          ...cell,
          dest: {
            x: cell.dest.x * scaleX,
            y: cell.dest.y * scaleY,
            width: cell.dest.width * scaleX,
            height: cell.dest.height * scaleY,
          },
        }));
      } else {
        this.buildStage(this.stageId);
      }
    }
  }

  getCells(stage, localTime) {
    if (stage.id !== this.stageId) {
      this.stageId = stage.id;
      this.mutationIndex = 0;
      if (stage.id === 2) this.stage2Level = 0;
      this.buildStage(stage.id);
    }

    this.applyDueMutations(stage.id, localTime);
    return this.cells;
  }

  buildStage(stageId) {
    if (stageId === 0) this.cells = this.createStage0();
    if (stageId === 1) this.cells = this.createStage1();
    if (stageId === 2) this.cells = this.createStage2();
    if (stageId === 3) this.cells = this.createStage3();
  }

  applyDueMutations(stageId, localTime) {
    const schedule = this.getSchedule(stageId);
    while (schedule[this.mutationIndex] <= localTime) {
      this.mutate(stageId);
      this.mutationIndex += 1;
    }
  }

  getSchedule(stageId) {
    if (stageId === 1) return MUTATIONS.stage1;
    if (stageId === 2) return MUTATIONS.stage2;
    if (stageId === 3) return MUTATIONS.stage3;
    return [];
  }

  mutate(stageId) {
    if (stageId === 1) {
      this.stage1Blur = this.random.range(...VISUAL.stage1BlurRange);
      this.cells = this.createStage1();
      return;
    }

    if (stageId === 2) {
      this.stage2Level = Math.min(3, this.stage2Level + 1);
      this.cells = this.createStage2();
      return;
    }

    if (stageId === 3) {
      this.cells = this.cells.map((cell) => {
        if (!this.random.chance(VISUAL.collageMutationChance)) return cell;
        const dest = {
          ...cell.dest,
          x: cell.dest.x + this.random.range(-0.035, 0.035) * this.output.width,
          y: cell.dest.y + this.random.range(-0.025, 0.025) * this.output.height,
        };
        return {
          ...this.withVisualTreatment(this.createCell(dest, null, 0)),
          rotation: cell.rotation,
        };
      });
    }
  }

  createStage0() {
    const dest = this.fullDest();
    return [this.createCell(dest, sourceForDest(dest, this.cover, this.output.width, this.output.height), 0)];
  }

  createStage1() {
    const half = Math.floor(this.output.height / 2);
    const top = { x: 0, y: 0, width: this.output.width, height: half };
    const bottom = {
      x: 0,
      y: half,
      width: this.output.width,
      height: this.output.height - half,
    };

    return [
      this.createCell(
        top,
        sourceForDest(top, this.cover, this.output.width, this.output.height),
        this.scaledBlurPx(this.stage1Blur),
      ),
      this.createCell(
        bottom,
        sourceForDest(bottom, this.cover, this.output.width, this.output.height),
        0,
      ),
    ];
  }

  createStage2() {
    const cells = [];
    const columns = VISUAL.stage2Columns;
    const rows = VISUAL.stage2Rows;
    const xEdges = this.equalEdges(this.output.width, columns);
    const yEdges = this.equalEdges(this.output.height, rows);
    const count = columns * rows;
    const priority = (index) => (index * 0.61803398875 + 0.31) % 1;
    const revealOrder = Array.from({ length: count }, (_, index) => index)
      .sort((a, b) => priority(a) - priority(b));
    const altered = new Set(revealOrder.slice(0, Math.round(count * (this.stage2Level + 1) / 4)));

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const dest = {
          x: xEdges[column],
          y: yEdges[row],
          width: xEdges[column + 1] - xEdges[column],
          height: yEdges[row + 1] - yEdges[row],
        };
        const index = row * columns + column;
        cells.push(altered.has(index)
          ? this.createCell(
            dest,
            this.randomSourceForDest(dest),
            this.random.chance(VISUAL.cellBlurChance)
              ? this.scaledBlurPx(this.random.range(0.32, VISUAL.maxBlurMultiplier))
              : 0,
          )
          : this.createCell(dest, null, 0));
      }
    }

    return cells;
  }

  createStage3() {
    return Array.from({ length: VISUAL.collageFragments }, (_, index) =>
      this.createCollageFragment(index),
    );
  }

  createCollageFragment(index) {
    const large = index < 12;
    const column = index % 4;
    const row = Math.floor(index / 4) % 3;
    const width = this.output.width * 0.78 * this.random.range(large ? 0.22 : 0.075, large ? 0.43 : 0.23);
    const height = this.output.height * 0.78 * this.random.range(large ? 0.24 : 0.08, large ? 0.49 : 0.27);
    const x = large
      ? this.output.width * (column / 4 + this.random.range(-0.10, 0.05))
      : this.output.width * this.random.range(-0.08, 0.99);
    const y = large
      ? this.output.height * (row / 3 + this.random.range(-0.09, 0.05))
      : this.output.height * this.random.range(-0.06, 0.94);
    const dest = { x, y, width, height };
    const cell = this.withVisualTreatment(this.createCell(dest, null, 0));
    return {
      ...cell,
      rotation: index === 2 || this.random.chance(0.19) ? 180 : 0,
    };
  }

  withVisualTreatment(cell) {
    const source =
      this.random.chance(0.34) && cell.source
        ? cell.source
        : this.randomSourceForDest(cell.dest);
    const blur = this.random.chance(VISUAL.cellBlurChance)
      ? this.scaledBlurPx(this.random.range(0.32, VISUAL.maxBlurMultiplier))
      : 0;

    return this.createCell(cell.dest, source, blur);
  }

  randomSourceForDest(dest) {
    const corresponding = sourceForDest(dest, this.cover, this.output.width, this.output.height);
    const destAspect = dest.width / dest.height;
    const videoAspect = this.video.width / this.video.height;
    const zoom = this.random.range(0.72, 2.25);
    let width = corresponding.width / zoom;
    let height = (width * videoAspect) / destAspect;

    if (height > 1) {
      height = Math.min(1, corresponding.height / zoom);
      width = (height * destAspect) / videoAspect;
    }

    width = Math.min(width, 1);
    height = Math.min(height, 1);

    const useCoverArea = this.random.chance(0.72);
    const bounds = useCoverArea ? this.cover : { x: 0, y: 0, width: 1, height: 1 };
    const maxX = Math.max(bounds.x, bounds.x + bounds.width - width);
    const maxY = Math.max(bounds.y, bounds.y + bounds.height - height);

    return clampSourceRect({
      x: this.random.range(bounds.x, maxX),
      y: this.random.range(bounds.y, maxY),
      width,
      height,
    });
  }

  createCell(dest, source, blurPx) {
    const actualSource =
      source ?? sourceForDest(dest, this.cover, this.output.width, this.output.height);
    return {
      dest,
      source: clampSourceRect(actualSource),
      blurPx,
      rotation: 0,
    };
  }

  scaledBlurPx(multiplier = 1) {
    return (
      VISUAL.referenceBlurPx *
      (this.output.width / REFERENCE_SIZE.width) *
      multiplier
    );
  }

  fullDest() {
    return { x: 0, y: 0, width: this.output.width, height: this.output.height };
  }

  equalEdges(size, count) {
    return Array.from({ length: count + 1 }, (_, index) =>
      index === count ? size : Math.round((size * index) / count),
    );
  }

}
