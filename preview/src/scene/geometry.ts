import {
  BoxGeometry,
  BufferGeometry,
  LatheGeometry,
  SphereGeometry,
  TorusGeometry,
  Vector2,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Quality } from "./quality";

export type Kit = {
  sphere: SphereGeometry;
  core: SphereGeometry;
  hit: SphereGeometry;
  brassSlats: BufferGeometry;
  bronzeSlats: BufferGeometry;
  blades: BufferGeometry;
  meridian: TorusGeometry;
  glassBand: LatheGeometry;
  ticks: BufferGeometry;
  inkRule: TorusGeometry;
  pearlRing: TorusGeometry;
  twinRingA: TorusGeometry;
  twinRingB: TorusGeometry;
  sortBox: BoxGeometry;
};

const cache = new Map<Quality["tier"], Kit>();

function merge(parts: BufferGeometry[]) {
  const merged = mergeGeometries(parts, false);
  parts.forEach((part) => part.dispose());
  if (!merged) throw new Error("Failed to build planet geometry");
  return merged;
}

function horizontalTorus(major: number, tube: number, tubular: number, radial: number, y: number) {
  const geometry = new TorusGeometry(Math.max(major, 0.05), tube, tubular, radial);
  geometry.rotateX(Math.PI / 2);
  geometry.translate(0, y, 0);
  return geometry;
}

export function buildKit(q: Quality): Kit {
  const radial = q.tier === "full" ? 72 : 40;
  const tubular = q.tier === "full" ? 10 : 6;
  const brass: BufferGeometry[] = [];
  const bronze: BufferGeometry[] = [];

  for (let i = 0; i < q.slatCount; i++) {
    const t = q.slatCount === 1 ? 0.5 : i / (q.slatCount - 1);
    const y = -0.9 + t * 1.8;
    const major = Math.sqrt(Math.max(0, 1 - y * y)) * 1.04;
    if (major < 0.22) continue;
    const slat = horizontalTorus(major, 0.02, tubular, radial, y);
    if (i % 2 === 0) brass.push(slat);
    else bronze.push(slat);
  }

  const blades: BufferGeometry[] = [];
  const blade = new BoxGeometry(0.42, 0.012, 0.2);
  for (let i = 0; i < q.bladeCount; i++) {
    const angle = (i / q.bladeCount) * Math.PI * 2;
    const part = blade.clone();
    part.rotateX(0.55);
    part.translate(1.92, 0, 0);
    part.rotateY(angle);
    blades.push(part);
  }
  blade.dispose();

  const inner = 1.55;
  const outer = 2.15;
  const half = 0.085;
  const bevel = 0.018;
  const glassBand = new LatheGeometry(
    [
      new Vector2(inner + bevel, -half),
      new Vector2(outer - bevel, -half),
      new Vector2(outer, -half + bevel),
      new Vector2(outer, half - bevel),
      new Vector2(outer - bevel, half),
      new Vector2(inner + bevel, half),
      new Vector2(inner, half - bevel),
      new Vector2(inner, -half + bevel),
    ],
    q.latheSteps,
  );

  const ticks: BufferGeometry[] = [];
  const mid = (inner + outer) / 2;
  for (let i = 0; i < q.tickCount; i++) {
    const majorTick = i % 4 === 0;
    const tick = new BoxGeometry(majorTick ? 0.07 : 0.028, majorTick ? 0.012 : 0.008, 0.01);
    tick.translate(mid, half + 0.012, 0);
    tick.rotateY((i / q.tickCount) * Math.PI * 2);
    ticks.push(tick);
  }

  const meridian = new TorusGeometry(1.02, 0.011, tubular, radial);

  return {
    sphere: new SphereGeometry(1, q.sphereWidth, q.sphereHeight),
    core: new SphereGeometry(0.74, Math.max(24, q.sphereWidth / 2), Math.max(16, q.sphereHeight / 2)),
    hit: new SphereGeometry(1.72, 18, 12),
    brassSlats: merge(brass),
    bronzeSlats: merge(bronze),
    blades: merge(blades),
    meridian,
    glassBand,
    ticks: merge(ticks),
    inkRule: new TorusGeometry(1.34, 0.018, tubular, radial),
    pearlRing: new TorusGeometry(1.42, 0.02, tubular, radial),
    twinRingA: new TorusGeometry(1.78, 0.028, tubular, radial),
    twinRingB: new TorusGeometry(2.18, 0.045, tubular, q.tier === "full" ? 96 : 56),
    sortBox: new BoxGeometry(1, 1, 1),
  };
}

export function getKit(q: Quality) {
  const cached = cache.get(q.tier);
  if (cached) return cached;
  const kit = buildKit(q);
  cache.set(q.tier, kit);
  return kit;
}
