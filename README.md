# Flat Palette — hand-painting pipeline

One-page scroll presentation of the team's hand-painting asset workflow, built for a ~20 min talk.
Vite + React Three Fiber, one fixed canvas behind eight scrolling acts.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static build in dist/
```

## The eight acts

| # | Act | What happens in 3D |
|---|-----|--------------------|
| 1 | Create the model | White clay + wireframe duck/column, cursor parallax |
| 2 | Gradient palette | Model turns gradient; UV island outlines fly from full scale onto the palette sheet |
| 3 | Test in the scene | Model shrinks, four sibling columns pop in around it |
| 4 | Bake | Model splits; the copy **unwraps vertex-by-vertex onto the sheet** (positions → UV), bake sweep passes |
| 5 | Hand paint | Baked model wipes to a painted texture; tray swatches drag onto the duck; **drop any PNG on the page** to paint live |
| 6 | Combine | Four painted minis; their four sheets fly into one 2×2 atlas |
| 7 | Compress | Atlas shrinks into a stamped KTX2 chip next to the compression script |
| 8 | Batch | Four columns + duck/knot/torus floaters in ONE BatchedMesh — perf monitor reads 1 draw call |

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

## Debug hooks (dev only)

- `window.__params` / `window.__timeline` — choreography state
- `window.__three` — `{ gl, camera, scene, stage }`
- `window.__stage` — zustand store (step, swatches)

## Model source

`public/models/duckColumn.glb` — nodes `duck` and `column`; authored Blender tilt
is baked into the geometry at load and the pair is normalised to a 2.6-unit-tall
assembly centered on the origin (`src/world/useDuckColumn.jsx`).
