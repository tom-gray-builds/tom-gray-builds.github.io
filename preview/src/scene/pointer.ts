export const pointerGate = { dragged: false };

export const DRAG_THRESHOLD_PX = 7;

export function pointerExceededDrag(dx: number, dy: number, threshold = DRAG_THRESHOLD_PX) {
  return dx * dx + dy * dy > threshold * threshold;
}
