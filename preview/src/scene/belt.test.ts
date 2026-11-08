import { describe, expect, it } from "vitest";
import { beltRocks, cameraClearance, BELT_INNER, BELT_OUTER } from "./belt";
import { bodyRadius, kindFor, planetPosition, visualRadius } from "./system";
import { pieces } from "../data/content";

describe("asteroid belt", () => {
  it("spreads rocks outside the planets, across a depth the camera can travel", () => {
    const rocks = beltRocks(900);
    expect(rocks.length).toBe(900);
    const radii = rocks.map((rock) => Math.hypot(rock.x, rock.z));
    expect(Math.min(...radii)).toBeGreaterThanOrEqual(BELT_INNER - 0.01);
    expect(Math.max(...radii)).toBeLessThanOrEqual(BELT_OUTER + 0.01);
    const mean = radii.reduce((sum, value) => sum + value, 0) / radii.length;
    const spread = Math.sqrt(radii.reduce((sum, value) => sum + (value - mean) ** 2, 0) / radii.length);
    expect(spread).toBeGreaterThan(6);
    const heights = rocks.map((rock) => Math.abs(rock.y));
    expect(Math.max(...heights)).toBeGreaterThan(0.8);
    expect(new Set(rocks.map((rock) => rock.shape)).size).toBe(3);

    for (const time of [0, 40, 90]) {
      pieces.forEach((piece, index) => {
        const planet = planetPosition(piece.id, index, time);
        const limit = visualRadius(kindFor(piece.id, index)) + 0.8;
        for (const rock of rocks) {
          const gap = Math.hypot(rock.x - planet.x, rock.y - planet.y, rock.z - planet.z);
          expect(gap).toBeGreaterThan(limit);
        }
      });
    }
    expect(Math.min(...rocks.map((rock) => Math.hypot(rock.x, rock.y, rock.z)))).toBeGreaterThan(
      bodyRadius("giant") * 4,
    );
  });

  it("fades a rock out before it can fill the lens", () => {
    expect(cameraClearance(0.1)).toBe(0);
    expect(cameraClearance(0.45)).toBe(0);
    expect(cameraClearance(1.1)).toBeGreaterThan(0.2);
    expect(cameraClearance(1.1)).toBeLessThan(0.9);
    expect(cameraClearance(2.4)).toBe(1);
  });
});
