export type Quality = {
  tier: "full" | "adapted";
  dprMax: number;
  antialias: boolean;
  stars: number;
  sphereWidth: number;
  sphereHeight: number;
  ringSegments: number;
  octaves: number;
  galaxies: number;
  clusters: number;
  rocks: number;
};

export type QualityInput = {
  coarse: boolean;
  width: number;
  memory: number;
  cores: number;
  touchPoints: number;
};

export function qualityFrom(input: QualityInput): Quality {
  const narrowTouch = input.touchPoints > 0 && input.width < 820;
  const adapted = input.coarse || input.memory <= 4 || input.cores <= 4 || narrowTouch;
  if (adapted) {
    return {
      tier: "adapted",
      dprMax: 1.2,
      antialias: false,
      stars: 1600,
      sphereWidth: 72,
      sphereHeight: 48,
      ringSegments: 96,
      octaves: 4,
      galaxies: 2,
      clusters: 3,
      rocks: 420,
    };
  }
  return {
    tier: "full",
    dprMax: 1.5,
    antialias: true,
    stars: 4200,
    sphereWidth: 128,
    sphereHeight: 96,
    ringSegments: 160,
    octaves: 5,
    galaxies: 3,
    clusters: 4,
    rocks: 1100,
  };
}

export function detectQuality(): Quality {
  const nav = navigator as Navigator & { deviceMemory?: number };
  return qualityFrom({
    coarse: window.matchMedia("(pointer: coarse)").matches,
    width: window.innerWidth,
    memory: nav.deviceMemory ?? 8,
    cores: navigator.hardwareConcurrency ?? 8,
    touchPoints: navigator.maxTouchPoints ?? 0,
  });
}
