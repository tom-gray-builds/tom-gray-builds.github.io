/**
 * Deterministic stellar activity. The schedules are not a sine pulse and the
 * two stars do not share a clock. They are still deterministic: the same seed
 * and time always produce the same surface state. Reduced motion freezes time
 * at 0, before the first flare.
 */

export const STAR_ACTIVITY = {
  primary: 1.7,
  secondary: 9.4,
} as const;

export type Flare = {
  start: number;
  duration: number;
  latitude: number;
  longitude: number;
  strength: number;
};

function unitHash(i: number): number {
  let n = Math.imul(i | 0, 747796405) + 2891336453;
  n = Math.imul(n ^ (n >>> 13), 2246822519);
  n = (n ^ (n >>> 16)) >>> 0;
  return n / 4294967295;
}

function channel(seed: number, index: number, slot: number): number {
  const key = Math.imul(Math.round(seed * 1000), 1103515245) ^ Math.imul(index + 1, 1000003 + slot * 97);
  return unitHash(key);
}

/** Irregular brightness in a narrow band. Not a single sine. */
export function stellarBrightness(seed: number, time: number): number {
  const sample = (rate: number, offset: number) => {
    const x = time * rate + offset;
    const i = Math.floor(x);
    const f = x - i;
    const u = f * f * (3 - 2 * f);
    return unitHash(i + Math.round(offset * 100)) * (1 - u) + unitHash(i + 1 + Math.round(offset * 100)) * u;
  };
  const a = sample(0.037, seed * 10);
  const b = sample(0.013, seed * 4.2);
  const c = sample(0.071, seed * 1.7);
  return 0.92 + a * 0.055 + b * 0.034 + c * 0.026;
}

/**
 * Walks an irregular timeline. Each flare ends, then a quiet gap of at least
 * six seconds passes, so a star never has two flares at once and the pair
 * does not pulse in step.
 */
export function flareEvents(seed: number, from: number, to: number): Flare[] {
  const events: Flare[] = [];
  let t = 4 + channel(seed, 0, 0) * 6 + (seed * 3.1) % 9;
  for (let i = 0; i < 500 && t < to; i += 1) {
    const duration = 3.4 + channel(seed, i, 1) * 4.8;
    const gapAfter = 6 + channel(seed, i, 2) * 24;
    if (t + duration > from && t < to) {
      events.push({
        start: t,
        duration,
        latitude: channel(seed, i, 3) * 2 - 1,
        longitude: channel(seed, i, 4) * Math.PI * 2,
        strength: 0.62 + channel(seed, i, 5) * 0.38,
      });
    }
    t += duration + gapAfter;
  }
  return events;
}

export function activeFlare(seed: number, time: number): Flare | null {
  const events = flareEvents(seed, time - 12, time + 0.001);
  return events.find((event) => time >= event.start && time <= event.start + event.duration) ?? null;
}

/** Rise, then a slow uneven fade. Zero outside the flare. */
export function flareEnvelope(time: number, flare: Flare): number {
  const u = (time - flare.start) / flare.duration;
  if (u <= 0 || u >= 1) return 0;
  const rise = 0.22;
  if (u < rise) {
    const x = u / rise;
    return x * x * (3 - 2 * x);
  }
  const x = (u - rise) / (1 - rise);
  return 1 - x * x * (3 - 2 * x);
}

export function flareDirection(flare: Flare): { x: number; y: number; z: number } {
  const lat = flare.latitude * (Math.PI / 2);
  const lon = flare.longitude;
  return {
    x: Math.cos(lat) * Math.cos(lon),
    y: Math.sin(lat),
    z: Math.cos(lat) * Math.sin(lon),
  };
}
