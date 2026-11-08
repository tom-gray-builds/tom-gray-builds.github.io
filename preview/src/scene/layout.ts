export type Appearance = "blinds" | "press" | "twin";

export const ACCENT: Record<Appearance, string> = {
  blinds: "#e39a4a",
  press: "#f3ecdf",
  twin: "#cbb6ff",
};

const BESPOKE: Record<string, Appearance> = {
  "smart-blinds": "blinds",
  fontloop: "press",
  avatars: "twin",
};

const KNOWN: Record<string, [number, number, number]> = {
  "smart-blinds": [-5.4, 0.45, 2.05],
  fontloop: [5.15, -1.3, 1.35],
  avatars: [0.25, 1.8, -5.55],
};

export const PLANET_HALO = 2.55;

export function appearanceFor(id: string, index: number): Appearance {
  return BESPOKE[id] ?? (["blinds", "press", "twin"] as const)[index % 3];
}

export function placementFor(id: string, index: number, total: number) {
  const known = KNOWN[id];
  if (known) return known;
  const angle = (index / Math.max(total, 1)) * Math.PI * 2 + 0.4;
  const ring = 10.5;
  return [
    Math.cos(angle) * ring,
    Math.sin(index + 1) * 0.7,
    Math.sin(angle) * ring,
  ] as [number, number, number];
}

export function systemBound(ids: { id: string }[]) {
  const total = ids.length;
  let bound = 0;
  ids.forEach((piece, index) => {
    const [x, y, z] = placementFor(piece.id, index, total);
    bound = Math.max(bound, Math.hypot(x, y, z) + PLANET_HALO);
  });
  return bound;
}
