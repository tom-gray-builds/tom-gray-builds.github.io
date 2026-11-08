import {
  type Vec3,
  add,
  cross,
  dot,
  kindFor,
  normalize,
  scale,
  starPosition,
  starRadius,
  sub,
  systemBound,
  visualRadius,
  litOverviewTheta,
  planetPosition,
} from "./system";
import { pieces } from "../data/content";

export const FOV_DEG = 42;
export const PANEL_BREAKPOINT = 760;
const REM = 16;

export const EXPLORE = { min: 8, max: 160 } as const;

export type Rect = { x: number; y: number; w: number; h: number };
export type Disk = { cx: number; cy: number; r: number };
export type CameraPose = { eye: Vec3; look: Vec3; dist: number };

/**
 * Matches `.panel` in styles.css. The focused planet, including rings, has to
 * sit entirely in the viewport that this rectangle does not cover.
 */
export function panelRect(width: number, height: number): Rect {
  if (width <= PANEL_BREAKPOINT) {
    const h = Math.min(height * 0.62, 36 * REM);
    return { x: 0, y: height - h, w: width, h };
  }
  const left = 1.15 * REM;
  const w = Math.min(26.5 * REM, Math.max(0, width - 2.3 * REM));
  const y = 5.2 * REM;
  const h = Math.max(120, height - 6.4 * REM);
  return { x: left, y, w, h: Math.min(h, height - y) };
}

export function safeViewport(width: number, height: number, focused: boolean): Rect {
  const pad = width <= PANEL_BREAKPOINT ? 16 : 26;
  const top = 68;
  if (!focused) {
    return {
      x: pad,
      y: top,
      w: Math.max(48, width - pad * 2),
      h: Math.max(48, height - top - pad),
    };
  }
  const panel = panelRect(width, height);
  if (width <= PANEL_BREAKPOINT) {
    return {
      x: pad,
      y: top,
      w: Math.max(48, width - pad * 2),
      h: Math.max(48, panel.y - top - pad),
    };
  }
  const x = panel.x + panel.w + pad;
  return {
    x,
    y: top,
    w: Math.max(48, width - x - pad),
    h: Math.max(48, height - top - pad),
  };
}

function halfFov() {
  return (FOV_DEG * Math.PI) / 360;
}

export const SYSTEM_BOUND = systemBound(pieces);

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function homeRadius(aspect: number) {
  const half = halfFov();
  const pad = 1.14;
  const span = SYSTEM_BOUND * pad;
  const distForHeight = span / Math.tan(half);
  const distForWidth = span / (Math.tan(half) * Math.max(aspect, 0.34));
  return clamp(Math.max(distForHeight, distForWidth), EXPLORE.min, EXPLORE.max);
}

export function sphericalOffset(radius: number, phi: number, theta: number): Vec3 {
  const sinPhi = Math.sin(phi);
  return {
    x: radius * sinPhi * Math.sin(theta),
    y: radius * Math.cos(phi),
    z: radius * sinPhi * Math.cos(theta),
  };
}

export function homeCamera(width: number, height: number, time = 0): CameraPose {
  const dist = homeRadius(width / Math.max(height, 1));
  const eye = sphericalOffset(dist, 1.04, litOverviewTheta(time));
  return { eye, look: { x: 0, y: 0.08, z: 0 }, dist };
}

export function focusDistance(visualR: number, width: number, height: number) {
  const safe = safeViewport(width, height, true);
  const fit = Math.min(safe.w, safe.h) * 0.74;
  const dist = (visualR * height) / (Math.max(fit, 24) * Math.tan(halfFov()));
  return Math.max(dist, visualR * 2.35);
}

export function cameraBasis(eye: Vec3, look: Vec3) {
  const z = normalize(sub(eye, look));
  let x = cross({ x: 0, y: 1, z: 0 }, z);
  if (dot(x, x) < 1e-8) x = { x: 1, y: 0, z: 0 };
  x = normalize(x);
  const y = normalize(cross(z, x));
  return { right: x, up: y, back: z };
}

