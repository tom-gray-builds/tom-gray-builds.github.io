/**
 * A thick belt outside the planetary orbits. The explore camera's radius
 * runs from 8 to 160 and the opening view sits near 38 (desktop) or 80
 * (phone), so these radii put rocks both around the system and along the
 * path the existing drag/zoom camera already travels.
 */

export type Rock = {
  x: number;
  y: number;
  z: number;
  rx: number;
  ry: number;
  rz: number;
  scale: number;
  shape: number;
  shade: number;
};

export const BELT_INNER = 15.2;
export const BELT_OUTER = 52;
export const CAMERA_FADE_NEAR = 0.45;
export const CAMERA_FADE_FAR = 1.75;

function unitHash(i: number): number {
  let n = Math.imul(i | 0, 747796405) + 2891336453;
  n = Math.imul(n ^ (n >>> 13), 2246822519);
  n = (n ^ (n >>> 16)) >>> 0;
  return n / 4294967295;
}

export function beltRocks(count: number): Rock[] {
  const rocks: Rock[] = [];
  for (let i = 0; i < count; i += 1) {
    const a = unitHash(i * 6 + 1);
    const b = unitHash(i * 6 + 2);
    const c = unitHash(i * 6 + 3);
    const d = unitHash(i * 6 + 4);
    const e = unitHash(i * 6 + 5);
    const band = a < 0.58 ? 0 : a < 0.82 ? 1 : 2;
    const radius =
      band === 0 ? BELT_INNER + b * 9 : band === 1 ? 24 + b * 14 : 38 + b * (BELT_OUTER - 38);
    const theta = c * Math.PI * 2;
    const y = (d - 0.5) * (band === 0 ? 2.4 : 3.6) * (0.35 + e);
    const scale = (band === 2 ? 0.22 : 0.08) + e * e * (band === 0 ? 0.34 : 0.62);
    rocks.push({
      x: Math.cos(theta) * radius,
      y,
      z: Math.sin(theta) * radius,
      rx: unitHash(i * 6 + 11) * Math.PI * 2,
      ry: unitHash(i * 6 + 12) * Math.PI * 2,
      rz: unitHash(i * 6 + 13) * Math.PI * 2,
      scale,
      shape: i % 3,
      shade: 0.25 + unitHash(i * 6 + 14) * 0.75,
    });
  }
  return rocks;
}

/** 0 hides a rock inside the lens, 1 leaves it alone. */
export function cameraClearance(distance: number): number {
  if (distance <= CAMERA_FADE_NEAR) return 0;
  if (distance >= CAMERA_FADE_FAR) return 1;
  const t = (distance - CAMERA_FADE_NEAR) / (CAMERA_FADE_FAR - CAMERA_FADE_NEAR);
  return t * t * (3 - 2 * t);
}
