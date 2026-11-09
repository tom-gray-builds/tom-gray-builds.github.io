import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { formatPushed, panelModel, selectPieces } from "./content";
import { LINKEDIN_URL } from "./links";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const raw = JSON.parse(readFileSync(join(root, "projects.json"), "utf8")) as {
  pieces: Array<{
    id: string;
    title: string;
    banner: string;
    problem: string;
    build: string[];
    url?: string;
  }>;
};

describe("project content", () => {
  const pieces = selectPieces(raw);

  it("opens Tom's LinkedIn profile and nothing else for the suns", () => {
    expect(LINKEDIN_URL).toBe("https://www.linkedin.com/in/tom-gray-online/");
  });

  it("represents each curated project once, in sheet order", () => {
    expect(pieces.map((piece) => piece.id)).toEqual(["smart-blinds", "fontloop", "avatars"]);
    expect(new Set(pieces.map((piece) => piece.id)).size).toBe(pieces.length);
  });

  it("preserves names, descriptions, and the only live url", () => {
    for (const source of raw.pieces) {
      const piece = pieces.find((item) => item.id === source.id);
      expect(piece?.title).toBe(source.title);
      expect(piece?.banner).toBe(source.banner);
      expect(piece?.problem).toBe(source.problem);
      expect(piece?.build).toEqual(source.build);
      expect(piece?.url).toBe(source.url ?? null);
    }
    expect(pieces.find((piece) => piece.id === "smart-blinds")?.url).toBe(
      "https://github.com/tom-gray-builds/smart-blinds",
    );
    expect(pieces.find((piece) => piece.id === "fontloop")?.url).toBeNull();
    expect(pieces.find((piece) => piece.id === "avatars")?.url).toBeNull();
  });

  it("does not invent a link in the panel model", () => {
    const fontloop = pieces.find((piece) => piece.id === "fontloop");
    expect(fontloop).toBeTruthy();
    if (!fontloop) return;
    const model = panelModel(fontloop);
    expect(model.url).toBeNull();
    expect(model.banner).toBe("A brief in plain English; a real typeface out.");
    expect(model.terms?.stamp).toBe("not for sale");
  });

  it("formats an existing push date without shifting the day", () => {
    expect(formatPushed("2026-04-04T09:03:53Z")).toBe("4 April 2026");
    expect(formatPushed("2026-07-28T20:45:06Z")).toBe("28 July 2026");
    expect(formatPushed(null)).toBeNull();
  });
});
