# Hand-Painting for Three.js

One-page scroll presentation of the team's hand-painting asset workflow, built for a ~20 min talk.
Vite + React Three Fiber, one fixed canvas behind nine scrolling acts.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static build in dist/
```

## The nine acts

| # | Act | What happens |
|---|-----|--------------|
| 1 | Create the model | White clay + wireframe; the very first scroll already moves the scene |
| 2 | Gradient palette | Model center, sheet far right; island outlines pack onto the sheet while the **model's colors resolve island-by-island in lockstep** |
| 3 | Test in the scene | The **level view**: a 45° tilted stage (camera-at-(7,7,7) look) with a 3D floor grid; the four-piece crew stands on an even grid, hero on slot 2 |
| 4 | Bake | Red **fat seam lines** appear and thicken, the model drops to wireframe, the sheet clears and shows the unwrapped layout as wireframe, then the sweep wipes the baked skin back on |
| 5 | Hand paint | Nothing travels: the sheet wipes baked→painted and the model wears it simultaneously (the Photoshop story) |
| 6 | Artist live loop | The SAME level view, now painted; **scripted drag-and-drops** fly tray swatches into the scene and repaint the hero — plus the real tray drag & OS PNG drop |
| 7 | Combine | The whole crew glides out of the window into a frontal line-up (hero second); their four sheets fly into one 2×2 atlas |
| 8 | Compress | Atlas shrinks into the floating stamped KTX2 chip next to the script |
| 9 | Batch | Level view returns in **wireframe**; the KTX chip flies in, the combined texture applies member-by-member, and every creature comes alive (hop / spin / roll). Perf monitor lives inside the window; draw calls **staged as "1"** for the draft — the real BatchedMesh version is a separate production task |

## What unblocks the real bake act

Re-export `duckColumn.glb` with a second UV set: **`TEXCOORD_1` = the real
seam-cut unwrap**. Islands and red seam lines are then derived automatically
(seams = edges split in uv1 that coincide in 3D) — no manual seam markup
needed. Until then `unwrapLayout.js` region-grows stand-in islands from the
mesh (72 clusters currently) so every animation already works. Later: the
baked PNG for that layout, and real hand-painted textures.

## How it's wired

- `src/scroll/choreography.js` — the heart. A mutable `params` object + one gsap
  timeline scrubbed by ScrollTrigger across the whole page. Timeline positions are
  authored in scroll units: **1 unit = one 170vh section**. World components read
  `params` in `useFrame` and write to objects/uniforms imperatively.
- `src/world/materials/assetMaterial.js` + `src/shaders/asset/*.glsl` — one shader
  for every model state: `uWhiteMix` (clay), `uMapBase` (gradient/baked),
  `uReveal` (baked→painted wipe), `uMapPaintA/B + uSwapWipe` (live swap wipe),
  `uUnwrap` (position→UV morph used by the bake act; seams come free with the UVs).
- `src/world/unwrapLayout.js` — **stand-in unwrap**. The shipped GLB's UVs are
  palette-strip lookups (~0.6% of UV space), which is correct for the gradient
  stage but can't serve as a bake layout. This module builds a synthetic 0-1
  unwrap at load (per-island planar projection + shelf packing) stored as
  `aUnwrapUv`; the bake morph and act-02 animation read it, color sampling
  keeps the real strip UVs. **When the real seam-cut export exists**, export the
  clean unwrap as `TEXCOORD_1` and swap `buildUnwrapAttribute` for `uv1`.
- `src/world/uvIslands.js` — act-02 line animation: island outlines start in
  the unwrap layout ("full scale") and shrink onto their real palette strips.
- `src/world/textureLibrary.js` — swatch registry. Painted variants are currently
  generated from the gradient (hue shift + brush dabs) as placeholders.
- `src/ui/Sections.jsx` — DOM copy deck; per-section ScrollTriggers fade the sticky
  cards and track the active step for the tray/perf monitor.

## Swapping in real textures later

1. **Baked texture**: put it in `public/textures/` and set it as `mapBase` where
   components call `createAssetMaterial({ mapBase: ... })` (or extend
   `textureLibrary.js` to load it). Keep `flipY = false` (glTF UV convention) —
   `prepareMapTexture()` does this.
2. **Painted variants**: replace the `VARIANTS` canvas generation in
   `textureLibrary.js` with real files — load, run through `prepareMapTexture`,
   push `{ id, label, texture, thumb }` into `textureLibrary.entries`.
3. During the talk you can simply **drag real PNGs onto the page** in act 5 —
   they become live swatches (exactly the artist upload flow).

## Verify the unwrap data

```bash
node scripts/verify-unwrap.mjs
```

Checks the generated stand-in unwrap against the GLB: attributes in 0–1, no
NaNs, no overlapping islands, and the `aPackOrder` ↔ `uvIslands` lockstep that
keeps the act-02 model coloring in sync with the sheet animation. Re-run after
re-exporting the model.

```bash
node scripts/verify-geometry.mjs
```

Checks the level-view geometry (`ISO` in `config.js`): the floor grid stays
inside the scene window at every landscape aspect, the four iso slots don't
overlap on screen, and the act-07 row formation never clips assemblies through
each other. Re-run after touching `ISO`, `ISO_SLOTS`, `ROW_X`, or the crew
arc/row assignments.

## Debug hooks (dev only)

- `window.__params` / `window.__timeline` — choreography state
- `window.__three` — `{ gl, camera, scene, stage }`
- `window.__stage` — zustand store (step, swatches)

## Model source

`public/models/duckColumn.glb` — nodes `duck` and `column`; authored Blender tilt
is baked into the geometry at load and the pair is normalised to a 2.6-unit-tall
assembly centered on the origin (`src/world/useDuckColumn.jsx`).
