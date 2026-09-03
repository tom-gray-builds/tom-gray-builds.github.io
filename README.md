# tom-gray-builds.github.io

Single-page site: the whole page is one sheet of black-and-grey tattoo flash.
Fifty-odd pieces packed across the paper at random — the work, the name plate,
and a lot of traditional filler. No scrolling anywhere: a sheet has edges, and
you navigate it by depth (zoom into a piece), not by length. Served by GitHub
Pages at [tomgray.co.uk](https://tomgray.co.uk).

## Layout

There is no grid. Every piece — including the name plate — is placed at run
time by `packSheet()` in `index.html`, against the live viewport, in px. Boxes
are set largest-first, which is also the order a sheet is really drawn in: the
big work goes down, then the filler is fitted into whatever is left.

How a spot is chosen is the part worth understanding. Each piece samples random
candidate positions and keeps a **shortlist of twelve** that don't collide,
then picks within that shortlist:

- most pieces are **snugglers** — they take the candidate sitting closest to a
  target gap from their nearest neighbour, shoulder to shoulder;
- about a fifth are **explorers** — they take the emptiest candidate and start
  a new cluster somewhere else on the paper.

The shortlist is the load-bearing bit. Score *every* candidate on the sheet and
the preference becomes absolute: a snuggler then rejects open paper every
single time, the sheet fills outward from wherever the first piece landed, and
whole margins stay bare. Twelve candidates keeps the preference local — the
coverage stays uniformly random, the choice within it stays deliberate. Pure
blue noise (always take the furthest) has the opposite failure: perfectly even
spacing, which is a grid with the ruler rubbed out.

A piece that can't fit shrinks by 14% and tries again, five times over. Filler
that still doesn't fit is simply not drawn; real work falls back to the
roomiest spot found even if it crowds something. Finally the whole composition
is **re-centred** on the paper, because packing stops when it runs out of
pieces rather than when it runs out of room, and the leftover margin would
otherwise bunch against one edge.

Coverage lands around 65–70% at any window size. Sizes are fractions of
`sqrt(W*H)`, so the *number* of pieces needed to fill the sheet is
resolution-independent; what changes on a small screen is `gain`, which draws
fewer pieces proportionally larger. A resize re-packs from the same seed —
recognisably the same sheet, redrawn to fit — rather than stretching.

`cell` in `projects.json` is no longer a position. It survives as a running
**order**: lowest first, deciding which piece is numbered i and which gets its
pick of the paper. No value is invalid and nothing needed migrating.

## The name plate

"tom gray" in a blackletter face over one scroll banner carrying the subtitle,
lettered in **Sancreek** along an SVG `textPath`, with foliage either side.
Edit `TAGLINE` in `index.html`.

It goes down first, across the top of the paper and centred, the way a sheet is
headed — and everything else then packs in underneath it. It is still tilted
and still sized and placed by the packer, because on a flash sheet the artist's
name is another piece of flash rather than page furniture. Capped at 56% of the
window width so a narrow screen doesn't turn the sheet into a headed letter.

**Pinned to tier 3**, not computed from a date: it is identity, not data, so
nothing about it should move on its own. Tier 3 rather than tier 0 because tier
0 is fresh linework — thin, crisp, barely any bleed — and beside a settled
piece of work it read as unfinished rather than as restrained. The name is the
oldest thing on the paper and should look it: spread, softened, drifted toward
olive, with the sub-dermal halo under it.

Banners roll into spirals at both ends. Leaves are seeded per-leaf for length,
width, angle and tip-curl with a midrib splitting a shaded half, so they do not
read as one shape pasted six times. Shading is **flat blocked tone**, never a
gradient; a smooth ramp reads as airbrush and is the thing that most gives away
a tattoo drawn in code.

Two things here are load-bearing and easy to break:

- **Banner text is measured on a detached element.** Text that overruns its
  `textPath` is clipped at *both* ends, and the clipped element then reports a
  length that already fits — so asking it whether it overflows always answers
  no, and the first and last letters silently vanish. `fitBanners()` measures
  a throwaway `<text>` instead.
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
`hourglass`, `heart`, `anchor`, `snake`, `skull`, `star`, `horseshoe`, `key`,
`web`, `bolt`, `cherry`, `typewriter`, `figure` — seeded by an FNV-1a hash of the piece's id through an
xorshift32 PRNG, so a project's mark is a pure function of its id and never
changes under it. Rigid forms are authored path data; the rest are built
parametrically (the snake's body is offset either side of a wandering spine, so
the coil is never the same twice), so no two are quite the same piece of flash.

Add to the `MOTIFS` object to extend the vocabulary; nothing else needs to
change. A motif returns a list of `{ k, d }` parts — `line`, `thin`, `solid`,
`shade`, `beads` — plus an optional `t` transform, and inherits the ink, the
ageing and the stencil treatment for free.

`motif: "auto"` picks by **meaning**, not by hash: it reads the project's own
id, title, blurb and language against a keyword table (see `MEANINGS` in
`index.html`) and chooses the form that means the right thing — a moon for
something about light, an hourglass for something about time. The hash is only
the fallback when nothing matches. Pin a motif explicitly in `projects.json`
to overrule it.

## Filler

Most of the sheet is filler: small traditional pieces packed into the gaps so
the paper reads as used. They are placeholders in the literal sense — they hold
space for work that isn't on the sheet yet — so they carry no title, no link
and no meaning.

**All of it is drawn as pencil stencil**, and that is the entire navigation of
the sheet: ink means real work and real work opens; a dotted outline is a
placeholder. Nothing else needs to be said about which of fifty pieces you can
click. A stencil has no fill, no wash, no stipple and no ink blowout — it is a
line and nothing else — which is also most of the reason the zoom is cheap,
since forty of the fifty pieces then run no filter at all. Each one takes a
seeded opacity between 0.30 and 0.58, so the sheet reads as drawn by hand over
time with some of it pressed harder, not as one shape stamped out fifty times.

Two details that matter more than they look:

- **Shapes are dealt from a shuffled deck**, one deck per pass through the
  vocabulary, not picked independently at random. Independent picks are what
  randomness actually looks like — which is to say seven lightning bolts and no
  skull. Dealing evens the counts out; reshuffling between passes keeps the
  repeat off a visible period.
- **Weight is seeded from each piece's own key**, not drawn from the layout's
  random stream, so a re-pack at a different window size can add or drop filler
  without every other piece changing.

Filler avoids the motifs the real work is using, so a stencil never lands near
its own inked twin looking like a duplicate.

The three fonts are Grenze Gotisch (the name), IM Fell English (project
ribbons, the reader) and Sancreek (the scroll banner only) — Sancreek being the
closest thing on Google Fonts to traditional condensed wedge-serif banner
lettering.

## Opening a piece

Selecting a piece zooms the sheet into it and fades a reader panel in over the
bottom-left. The panel carries the blurb, **what it's for** (the problem, in
plain words), **how it's built** (the rough architecture as three to five short
lines — an abstract, not a file listing), the GitHub meta, and a **terms**
stamp: `open` / `profit` / `private`. A flash sheet quotes a price against every
piece on it; that stamp is the price line.

