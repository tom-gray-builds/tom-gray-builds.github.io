import { describe, expect, it } from "vitest";
import {
  circleHitsRect,
  diskInside,
  focusCamera,
  homeCamera,
  panelRect,
  projectSphere,
  safeViewport,
} from "./framing";
import {
  distance,
  kindFor,
  orbitFor,
  planetPosition,
  starPosition,
  starRadius,
  sunlitAmount,
  visualRadius,
} from "./system";
import { homeCamera as overviewCamera } from "./framing";
import { pieces } from "../data/content";
import { CLUSTERS, clusterStarSize } from "./clusters";
import { pointerExceededDrag } from "./pointer";
import { qualityFrom } from "./quality";

const ids = pieces.map((piece) => piece.id);
const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "portrait", width: 390, height: 844 },
  { name: "landscape", width: 844, height: 390 },
  { name: "narrow landscape", width: 700, height: 360 },
];
const times = [0, 6, 18, 41, 77];

describe("orbits", () => {
  it("keeps the two suns close, opposite, and different", () => {
    for (const time of times) {
      const a = starPosition("primary", time);
      const b = starPosition("secondary", time);
      expect(distance(a, b)).toBeGreaterThan(1.4);
      expect(distance(a, b)).toBeLessThan(3.2);
      expect(a.x * b.x + a.z * b.z).toBeLessThan(0);
    }
    expect(starRadius("primary")).toBeGreaterThan(starRadius("secondary"));
  });

  it("puts the three projects on separate circumbinary orbits that never overlap", () => {
    expect(ids).toEqual(["smart-blinds", "fontloop", "avatars"]);
    expect(ids.map((id, index) => kindFor(id, index))).toEqual(["ocean", "rocky", "giant"]);
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const gap = Math.abs(orbitFor(ids[i], i).radius - orbitFor(ids[j], j).radius);
        const need = visualRadius(kindFor(ids[i], i)) + visualRadius(kindFor(ids[j], j)) + 0.25;
        expect(gap).toBeGreaterThan(need);
      }
    }
    const start = planetPosition("avatars", 2, 0);
    const later = planetPosition("avatars", 2, 20);
    expect(distance(start, later)).toBeGreaterThan(0.4);
  });
});

describe("first view lighting", () => {
  it("shows a sunlit face with a terminator for every planet, including after they have moved", () => {
    for (const time of [0, 18, 55, 96]) {
      for (const viewport of viewports) {
        const camera = overviewCamera(viewport.width, viewport.height, time);
        pieces.forEach((piece, index) => {
          const position = planetPosition(piece.id, index, time);
          const lit = sunlitAmount(position, camera.eye);
          expect(lit, `${piece.id} ${viewport.name} t=${time}`).toBeGreaterThan(0.34);
          expect(lit, `${piece.id} not fully noon`).toBeLessThan(0.96);
        });
      }
    }
  });
});

describe("overview framing", () => {
  it("fits both stars and every planet, including rings, on desktop and phone", () => {
    for (const viewport of viewports) {
      for (const time of [0, 30, 90]) {
        const camera = homeCamera(viewport.width, viewport.height, time);
        const viewportRect = { x: 0, y: 0, w: viewport.width, h: viewport.height };
        const bodies = [
          { id: "primary", position: starPosition("primary", time), radius: starRadius("primary") * 2.1 },
          { id: "secondary", position: starPosition("secondary", time), radius: starRadius("secondary") * 2.1 },
          ...pieces.map((piece, index) => ({
            id: piece.id,
            position: planetPosition(piece.id, index, time),
            radius: visualRadius(kindFor(piece.id, index)),
          })),
        ];
        for (const body of bodies) {
          const disk = projectSphere(body.position, body.radius, camera.eye, camera.look, viewport.width, viewport.height);
          expect(disk, `${body.id} at ${viewport.name}`).not.toBeNull();
          if (!disk) continue;
          expect(diskInside(disk, viewportRect, 4), `${body.id} leaves ${viewport.name}`).toBe(true);
        }
      }
    }
  });
});

