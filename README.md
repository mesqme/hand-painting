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
| 3 | Test in the scene | The **level view**: a 45° tilted stage (camera-at-(7,7,7) look) with a full 3D floor grid; the four-piece crew stands on an even grid, hero on slot 2 — everything sized to stay INSIDE the scene window |
| 4 | Bake | Red seam lines appear (constant width — the color alone reads), the model drops to wireframe, the sheet clears and shows the unwrapped layout as wireframe, then the sweep wipes the baked skin back on |
| 5 | Hand paint | Nothing travels: the sheet wipes baked→painted and the model wears it simultaneously (the Photoshop story) |
| 6 | Artist live loop | The SAME level view, now painted; a **texture dropdown docked next to the model** opens by script, picks a texture, and the hero repaints — the dropdown is also fully real (click it), plus the OS PNG drop |
| 7 | Combine | Nobody moves: the crew HOLDS its window slots while each model's texture sheet lifts off it and the four sheets fly into one 2×2 atlas docked right |
| 8 | Compress | Atlas shrinks into the floating stamped KTX2 chip next to the script |
| 9 | Batch | Level view returns in **wireframe**; the KTX chip flies in, the combined texture applies member-by-member, and every creature comes alive (hop / spin / roll). Perf monitor lives inside the window; draw calls **staged as "1"** for the draft — the real BatchedMesh version is a separate production task |

## The unwrap is real (TEXCOORD_1)

`duckColumn.glb` carries the real seam-cut unwrap in its **second UV layer
(`TEXCOORD_1` → `uv1`)**. Duck and column were **unwrapped together into ONE
shared texture** that fills the whole 0–1 space, so `unwrapLayout.js` uses uv1
verbatim — no re-packing, no per-mesh rescaling:
- **islands** = connected charts in uv1 (22: duck 4, column 18);
- **seams** (act 04, red lines on the model) = uv1 chart-boundary edges in 3D;
- **act-02 outlines** = the same boundaries in uv1-layout space, animating onto
  the gradient-palette strips (`uv0`);
- **`aUnwrapUv`** = `uv1` exactly (the flatten target + act-02 sample start
  pose) — the sheet shows the real islands where the baked texture has them.

Note: the model's `uv0` maps every part to a narrow palette region (column
u 0.698–0.706, duck u 0.514–0.515), so act 02's "parked on strips" beat lands
the parts on ~one strip. Spread `uv0` across more palette columns in Blender if
you want that beat to look more distributed.

`uv0` (`TEXCOORD_0`) stays the gradient-palette strip lookup. Still to come from
the artist side: the baked PNG for this layout and real hand-painted textures
(drop any PNG on the page in act 06 to preview one live).

## How it's wired

- `src/scroll/choreography.js` — the heart. A mutable `params` object + one gsap
  timeline scrubbed by ScrollTrigger across the whole page. Timeline positions are
  authored in scroll units: **1 unit = one 170vh section**. World components read
  `params` in `useFrame` and write to objects/uniforms imperatively.
- `src/world/materials/assetMaterial.js` + `src/shaders/asset/*.glsl` — one shader
  for every model state: `uWhiteMix` (clay), `uMapBase` (gradient/baked),
  `uReveal` (baked→painted wipe), `uMapPaintA/B + uSwapWipe` (live swap wipe),
  `uUnwrap` (position→UV morph used by the bake act; seams come free with the UVs).
- `src/world/unwrapLayout.js` — island model from the real `uv1`: islands,
  seams, outlines and the `aUnwrapUv`/`aPackOrder` attributes.
- `src/world/uvIslands.js` — act-02 line animation: island outlines start in
  the real uv1 layout ("full scale") and shrink onto their palette strips.
- `src/world/textureLibrary.js` — swatch registry. Painted variants are currently
  generated from the gradient (hue shift + brush dabs) as placeholders.
- `src/ui/TextureDropdown.jsx` — act-06 dropdown docked next to the model:
  scripted open/pick demo driven by choreography params, plus the real picker
  and the OS PNG drop.
- `src/ui/Sections.jsx` — DOM copy deck; per-section ScrollTriggers fade the sticky
  cards and track the active step for the dropdown/perf monitor.

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

Checks the island model against the GLB: attributes in 0–1, no NaNs,
`aUnwrapUv` matching the authored `uv1` exactly, and the `aPackOrder` ↔
`uvIslands` lockstep that keeps the act-02 model coloring in sync with the
sheet animation. Re-run after re-exporting the model.

```bash
node scripts/verify-geometry.mjs
```

Checks the level-view geometry (`ISO` in `config.js`): the FULL floor grid and
every model stay inside the scene window (top and bottom) at every aspect, the
four iso slots don't overlap on screen, and the contact shadows sit on the
grid. Re-run after touching `ISO`, `ISO_SLOTS`, or `ISO_GRID_EXTENT`.

## Debug hooks (dev only)

- `window.__params` / `window.__timeline` — choreography state
- `window.__three` — `{ gl, camera, scene, stage }`
- `window.__stage` — zustand store (step, swatches)

## Model source

`public/models/duckColumn.glb` — nodes `duck` and `column`; authored Blender tilt
is baked into the geometry at load and the pair is normalised to a 2.6-unit-tall
assembly centered on the origin (`src/world/useDuckColumn.jsx`).