export function framedLook(eye: Vec3, planet: Vec3, width: number, height: number, dist: number): Vec3 {
  const safe = safeViewport(width, height, true);
  const targetX = safe.x + safe.w / 2;
  const targetY = safe.y + safe.h / 2;
  let look = { ...planet };
  for (let pass = 0; pass < 6; pass++) {
    const projected = projectPoint(planet, eye, look, width, height);
    if (!projected) break;
    const errX = projected.x - targetX;
    const errY = projected.y - targetY;
    if (Math.hypot(errX, errY) < 0.4) break;
    const depth = Math.max(dist, 0.2);
    const halfH = Math.tan(halfFov()) * depth;
    const halfW = halfH * (width / Math.max(height, 1));
    const { right, up } = cameraBasis(eye, look);
    look = add(
      look,
      add(scale(right, (errX / width) * 2 * halfW), scale(up, -(errY / height) * 2 * halfH)),
    );
  }
  return look;
}

export function focusCamera(
  planet: Vec3,
  visualR: number,
  width: number,
  height: number,
  phi = 1.12,
  theta = 0.4,
): CameraPose {
  const dist = focusDistance(visualR, width, height);
  const eye = add(planet, sphericalOffset(dist, phi, theta));
  return { eye, look: framedLook(eye, planet, width, height, dist), dist };
}

export function shortestAngle(current: number, goal: number) {
  const tau = Math.PI * 2;
  return current + ((((goal - current) % tau) + tau + Math.PI) % tau) - Math.PI;
}

export function projectPoint(
  point: Vec3,
  eye: Vec3,
  look: Vec3,
  width: number,
  height: number,
): { x: number; y: number } | null {
  const { right, up, back } = cameraBasis(eye, look);
  const rel = sub(point, eye);
  const cx = dot(rel, right);
  const cy = dot(rel, up);
  const depth = -dot(rel, back);
  if (depth < 0.05) return null;
  const aspect = width / Math.max(height, 1);
  const ndcX = cx / (depth * Math.tan(halfFov()) * aspect);
  const ndcY = cy / (depth * Math.tan(halfFov()));
  return {
    x: (ndcX * 0.5 + 0.5) * width,
    y: (1 - (ndcY * 0.5 + 0.5)) * height,
  };
}

export function projectSphere(
  center: Vec3,
  radius: number,
  eye: Vec3,
  look: Vec3,
  width: number,
  height: number,
): Disk | null {
  const origin = projectPoint(center, eye, look, width, height);
  if (!origin) return null;
  const { right } = cameraBasis(eye, look);
  const edge = projectPoint(add(center, scale(right, radius)), eye, look, width, height);
  if (!edge) return null;
  return { cx: origin.x, cy: origin.y, r: Math.hypot(edge.x - origin.x, edge.y - origin.y) };
}

export function diskInside(disk: Disk, rect: Rect, pad = 0) {
  return (
    disk.cx - disk.r >= rect.x + pad &&
    disk.cx + disk.r <= rect.x + rect.w - pad &&
    disk.cy - disk.r >= rect.y + pad &&
    disk.cy + disk.r <= rect.y + rect.h - pad
  );
}

export function circleHitsRect(disk: Disk, rect: Rect) {
  const nearestX = clamp(disk.cx, rect.x, rect.x + rect.w);
  const nearestY = clamp(disk.cy, rect.y, rect.y + rect.h);
  const dx = disk.cx - nearestX;
  const dy = disk.cy - nearestY;
  return dx * dx + dy * dy < disk.r * disk.r;
}

export function overviewBodies(time: number) {
  const bodies: { id: string; position: Vec3; radius: number }[] = [
    { id: "primary", position: starPosition("primary", time), radius: starRadius("primary") * 2.2 },
    { id: "secondary", position: starPosition("secondary", time), radius: starRadius("secondary") * 2.2 },
  ];
  pieces.forEach((piece, index) => {
    bodies.push({
      id: piece.id,
      position: planetPosition(piece.id, index, time),
      radius: visualRadius(kindFor(piece.id, index)),
    });
  });
  return bodies;
}
