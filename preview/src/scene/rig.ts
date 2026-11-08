import { systemBound } from "./layout";
import { pieces } from "../data/content";

export const BOUNDS = {
  explore: { min: 11, max: 88 },
  focus: { min: 3.35, max: 13.5 },
} as const;

export const HOME_FOV_DEG = 40;
export const DRAG_THRESHOLD_PX = 7;

export type ViewMode = keyof typeof BOUNDS;

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function clampRadius(radius: number, mode: ViewMode) {
  const bounds = BOUNDS[mode];
  return clamp(radius, bounds.min, bounds.max);
}

export function clampPhi(phi: number) {
  return clamp(phi, 0.28, Math.PI - 0.28);
}

export function pointerExceededDrag(dx: number, dy: number, threshold = DRAG_THRESHOLD_PX) {
  return dx * dx + dy * dy > threshold * threshold;
}

export function zoomRadius(current: number, deltaY: number, mode: ViewMode) {
  return clampRadius(current * Math.exp(deltaY * 0.00115), mode);
}

export const SYSTEM_BOUND = systemBound(pieces);

export function homeRadius(aspect: number) {
  const safe = Math.max(0.42, Math.min(aspect, 1.4));
  const halfFov = (HOME_FOV_DEG * Math.PI) / 360;
  const distance = (SYSTEM_BOUND * 0.98) / (Math.tan(halfFov) * safe);
  return clampRadius(distance, "explore");
}

export function focusDistance() {
  return clampRadius(5.15, "focus");
}

export function shortestAngle(current: number, goal: number) {
  const tau = Math.PI * 2;
  return current + ((((goal - current) % tau) + tau + Math.PI) % tau) - Math.PI;
}
