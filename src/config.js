export const REFERENCE_SIZE = {
  width: 1920,
  height: 1080,
};

// PROVISIONAL: sustituir solo esta constante cuando el autor entregue la pregunta definitiva.
export const QUESTION_TEXT = "¿Qué parte de ti permanece cuando tu imagen cambia?";
export const RESPONSE_MAX_LENGTH = 333;
export const CONFIRMATION_MS = 1100;
export const FINAL_EXPOSURE = 0.92;

export const TIMING = {
  stages: [
    { id: 0, start: 0, duration: 1000 },
    { id: 1, start: 1000, duration: 3000 },
    { id: 2, start: 4000, duration: 5000 },
    { id: 3, start: 9000, duration: 7000 },
    { id: 4, start: 16000, duration: 2000 },
    { id: 5, start: 18000, duration: 2000 },
  ],
  totalDuration: 20000,
};

export const MUTATIONS = {
  stage1: [750, 1500, 2250],
  stage2: [1100, 2400, 3700],
  stage3: [1800, 3900, 5900],
};

export const VISUAL = {
  referenceBlurPx: 140,
  maxBlurMultiplier: 1.15,
  stage1BlurRange: [0.82, 1.15],
  cellBlurChance: 0.54,
  stage2Columns: 4,
  stage2Rows: 3,
  collageFragments: 34,
  collageMutationChance: 0.18,
};

export const CAMERA_CONSTRAINTS = {
  video: {
    facingMode: "user",
    width: { ideal: 1920 },
    height: { ideal: 1080 },
    frameRate: { ideal: 30, max: 60 },
  },
  audio: false,
};
