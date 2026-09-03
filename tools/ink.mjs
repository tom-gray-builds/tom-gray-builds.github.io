#!/usr/bin/env node
/**
 * ink.mjs — inks the sheet.
 *
 * Reads projects.json (your curated source of truth), optionally refreshes
 * the `github` block for any piece with a `repo`, then writes the data
 * inline into index.html between the flash:/jsonld: markers.
 *
 * Run by hand. There is no CI here on purpose: the site should be a single
 * static file that fetches nothing to render itself (webfonts aside) and has
 * nothing to rot.
 *
 *   node tools/ink.mjs             # re-inline what's already in projects.json
 *   node tools/ink.mjs --refresh   # also pull fresh data from the GitHub API
 *
 * No dependencies.
 */

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "projects.json");
const HTML = join(ROOT, "index.html");

const refresh = process.argv.includes("--refresh");

const raw = JSON.parse(await readFile(SRC, "utf8"));
const pieces = raw.pieces ?? [];

if (refresh) {
  for (const p of pieces) {
    if (!p.repo) continue;
    const url = `https://api.github.com/repos/${p.repo}`;
    const res = await fetch(url, {
      headers: {
        accept: "application/vnd.github+json",
        ...(process.env.GITHUB_TOKEN ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {})
      }
    });
    if (!res.ok) {
      // A private repo 404s unauthenticated. That's expected, not an error:
      // the piece keeps whatever `github` block you last gave it by hand.
      console.warn(`  ${p.id}: ${res.status} ${res.statusText} — keeping existing data`);
      continue;
    }
    const r = await res.json();
    p.github = {
      pushed_at: r.pushed_at,
      language: r.language ?? undefined,
      stars: r.stargazers_count || undefined
    };
    console.log(`  ${p.id}: pushed ${r.pushed_at}`);
  }
  await writeFile(SRC, JSON.stringify(raw, null, 2) + "\n");
}

const today = new Date().toISOString().slice(0, 10);

const flash = JSON.stringify({
  generated: today,
  pieces: pieces.map(({ id, title, banner, problem, build, terms, repo, url, motif, cell, github }) => ({
    id, title, banner, problem, build, terms, repo, url, motif, cell, github
  }))
});

const jsonld = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "ProfilePage",
  name: "tom gray",
  url: "https://tomgray.co.uk/",
  mainEntity: {
    "@type": "Person",
    name: "Tom Gray",
    url: "https://tomgray.co.uk/",
    description: "Growth hacker, AI explorer.",
    sameAs: ["https://github.com/tom-gray-builds"]
  },
  hasPart: pieces.map((p) => ({
    "@type": "SoftwareSourceCode",
    name: p.title,
    abstract: p.banner,
    ...(p.problem ? { description: p.problem } : {}),
    ...(p.terms ? { isAccessibleForFree: p.terms === "open" } : {}),
    ...(p.url ? { codeRepository: p.url } : {}),
    ...(p.github?.language ? { programmingLanguage: p.github.language } : {}),
    ...(p.github?.pushed_at ? { dateModified: p.github.pushed_at.slice(0, 10) } : {})
  }))
});

function splice(src, marker, body) {
  const re = new RegExp(`(<!-- ${marker}:start -->)[\\s\\S]*?(<!-- ${marker}:end -->)`);
  if (!re.test(src)) throw new Error(`marker "${marker}" not found in index.html`);
  return src.replace(re, `$1\n${body}\n  $2`);
}

let html = await readFile(HTML, "utf8");
html = splice(html, "flash", `  <script type="application/json" id="flash-data">\n${flash}\n  </script>`);
html = splice(html, "jsonld", `  <script type="application/ld+json">\n${jsonld}\n  </script>`);
await writeFile(HTML, html);

console.log(`inked ${pieces.length} piece${pieces.length === 1 ? "" : "s"} into index.html`);
