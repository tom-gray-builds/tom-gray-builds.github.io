import { describe, expect, it } from "vitest";
import {
  STAR_ACTIVITY,
  activeFlare,
  flareEnvelope,
  flareEvents,
  stellarBrightness,
} from "./stellar";

describe("stellar activity", () => {
  it("keeps each star to one flare at a time, inside a bounded strength and length", () => {
    for (const seed of [STAR_ACTIVITY.primary, STAR_ACTIVITY.secondary]) {
      const events = flareEvents(seed, 0, 400);
      expect(events.length).toBeGreaterThan(8);
      for (let i = 0; i < events.length; i += 1) {
        const event = events[i];
        expect(event.duration).toBeGreaterThan(3);
        expect(event.duration).toBeLessThan(9);
        expect(event.strength).toBeGreaterThan(0.6);
        expect(event.strength).toBeLessThanOrEqual(1);
        expect(event.latitude).toBeGreaterThanOrEqual(-1);
        expect(event.latitude).toBeLessThanOrEqual(1);
        if (i > 0) {
          const previous = events[i - 1];
          expect(event.start).toBeGreaterThan(previous.start + previous.duration + 5);
        }
      }
      expect(activeFlare(seed, 0)).toBeNull();
    }
  });

  it("does not fire both suns in unison", () => {
    const a = flareEvents(STAR_ACTIVITY.primary, 0, 360);
    const b = flareEvents(STAR_ACTIVITY.secondary, 0, 360);
    const nearest = a.map((event) => Math.min(...b.map((other) => Math.abs(other.start - event.start))));
    const mean = nearest.reduce((sum, value) => sum + value, 0) / nearest.length;
    expect(mean).toBeGreaterThan(2);
    const coincidences = nearest.filter((gap) => gap < 0.75).length;
    expect(coincidences).toBeLessThan(3);
    let both = 0;
    const steps = 720;
    for (let step = 0; step < steps; step += 1) {
      const time = (step / steps) * 360;
      if (activeFlare(STAR_ACTIVITY.primary, time) && activeFlare(STAR_ACTIVITY.secondary, time)) both += 1;
    }
    expect(both / steps).toBeLessThan(0.12);
    const gaps = (events: { start: number }[]) => events.slice(1).map((event, index) => event.start - events[index].start);
    expect(gaps(a).join(",")).not.toBe(gaps(b).join(","));
  });

  it("fades a flare in and out without a leftover glow", () => {
    const [flare] = flareEvents(STAR_ACTIVITY.primary, 0, 40);
    expect(flareEnvelope(flare.start - 0.1, flare)).toBe(0);
    expect(flareEnvelope(flare.start + flare.duration + 0.1, flare)).toBe(0);
    const mid = flareEnvelope(flare.start + flare.duration * 0.35, flare);
    const early = flareEnvelope(flare.start + flare.duration * 0.05, flare);
    expect(mid).toBeGreaterThan(0.7);
    expect(early).toBeGreaterThan(0);
    expect(early).toBeLessThan(mid);
  });

  it("varies radiance gently and differently per star, not as one shared sine", () => {
    const samples = Array.from({ length: 160 }, (_, i) => i * 1.1);
    for (const seed of [STAR_ACTIVITY.primary, STAR_ACTIVITY.secondary]) {
      const values = samples.map((time) => stellarBrightness(seed, time));
      const min = Math.min(...values);
      const max = Math.max(...values);
      expect(min).toBeGreaterThan(0.9);
      expect(max).toBeLessThan(1.08);
      expect(max - min).toBeGreaterThan(0.03);
    }
    const diverge = samples.some(
      (time) =>
        Math.abs(stellarBrightness(STAR_ACTIVITY.primary, time) - stellarBrightness(STAR_ACTIVITY.secondary, time)) >
        0.01,
    );
    expect(diverge).toBe(true);
    const primary = samples.map((time) => stellarBrightness(STAR_ACTIVITY.primary, time));
    const sine = samples.map((time) => 0.97 + Math.sin(time * 0.2) * 0.03);
    const mean = primary.reduce((sum, value) => sum + value, 0) / primary.length;
    const sineMean = sine.reduce((sum, value) => sum + value, 0) / sine.length;
    let num = 0;
    let da = 0;
    let db = 0;
    for (let i = 0; i < primary.length; i += 1) {
      const pa = primary[i] - mean;
      const pb = sine[i] - sineMean;
      num += pa * pb;
      da += pa * pa;
      db += pb * pb;
    }
    const correlation = num / Math.sqrt(da * db);
    expect(Math.abs(correlation)).toBeLessThan(0.85);
  });
});