describe("focus framing", () => {
  it("keeps each planet and its rings inside the free area and off the panel while the orbit moves", () => {
    for (const viewport of viewports) {
      const safe = safeViewport(viewport.width, viewport.height, true);
      const panel = panelRect(viewport.width, viewport.height);
      for (const [index, piece] of pieces.entries()) {
        const radius = visualRadius(kindFor(piece.id, index));
        let previous = planetPosition(piece.id, index, 0);
        for (const time of times) {
          const position = planetPosition(piece.id, index, time);
          const camera = focusCamera(position, radius, viewport.width, viewport.height, 1.1, 0.45);
          const disk = projectSphere(position, radius, camera.eye, camera.look, viewport.width, viewport.height);
          expect(disk, piece.id).not.toBeNull();
          if (!disk) continue;
          expect(diskInside(disk, safe, 2), `${piece.id} ${viewport.name} t=${time}`).toBe(true);
          expect(circleHitsRect(disk, panel), `${piece.id} hits panel`).toBe(false);
          expect(Math.abs(camera.dist - distance(camera.eye, position))).toBeLessThan(0.02);
          if (time > 0) expect(distance(position, previous)).toBeGreaterThan(0.05);
          previous = position;
        }
      }
    }
  });
});

describe("globular clusters", () => {
  it("sits in the opening sky on every viewport, clear of the planets", () => {
    for (const viewport of viewports) {
      const camera = homeCamera(viewport.width, viewport.height, 0);
      const frame = { x: 0, y: 0, w: viewport.width, h: viewport.height };
      for (const cluster of CLUSTERS) {
        const disk = projectSphere(
          cluster,
          cluster.scale,
          camera.eye,
          camera.look,
          viewport.width,
          viewport.height,
        );
        expect(disk, `cluster on ${viewport.name}`).not.toBeNull();
        if (!disk) continue;
        expect(diskInside(disk, frame, 6), `cluster leaves ${viewport.name}`).toBe(true);
        pieces.forEach((piece, index) => {
          const planet = projectSphere(
            planetPosition(piece.id, index, 0),
            visualRadius(kindFor(piece.id, index)),
            camera.eye,
            camera.look,
            viewport.width,
            viewport.height,
          );
          expect(planet).not.toBeNull();
          if (!planet) return;
          const gap = Math.hypot(disk.cx - planet.cx, disk.cy - planet.cy);
          expect(gap, `${piece.id} overlaps a cluster on ${viewport.name}`).toBeGreaterThan(disk.r + planet.r + 6);
        });
      }
    }
  });

  it("keeps every star a soft point instead of a pixel block, including up close", () => {
    for (const distance of [28, 48, 90, 180, 340]) {
      for (const luminosity of [0.28, 1, 1.8]) {
        const size = clusterStarSize(luminosity, distance);
        expect(size).toBeLessThanOrEqual(2.45);
        expect(size).toBeGreaterThanOrEqual(0.7);
      }
    }
    expect(clusterStarSize(1, 200)).toBeGreaterThan(1.2);
  });
});

describe("controls", () => {
  it("treats a small pointer movement as a click and a larger one as a drag", () => {
    expect(pointerExceededDrag(2, 3)).toBe(false);
    expect(pointerExceededDrag(8, 1)).toBe(true);
    expect(pointerExceededDrag(0, 8)).toBe(true);
  });
});

describe("adaptive quality", () => {
  it("lowers resolution on a phone without dropping the 3D scene", () => {
    const phone = qualityFrom({ coarse: true, width: 390, memory: 4, cores: 8, touchPoints: 5 });
    const desk = qualityFrom({ coarse: false, width: 1440, memory: 16, cores: 8, touchPoints: 0 });
    expect(phone.tier).toBe("adapted");
    expect(desk.tier).toBe("full");
    expect(phone.dprMax).toBeLessThan(desk.dprMax);
    expect(phone.sphereWidth).toBeGreaterThan(48);
    expect(phone.stars).toBeGreaterThan(400);
    expect(phone.galaxies).toBeGreaterThan(0);
    expect(phone.clusters).toBeGreaterThan(0);
    expect(desk.octaves).toBeGreaterThanOrEqual(phone.octaves);
  });
});