There is no single zoom factor, because the pieces are no longer one size. The
scale is computed per piece from its measured box to bring whatever it is up to
about the same share of the viewport, clamped at both ends, and written back to
CSS as `--z` so the glow can divide its radii by it.

**Why the zoom is smooth.** Fifty-odd pieces are each running an SVG filter
(a morphology dilate plus a gaussian blur). A CSS transform on a plain layer is
free; scaling a *filtered* element is not — the filter graph re-runs at the new
scale every frame, and fifty of those turn a 700ms animation into a slideshow.
So the moment you lean into a piece, every other piece drops its filters (they
are fading to a tenth opacity anyway, where nobody can tell a blown-out line
from a plain one) and stops being painted at all once faded. Per-frame cost
goes from fifty filter graphs to one. If the zoom ever gets janky again, this
is the first rule to check.

## Content

`projects.json` is the curated source of truth — edit it by hand. It holds
private/non-GitHub work too; omit `url` and the piece renders as something you
can see but not claim.

| Field | What it is |
| --- | --- |
| `id`, `title`, `banner` | identity, ribbon title, one-line blurb |
| `problem` | what the thing is for, one or two sentences |
| `build` | array of 3–5 short lines: the rough architecture |
| `terms` | `open` \| `profit` \| `private` — the price line |
| `repo`, `url` | GitHub repo to refresh from; link to show. Both optional |
| `motif` | `auto` picks by meaning, or pin one by name |
| `cell` | running order, lowest first. Sets the numeral and the pick of the paper |

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
