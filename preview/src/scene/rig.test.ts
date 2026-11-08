import { describe, expect, it } from "vitest";
import { appearanceFor, placementFor } from "./layout";
import { qualityFrom } from "./quality";
import {
  BOUNDS,
  clampPhi,
  homeRadius,
  pointerExceededDrag,
  zoomRadius,
} from "./rig";

const ids = ["smart-blinds", "fontloop", "avatars"];

describe("navigation bounds", () => {
  it("treats a small pointer movement as a click and a larger one as a drag", () => {
    expect(pointerExceededDrag(2, 3)).toBe(false);
    expect(pointerExceededDrag(8, 1)).toBe(true);
    expect(pointerExceededDrag(0, 7)).toBe(false);
    expect(pointerExceededDrag(0, 8)).toBe(true);
  });

  it("keeps zoom inside explore and focus limits", () => {
    expect(zoomRadius(20, 8000, "explore")).toBe(BOUNDS.explore.max);
    expect(zoomRadius(20, -8000, "explore")).toBe(BOUNDS.explore.min);
    expect(zoomRadius(6, -8000, "focus")).toBe(BOUNDS.focus.min);
    expect(zoomRadius(6, 8000, "focus")).toBe(BOUNDS.focus.max);
  });

  it("clamps the polar angle so the camera cannot flip over", () => {
    expect(clampPhi(-2)).toBeGreaterThan(0);
    expect(clampPhi(6)).toBeLessThan(Math.PI);
  });

  it("pulls the overview back on a narrow viewport and still fits the bounds", () => {
    const phone = homeRadius(0.45);
    const desk = homeRadius(1.4);
    expect(phone).toBeGreaterThan(desk);
    expect(phone).toBeLessThanOrEqual(BOUNDS.explore.max);
    expect(desk).toBeGreaterThanOrEqual(BOUNDS.explore.min);
  });
});

describe("planets", () => {
  it("gives the three real projects distinct bespoke appearances and separated positions", () => {
    expect(ids.map((id, index) => appearanceFor(id, index))).toEqual(["blinds", "press", "twin"]);
    const positions = ids.map((id, index) => placementFor(id, index, ids.length));
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const [ax, ay, az] = positions[i];
        const [bx, by, bz] = positions[j];
        expect(Math.hypot(ax - bx, ay - by, az - bz)).toBeGreaterThan(6);
      }
    }
  });
});

describe("adaptive quality", () => {
  it("lowers resolution on a phone without dropping the 3D scene", () => {
    const phone = qualityFrom({ coarse: true, width: 390, memory: 4, cores: 8, touchPoints: 5 });
    const desk = qualityFrom({ coarse: false, width: 1440, memory: 16, cores: 8, touchPoints: 0 });
    expect(phone.tier).toBe("adapted");
    expect(desk.tier).toBe("full");
    expect(phone.dprMax).toBeLessThan(desk.dprMax);
    expect(phone.sphereWidth).toBeGreaterThan(16);
    expect(phone.slatCount).toBeGreaterThan(8);
    expect(phone.bladeCount).toBeGreaterThan(8);
    expect(phone.stars).toBeGreaterThan(100);
  });
});
