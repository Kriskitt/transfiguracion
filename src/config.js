export const REFERENCE_SIZE = {
  width: 1920,
  height: 1080,
};

export const QUESTION_TITLES = [
  "¿Qué existe en el futuro que imaginas?",
  "¿Qué observas?",
  "¿Qué escuchas?",
];
export const RESPONSE_MAX_LENGTH = 333;
export const CONFIRMATION_MS = 1100;
export const FINAL_EXPOSURE = 0.92;

export const TIMING = {
  totalDuration: 24000,
  firstDuration: 2000,
  middleDuration: 16000,
  randomDurationRange: [500, 1500],
  randomCountRange: [16, 24],
  collageDuration: 4000,
  finalDuration: 2000,
};

export const VISUAL = {
  stage2EventsPerOccurrence: 4,
  referenceBlurPx: 140,
  maxBlurMultiplier: 1.15,
  stage1BlurRange: [0.82, 1.15],
  cellBlurChance: 0.54,
  stage2Columns: 4,
  stage2Rows: 3,
  collageFragments: 48,
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
