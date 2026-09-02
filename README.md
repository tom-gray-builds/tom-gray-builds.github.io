# tom-gray-builds.github.io

Single-page site: "tom gray" in a blackletter face, centred in the middle
cell of a full-page 3×3 line grid. Served by GitHub Pages at
[tomgray.co.uk](https://tomgray.co.uk).

## "Tattoo styling"

The blown-out, old-tattoo ink look — as if the ink has spread and softened
under skin over years. Applied to **both** the centre name and the grid
lines so they read as the same hand.

Defined in `index.html` as CSS custom properties on `:root`:

| Token | What it does |
| --- | --- |
| `--tattoo-filter` | `url(#blowout)` — a fixed `feMorphology` dilate (grow every edge N px) + `feGaussianBlur` feather, merged back over the original — then `saturate(0.8)` |
| `--tattoo-glow` | stacked `drop-shadow()`s — tight dark ink bleed plus a wider blue‑green sub‑dermal halo; works on any filled shape |

The blowout is a **fixed pixel spread**: no turbulence/displacement, so a
big blackletter glyph and a thin grid line get the exact same edge growth.
Resize it by editing the `radius` / `stdDeviation` on `#blowout`.

Usage:

- **Filled shapes** (e.g. `.grid`): `filter: var(--tattoo-filter) var(--tattoo-glow);`
- **Text** (`.name`, `.tagline`): add the `.tattoo-text` class — it applies
  `var(--tattoo-filter)` plus `text-shadow` and `-webkit-text-stroke` for
  crisper per‑glyph glow.

The `#blowout` SVG filter lives inline at the bottom of `index.html`.

When asked for "tattoo styling", match this recipe.

## Local preview

```
python3 -m http.server 4173
```
