# Hand-Painting for Three.js

One-page scroll presentation of the team's hand-painting asset workflow, built for a ~20 min talk.
Vite + React Three Fiber, one fixed canvas behind an introduction and nine workflow acts.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static build in dist/
```

## The nine workflow acts

| # | Act | What happens |
|---|-----|--------------|
| 1 | Create the model | White clay + wireframe; the very first scroll already moves the scene |
| 2 | Gradient palette | Model center, sheet far right; island outlines pack onto the sheet while the **model's colors resolve island-by-island in lockstep** |
| 3 | Test in the scene | The **level view**: a 45° camera-at-(7,7,7) look with four evenly spaced objects on an invisible floor; the hero tests small, large and final production scales |
| 4 | Bake | White texture on the left + opaque neutral model → wireframe and seams → real UV layout → baked texture |
| 5 | Hand paint | The texture moves left-to-center while the hero moves right; a sharp noisy paint edge reveals `duck_base` on the sheet and model |
| 6 | Live updates | The larger dropdown opens and uses short painterly wipes: base → pastel → red → aberration |
| 7 | Combine | Four borderless square textures scale up over their matching objects, then merge edge-to-edge into one square atlas |
| 8 | Compress | The objects and scene remain visible while the atlas scales down slightly and receives a KTX2 badge |
| 9 | Batched mesh | Neutral wireframe objects receive empty RGBA signs, R geometry IDs from the atlas, then G texture-variant IDs |

## The unwrap is real (TEXCOORD_1)

The hero pair in `pairs.glb` carries the real seam-cut unwrap in its **second
UV layer (`TEXCOORD_1` → `uv1`)**. Duck and column were **unwrapped together into ONE
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
- `src/world/materials/assetMaterial.js` — textured states are based on a real
  unlit `THREE.MeshBasicMaterial`, patched only for UV selection and sharp noisy
  wipes. Neutral states use separate shaded `THREE.MeshStandardMaterial`
  layers, and wireframes use ordinary wireframe `MeshBasicMaterial`.
- `src/world/unwrapLayout.js` — island model from the real `uv1`: islands,
  seams, outlines and the `aUnwrapUv`/`aPackOrder` attributes.
- `src/world/uvIslands.js` — act-02 line animation: island outlines start in
  the real uv1 layout ("full scale") and shrink onto their palette strips.
- `src/world/textureLibrary.js` — swatch registry. Painted variants are currently
  generated from the gradient (hue shift + brush dabs) as placeholders.
- `src/ui/TextureDropdown.jsx` — act-06 dropdown docked next to the model:
  scripted painterly selections driven by choreography params, plus the real picker
  and the OS PNG drop.
- `src/ui/ProcessNotes.jsx` — short palette, bake, Photoshop, KTX2 and batchColor labels.
- `src/ui/BatchDataOverlay.jsx` — empty RGBA signs plus R/G instance IDs.
- `src/ui/Sections.jsx` — fixed DOM copy deck driven by the same authored
  scroll-time coordinates as the 3D timeline; it also tracks the active step
  for the dropdown and performance monitor.

## Swapping in real textures later

Hero duck maps already live in `public/textures/`:

| File | Role |
|------|------|
| `duck_base.png` | Hand-paint reveal target and the first live-update option |
| `duck_baked.png` | Bake-step result on the model + sheet |
| `duck_base_abberation.png` | Finished look shown in the introduction and selected last in the live-update act |
| `duck_pastel.png` / `duck_red.png` | Intermediate live-update options |

Crew meshes don't share the duck's uv1 unwrap, so they still wear hue-shifted
gradient stand-ins. Drop any PNG on the page in act 06 to add another live
swatch.

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

Checks the level-view geometry (`ISO` in `config.js`): every model stays inside
the scene window at every tested aspect ratio and the four iso slots do not
overlap on screen. Re-run after touching `ISO` or `ISO_SLOTS`.

## Debug hooks (dev only)

- `window.__params` / `window.__timeline` — choreography state
- `window.__three` — `{ gl, camera, scene, stage }`
- `window.__stage` — zustand store (step, swatches)

## Model source

`public/models/pairs.glb` — four object+column pairs: `duck`/`column_duck`
(the hero, the only pair with `TEXCOORD_1`), `barrel`/`column_barrel`,
`book`/`column_book` and `meat`/`column_meat` (the crew). Authored Blender
transforms are baked into the geometries at load and every pair is normalised
to a 2.6-unit-tall assembly centered on the origin (`src/world/usePairs.jsx`).
