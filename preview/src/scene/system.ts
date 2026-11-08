import { pieces } from "../data/content";

export type PlanetKind = "ocean" | "rocky" | "giant";

export type Vec3 = { x: number; y: number; z: number };

export type Orbit = {
  radius: number;
  inclination: number;
  node: number;
  phase: number;
  period: number;
};

const KINDS: Record<string, PlanetKind> = {
  "smart-blinds": "ocean",
  fontloop: "rocky",
  avatars: "giant",
};

const ACCENT: Record<PlanetKind, string> = {
  ocean: "#8fd0ea",
  rocky: "#e2b48a",
  giant: "#f0d7a4",
};

/**
 * Known projects get a composed orbit. Anything added to projects.json later
 * takes the next circumbinary ring from its sort index. See preview/README.md.
 */
const BESPOKE_ORBITS: Record<string, Orbit> = {
  // Same period keeps the three on one sunward arc, so the opening view can
  // see every lit face at once. Radii stay far enough apart not to touch.
  "smart-blinds": { radius: 5.2, inclination: 0.14, node: 0.08, phase: 0.2, period: 150 },
  fontloop: { radius: 7.65, inclination: -0.16, node: 0.22, phase: 0.72, period: 150 },
  avatars: { radius: 10.65, inclination: 0.24, node: -0.06, phase: -0.28, period: 150 },
};

export const BINARY = {
  separation: 2.4,
  period: 86,
  primary: { radius: 0.74, mass: 1.18, color: "#fff3cf" },
  secondary: { radius: 0.52, mass: 0.84, color: "#ffb07a" },
};

export function kindFor(id: string, index: number): PlanetKind {
  return KINDS[id] ?? (["ocean", "rocky", "giant"] as const)[index % 3];
}

export function accentFor(id: string, index: number): string {
  return ACCENT[kindFor(id, index)];
}

export function bodyRadius(kind: PlanetKind): number {
  if (kind === "giant") return 1.12;
  if (kind === "ocean") return 0.7;
  return 0.56;
}

/** Sphere plus atmosphere, or the outer edge of a ring system. */
export function visualRadius(kind: PlanetKind): number {
  const body = bodyRadius(kind);
  if (kind === "giant") return body * 1.82;
  if (kind === "ocean") return body * 1.1;
  return body * 1.07;
}

export function orbitFor(id: string, index: number): Orbit {
  const known = BESPOKE_ORBITS[id];
  if (known) return known;
  return {
    radius: 5.15 + index * 3.15,
    inclination: ((index % 5) - 2) * 0.11,
    node: index * 2.399,
    phase: index * 1.7,
    period: 120 + index * 42,
  };
}

export function orbitPosition(orbit: Orbit, time: number): Vec3 {
  const theta = orbit.phase + (Math.PI * 2 * time) / orbit.period;
  const lx = Math.cos(theta) * orbit.radius;
  const lz = Math.sin(theta) * orbit.radius;
  const cosI = Math.cos(orbit.inclination);
  const sinI = Math.sin(orbit.inclination);
  const y1 = -lz * sinI;
  const z1 = lz * cosI;
  const cosN = Math.cos(orbit.node);
  const sinN = Math.sin(orbit.node);
  return {
    x: lx * cosN + z1 * sinN,
    y: y1,
    z: -lx * sinN + z1 * cosN,
  };
}

export function starPosition(which: "primary" | "secondary", time: number): Vec3 {
  const total = BINARY.primary.mass + BINARY.secondary.mass;
  const other = which === "primary" ? BINARY.secondary.mass : BINARY.primary.mass;
  const dist = (BINARY.separation * other) / total;
  const angle = (Math.PI * 2 * time) / BINARY.period + (which === "primary" ? 0 : Math.PI);
  const inc = 0.42;
  return {
    x: Math.cos(angle) * dist,
    y: Math.sin(angle) * dist * Math.sin(inc),
    z: Math.sin(angle) * dist * Math.cos(inc),
  };
}

export function starRadius(which: "primary" | "secondary"): number {
  return BINARY[which].radius;
}

export function planetPosition(id: string, index: number, time: number): Vec3 {
  return orbitPosition(orbitFor(id, index), time);
}

export function systemBound(ids: { id: string }[]): number {
  let bound = 0;
  ids.forEach((piece, index) => {
    const orbit = orbitFor(piece.id, index);
    bound = Math.max(bound, orbit.radius + visualRadius(kindFor(piece.id, index)));
  });
  const starReach =
    (BINARY.separation * Math.max(BINARY.primary.mass, BINARY.secondary.mass)) /
      (BINARY.primary.mass + BINARY.secondary.mass) +
    Math.max(BINARY.primary.radius, BINARY.secondary.radius) * 2.4;
  return Math.max(bound, starReach);
}

export function add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function scale(a: Vec3, s: number): Vec3 {
  return { x: a.x * s, y: a.y * s, z: a.z * s };
}

export function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

export function len(a: Vec3): number {
  return Math.hypot(a.x, a.y, a.z);
}

export function normalize(a: Vec3): Vec3 {
  const l = len(a) || 1;
  return scale(a, 1 / l);
}

export function distance(a: Vec3, b: Vec3): number {
  return len(sub(a, b));
}

export function clusterAngle(time: number): number {
  let x = 0;
  let z = 0;
  pieces.forEach((piece, index) => {
    const position = planetPosition(piece.id, index, time);
    x += position.x;
    z += position.z;
  });
  return Math.atan2(x, z);
}

/** Camera azimuth that looks past the suns onto the planets' sunlit faces, with a terminator. */
export function litOverviewTheta(time: number): number {
  return clusterAngle(time) + Math.PI + 0.68;
}

export function sunlitAmount(planet: Vec3, eye: Vec3): number {
  const toCamera = normalize(sub(eye, planet));
  const toSun = normalize({ x: -planet.x, y: -planet.y, z: -planet.z });
  return dot(toCamera, toSun);
}

export const sim = { time: 0 };
