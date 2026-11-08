export type Quality = {
  tier: "full" | "adapted";
  dprMax: number;
  antialias: boolean;
  stars: number;
  envResolution: number;
  sphereWidth: number;
  sphereHeight: number;
  slatCount: number;
  bladeCount: number;
  tickCount: number;
  latheSteps: number;
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
      dprMax: 1.25,
      antialias: false,
      stars: 900,
      envResolution: 64,
      sphereWidth: 48,
      sphereHeight: 32,
      slatCount: 16,
      bladeCount: 28,
      tickCount: 48,
      latheSteps: 56,
    };
  }
  return {
    tier: "full",
    dprMax: 1.6,
    antialias: true,
    stars: 1700,
    envResolution: 128,
    sphereWidth: 80,
    sphereHeight: 56,
    slatCount: 22,
    bladeCount: 42,
    tickCount: 72,
    latheSteps: 96,
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
