# Universe preview

An unreleased redesign of [tomgray.co.uk](https://tomgray.co.uk). The whole viewport is a small 3D system: each project from `projects.json` is one planet. This folder does not replace the live site.

The site that GitHub Pages serves is still the repository root (`index.html`, `privacy.html`, `CNAME`). A separate Workers hostname, listed below, serves this preview only.

## Run it

From this directory:

```bash
npm install
npm run dev      # http://127.0.0.1:5173
npm test
npm run build
npm run preview  # http://127.0.0.1:4174 — serves the static build
npm run smoke    # headless pass over the built preview
```

The dev server and the build both read `../projects.json`. Edit that file, then refresh. Names, descriptions, build notes, terms, and URLs come from there and are not rewritten in the scene.

`appearanceFor()` in `src/scene/layout.ts` maps the three current ids onto bespoke planets (louvered brass, glass press, pearl with a glass twin). A project added later still appears, on a generated orbit, using one of those three constructions until a bespoke look is added. Do not add planets that are not in `projects.json`.

## What changed, architecturally

The live page is one static file with inline CSS and vanilla JS. This preview is a Vite app: React, React Three Fiber, and drei. `npm run build` emits a static `dist/` (relative asset paths, no server required) so it can sit on GitHub Pages later. It is gitignored.

Navigation borrows two ideas from the pmndrs examples, without their bust or Earth assets:

- shared geometry, with `Detailed` dropping the small orbiting shards once the camera is far away
- HTML buttons anchored to each planet, so the names stay readable

Drag orbits. Scroll or pinch zooms, inside a hard near and far limit. Click or tap a planet, or its label, and the camera eases in and a panel opens. A drag past a few pixels does not count as a click. Back (and Escape) returns to the pose you had before focusing. Reset view, R, and Home return to the overview and close the panel. Arrow keys orbit. Plus and minus zoom.

On a phone the scene is the same one. Quality drops (pixel ratio, segment counts, star count, environment resolution) when the pointer is coarse, the device is small, or there are few cores. It does not fall back to a list. A list is only rendered when WebGL cannot start, or JavaScript is off.

Reduced motion snaps the camera and stops the slow spins.

## Public preview host

A copy of this build is published as its own Worker, `tom-gray-universe-preview`, at:

https://tom-gray-universe-preview.tomgray.workers.dev

That hostname is not `tomgray.co.uk`. It does not change GitHub Pages, `CNAME`, or DNS. Deleting that Worker removes the preview and leaves the live site alone. `npx wrangler deploy` from this folder publishes `dist/` again; it does not deploy the repository root.

## Deployment steps that were not taken

Do not do any of this as part of viewing the preview.

GitHub Pages for this repository publishes the **repository root**. `CNAME` points the root at `tomgray.co.uk`. To publish this redesign later, on purpose:

1. Keep `privacy.html` reachable at `/privacy`. The privacy policy is unrelated to this view and must keep returning HTTP 200.
2. Build with `npm run build`.
3. Either replace the Pages root with `preview/dist` (this removes the flash sheet), or copy `dist` to a subpath such as `universe/` and set Vite `base` to `/universe/` before building.
4. Do not change `CNAME`, DNS, or the Pages source until that replacement is the decision.

Until then, the live site is the flash sheet and this branch only adds the preview.
