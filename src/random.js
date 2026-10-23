function xmur3(value) {
  let h = 1779033703 ^ value.length;
  for (let i = 0; i < value.length; i += 1) {
    h = Math.imul(h ^ value.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

function mulberry32(seed) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createSeedFromQuery() {
  const params = new URLSearchParams(window.location.search);
  return params.get("seed");
}

export function createRunSeed(querySeed) {
  if (querySeed) return querySeed;
  const bytes = new Uint32Array(2);
  window.crypto?.getRandomValues?.(bytes);
  return `${Date.now()}-${bytes[0] ?? Math.random()}-${bytes[1] ?? ""}`;
}

export function createRandom(seedText) {
  const seedFactory = xmur3(String(seedText));
  const next = mulberry32(seedFactory());

  return {
    value: next,
    range(min, max) {
      return min + next() * (max - min);
    },
    int(min, max) {
      return Math.floor(this.range(min, max + 1));
    },
    chance(probability) {
      return next() < probability;
    },
    pick(items) {
      return items[Math.floor(next() * items.length)];
    },
  };
}
