# tom-gray-builds.github.io

Single-page site: a sheet of black-and-grey tattoo flash. The centre column is
the name plate — "tom gray" in a blackletter face above three banner-wrapped
hearts carrying the subtitle. The six cells around it are the work, one piece
of flash each. No scrolling anywhere — a sheet has edges, and you navigate it
by depth (zoom into a piece), not by length. Served by GitHub Pages at
[tomgray.co.uk](https://tomgray.co.uk).

## Layout

A 3×3 grid with no ruled lines; the ink is the only structure. The centre
column (cells **2, 5, 8**) is one tall piece and is not available for
projects. Valid project cells are **1, 3, 4, 6, 7, 9** — six slots. Those
numbers still mean the grid positions they always did, so a `cell` value in
`projects.json` means the same thing it did before the hearts landed; putting
a project on 2, 5 or 8 logs a console warning and renders nothing.

The centre column is slightly wider than the outer two (`1fr 1.08fr 1fr`, and
much wider on narrow screens), because the hearts are sized by their column's
*width*. Zoom targeting therefore measures each cell's real box rather than
assuming equal thirds.

## The three hearts

The subtitle set as flash rather than as a line of type: three overlapping
hearts, each crossed by a scroll banner, lettered in **Sancreek** along an SVG
`textPath`. Edit the strings in `TAGLINES` in `index.html`.

Structure, which is what a naive version gets wrong: each heart is an outer
outline, then a **rim band**, then an inner outline, then the body — and the
beading runs up the *middle of the rim band*, not inset on the heart. Shading
is **flat blocked tone**, never a gradient; a smooth ramp reads as airbrush and
is the thing that most gives away a tattoo drawn in code. The body is the
darkest value on the sheet against a near-paper rim, and the shadow is made by
clipping a lighter copy of the heart offset down-right, which leaves a dark
crescent hugging the top-left edge.

Banners roll into spirals at both ends. Leaves are seeded per-leaf for length,
width, angle and tip-curl with a midrib splitting a shaded half, so they do not
read as one shape pasted six times.

Pinned to tier 0 on purpose — this is identity, not data, so it must not drift
green the way the projects do.

Two things here are load-bearing and easy to break:

- **Banner text is measured on a detached element.** Text that overruns its
  `textPath` is clipped at *both* ends, and the clipped element then reports a
  length that already fits — so asking it whether it overflows always answers
  no, and the first and last letters silently vanish. `fitBanners()` measures
  a throwaway `<text>` instead.
- **All three banners are fitted to one shared size**, set by the tightest
  phrase. Fitting each to its own ribbon is what a layout engine would do, but
  it makes the lettering step between banners on a single piece.
- **The project ribbon fitter sizes the box, not the inner label.**
  `letter-spacing` is declared in em, so it computes once on `.ribbon-text` and
  inherits down as a fixed *px* length. Shrinking the label alone shrinks the
  glyphs but not the tracking between them, so the width stops scaling with
  font-size and the fitter converges on a size it wrongly believes fits.

## "Tattoo styling"

The blown-out, old-tattoo ink look — as if the ink has spread and softened
under skin over years. Shared by the centre name and every piece of flash so
they read as the same hand.

**The ink is not a constant.** Black tattoo ink doesn't stay black: carbon
particles migrate and scatter, and over years solid black drifts toward a soft
olive green while its edges bleed. Both of those are driven here by one
number — `--age`, computed from how long ago that project was last pushed.

| Token | What it does |
| --- | --- |
| `--age` | 0 (pushed this week) → 1 (untouched for over a year). The only knob. |
| `--ink` | `color-mix()` from `--ink-fresh` (#16181a) to `--ink-aged` (#5e6f56) by `--age` |
| `--tattoo-filter` | `url(#blowout-N)` — a fixed `feMorphology` dilate + `feGaussianBlur` feather, dimmed by `feComponentTransfer` and merged back over the original |
| `--tattoo-glow` | stacked `drop-shadow()`s — tight ink bleed plus a green sub-dermal halo that strengthens with `--age`; works on any filled shape |

Usage:

- **Filled shapes** (e.g. `.sigil`): `filter: var(--tattoo-filter) var(--tattoo-glow);`
- **Text** (`.name`): add the `.tattoo-text` class — it applies
  `var(--tattoo-filter)` plus `text-shadow` and `-webkit-text-stroke` for
  crisper per-glyph glow.

When asked for "tattoo styling", match this recipe.

### Two things that will bite you

**The blowout is quantised into five tiers, not continuous.** SVG filter
attributes cannot read CSS custom properties — you can't drive `feMorphology
radius` from `var(--age)`. So there are five filters, `#blowout-0` through
`#blowout-4`, picked by the `.t0`–`.t4` classes. The *continuous* half of the
effect lives in `--tattoo-glow` as CSS `drop-shadow()`s, which can read a
custom property. Resize the whole set by editing the `radius` /
`stdDeviation` on the `#blowout-*` filters.

**`--ink` must be declared on the same element that sets `--age`.** A custom
property is substituted where it is *declared*, and descendants inherit the
already-substituted value. An `--ink: color-mix(… var(--age) …)` written once
on `:root` would bake in `:root`'s `--age` of 0, and every piece would stay
black forever. Hence the `.t0, .t1, .t2, .t3, .t4, .slot` rule.

## The flash draws itself

No image assets. Each piece's sigil is composed at render time from a
vocabulary of traditional motifs — `dagger`, `swallow`, `moon`, `rose`, `eye`,
`hourglass` — seeded by an FNV-1a hash of the project id through an xorshift32
PRNG, so a project's mark is a pure function of its id and never changes under
it. Rigid forms are authored path data; radial forms (`moon`, `rose`, `eye`)
are built parametrically, so no two are quite the same piece of flash.

`motif: "auto"` picks by **meaning**, not by hash: it reads the project's own
id, title, blurb and language against a keyword table (see `MEANINGS` in
`index.html`) and chooses the form that means the right thing — a moon for
something about light, an hourglass for something about time. The hash is only
the fallback when nothing matches. Pin a motif explicitly in `projects.json`
to overrule it.

Empty cells render as pencil stencils: slots with nothing in them yet. They
deal motifs round-robin from the shapes no real piece is using.

The three fonts are Grenze Gotisch (the name), IM Fell English (project
ribbons, the reader) and Sancreek (the heart banners only) — Sancreek being the
closest thing on Google Fonts to traditional condensed wedge-serif banner
lettering.

## Content

`projects.json` is the curated source of truth — edit it by hand. It holds
private/non-GitHub work too; omit `url` and the piece renders as something you
can see but not claim.

```
node tools/ink.mjs             # re-inline projects.json into index.html
node tools/ink.mjs --refresh   # also pull pushed_at/language/stars from GitHub
```

There is deliberately **no CI**. The project data is inlined into `index.html`
between the `flash:` markers, so the page fetches nothing to render itself —
no loading state, no API rate limits, nothing to rot. (The three webfonts are
still pulled from Google Fonts; everything else is in the file.) Set
`GITHUB_TOKEN` if you want `--refresh` to see private repos.

## Machine-readable layer

`/llms.txt` and the JSON-LD block in `index.html` are maintained on purpose —
half the visitors to a page like this aren't people. `tools/ink.mjs`
regenerates the JSON-LD from the same source as the sheet.

## Local preview

```
python3 -m http.server 4173
```
