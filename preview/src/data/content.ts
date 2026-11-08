import raw from "../../../projects.json";

export type TermsKey = "open" | "profit" | "private";

export type Piece = {
  id: string;
  title: string;
  banner: string;
  problem: string;
  build: string[];
  terms: TermsKey | null;
  url: string | null;
  language: string | null;
  pushedAt: string | null;
  stars: number | null;
  cell: number;
};

type RawPiece = {
  id?: string;
  title?: string;
  banner?: string;
  problem?: string;
  build?: string[] | string;
  terms?: string;
  url?: string;
  cell?: number;
  github?: { pushed_at?: string; language?: string; stars?: number };
};

const TERMS: Record<TermsKey, { stamp: string; line: string }> = {
  open: {
    stamp: "free to take",
    line: "open source — copy it, run it, change it",
  },
  profit: {
    stamp: "commissioned",
    line: "for profit — the work is sold, not given",
  },
  private: {
    stamp: "not for sale",
    line: "private work — you can see it, you can't have it",
  },
};

function isTerms(value: string | undefined): value is TermsKey {
  return value === "open" || value === "profit" || value === "private";
}

export function selectPieces(data: { pieces?: RawPiece[] } = raw): Piece[] {
  const pieces = Array.isArray(data.pieces) ? data.pieces : [];
  return pieces
    .filter((piece): piece is RawPiece & { id: string; title: string } =>
      Boolean(piece && piece.id && piece.title),
    )
    .map((piece) => {
      const build = Array.isArray(piece.build)
        ? piece.build.filter((line) => typeof line === "string" && line.length > 0)
        : piece.build
          ? [piece.build]
          : [];
      return {
        id: piece.id,
        title: piece.title,
        banner: piece.banner ?? "",
        problem: piece.problem ?? "",
        build,
        terms: isTerms(piece.terms) ? piece.terms : null,
        url: piece.url || null,
        language: piece.github?.language ?? null,
        pushedAt: piece.github?.pushed_at ?? null,
        stars: piece.github?.stars ? piece.github.stars : null,
        cell: piece.cell ?? 99,
      };
    })
    .sort((a, b) => a.cell - b.cell || a.id.localeCompare(b.id));
}

export function termsCopy(terms: TermsKey | null) {
  return terms ? TERMS[terms] : null;
}

export function formatPushed(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export type PanelModel = {
  id: string;
  title: string;
  banner: string;
  problem: string;
  build: string[];
  url: string | null;
  terms: { stamp: string; line: string } | null;
  language: string | null;
  pushed: string | null;
  stars: number | null;
};

export function panelModel(piece: Piece): PanelModel {
  return {
    id: piece.id,
    title: piece.title,
    banner: piece.banner,
    problem: piece.problem,
    build: piece.build,
    url: piece.url,
    terms: termsCopy(piece.terms),
    language: piece.language,
    pushed: formatPushed(piece.pushedAt),
    stars: piece.stars,
  };
}

export const pieces = selectPieces();
