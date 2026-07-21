# Utanomori Code Style Guide — Three.js Journey Conventions

Distilled from the Three.js Journey course final projects (lessons 04–80, with lesson 66
"Create a game with R3F" weighted most heavily for architecture, lesson 26 for plain-JS
modules, and lessons 27–44 for shaders). Supplemented by a production reference read of
Bruno Simon's **folio-2025** (~30k lines, vanilla three.js WebGPU/TSL + Rapier + Howler +
Tweakpane, same author as the course) — production-derived guidance is marked
"**folio-2025:**" throughout so lesson-derived and production-derived advice stay
distinguishable; §7 collects the full production findings.

**Framing — read this first.** This guide describes *Journey conventions* so that course
students find Utanomori's code familiar. It does NOT mandate rewriting the game's
architecture. Utanomori keeps its own architecture wherever it is better (see §6).
Each section states which layer of the codebase it applies to:

- **R3F layer** — `.jsx` components, stores, hooks, Leva (§1, §5)
- **Universal** — every file (§2)
- **Engine layer** — framework-free plain-JS modules: audio engines, field/singleton utils (§3)
- **Shader layer** — `.glsl` files and their JS bindings (§4)

---

## 1. R3F architecture idioms (lessons 54–66; lesson 66 is the reference project)

### 1.1 Entry / composition split

Three fixed responsibility tiers, one file each:

- **`index.jsx`** — the ONLY file that touches the DOM. Imports the global stylesheet,
  creates the root on `#root`, renders `<StrictMode>` wrapping the `<Canvas>` (and any
  DOM siblings). ALL renderer/camera config lives on `<Canvas>` props
  (`camera={ { fov: 45, near: 0.1, far: 200, position: [ - 4, 3, 6 ] } }`,
  `shadows`, `flat`, `gl={ { ... } }`). Zero scene logic.
  - Context providers that must serve both WebGL and DOM wrap BOTH: in lesson 66,
    `<KeyboardControls map={ [ { name, keys } ] }>` wraps `<Canvas>` *and* the DOM
    `<Interface />` so one keyboard context feeds the frame loop and the HTML key
    indicators.
  - The Leva panel root (`<Leva collapsed />`) is a *sibling* of Canvas, never inside it.
- **`Experience.jsx`** — a pure scene *composer*. In lesson 66 it is ~20 lines: subscribe
  to a couple of store fields, render `<Physics><Lights /><Level /><Player /></Physics>`
  plus background color. It owns NO behavior.
- **Behavior components** (`Player.jsx`, `Level.jsx`, `Lights.jsx`, `Interface.jsx`) —
  each owns exactly one concern. **One owner per concern is the course's core boundary
  rule**: notably the camera is written ONLY by Player. (Utanomori's own
  "one cameraRig owner per phase" invariant is the same idea — keep it.)

### 1.2 Component file conventions

- One component per file, `PascalCase.jsx`, filename === default-exported function name:
  `export default function Experience()`.
- Multi-component files (like `Level.jsx`) use **named exports** for the public pieces
  (`export function BlockStart`, `export function Level`) and plain unexported functions
  for private helpers (`function Bounds`).
- Stores live in `src/stores/`, named `use<Thing>.jsx` (`useGame.jsx`), default-exporting
  `create(...)`.
- Model components own their loading: `useGLTF(path)` inside the component and
  `useGLTF.preload(path)` at module scope as the *last line of the file* (lesson 59).
- gltfjsx-generated files are left in their generator's style — don't reformat generated
  code; hand-written files keep the house style.
- Internal ordering inside a component (lessons 58/62/65/66):
  1. refs (+ `useHelper` immediately after the ref it observes)
  2. store selectors / `useControls` blocks
  3. lazy per-instance state (`const [ speed ] = useState(() => Math.random())`)
  4. `useEffect` (subscriptions)
  5. `useFrame`
  6. handler consts (`const jump = () => {...}`)
  7. JSX last, `return <>`
- JSX scene order inside the fragment: debug tools (Perf) → controls
  (`<OrbitControls makeDefault />`) → lights → meshes/content, blank line between blocks.
- Refs are named for the thing, no `Ref` suffix in the mature lessons: `body`, `obstacle`,
  `light`, `time`. (Earlier lessons use `cubeRef`; either is course-legal, prefer the bare
  noun.)

### 1.3 Zustand store patterns (lesson 66)

```js
export default create(subscribeWithSelector((set) =>
{
    return {
        /**
         * Data
         */
        blocksCount: 10,
        blocksSeed: 0,

        /**
         * Time
         */
        startTime: 0,
        endTime: 0,

        /**
         * Phases
         */
        phase: 'ready',

        start: () =>
        {
            set((state) =>
            {
                if(state.phase === 'ready')
                    return { phase: 'playing', startTime: Date.now() }

            return {}
            })
        },
        // restart, end ...
    }
}))
```

- **Shape**: plain data fields first (nouns), then action methods (verbs), grouped under
  `/** Section */` banners.
- **Actions are a guarded state machine**: every action uses the *functional* `set`,
  checks the current phase, and `return {}` for a no-op. This makes illegal transitions
  impossible instead of merely unlikely.
- Wrap the store in `subscribeWithSelector` so components can react outside render.
- **Read patterns, by frequency**:
  - Reactive UI: narrow selectors, one field per hook call —
    `const start = useGame((state) => state.start)` (one per line).
  - Per-frame / event-edge logic: `useGame.subscribe(selector, handler)` inside ONE
    `useEffect`, every subscription captured as `unsubscribeX` and all returned in a
    single cleanup.
  - 60fps DOM updates: `addEffect(() => { const state = useGame.getState(); ... })` +
    writing `ref.current.textContent` directly — React never re-renders per frame
    (lesson 66 `Interface.jsx`).

### 1.4 useFrame usage

- Animate through **refs and uniforms, never setState per frame** (lesson 61's core
  lesson). React reconciliation handles low-frequency prop changes; the frame loop
  mutates three.js objects imperatively.
- One `useFrame` per behavior component. Long frame loops are partitioned with banner
  comments in a fixed order — lesson 66's Player: `/** Controls */`, `/** Camera */`,
  `/** Phases */`.
- Forces/movement are delta-scaled (`impulseStrength * delta`); camera follow is
  lerp-smoothed with delta-based factors.
- Module-scope shared resources: geometries and materials used by many meshes are created
  ONCE at module top-level, before the component, and passed as props
  (`geometry={ boxGeometry } material={ floor1Material }`) — lessons 60/66.

### 1.5 drei usage

- One import line per package, names roughly ordered by use:
  `import { useGLTF, OrbitControls, Text, Float } from '@react-three/drei'`.
- `<OrbitControls makeDefault />` so staging helpers can take over cleanly.
- `useKeyboardControls` both ways: selector form for reactive UI highlights, and
  `const [ subscribeKeys, getKeys ] = useKeyboardControls()` with `getKeys()` read
  imperatively per frame.
- Geometry/material as JSX children when defaults suffice (`<sphereGeometry />`), the
  module-scope escape hatch when shared (see 1.4).
- Multi-prop drei components: one prop per line at one indent.

### 1.6 KeyboardControls

- The `map` is declared inline on the provider in `index.jsx`:
  `map={ [ { name: 'forward', keys: [ 'ArrowUp', 'KeyW' ] }, ... ] }` — semantic action
  names, both arrow and WASD keys listed.
- Key-press *edges* are handled via `subscribeKeys(selector, handler)` (jump on
  false→true), continuous state via `getKeys()` in `useFrame`.

### 1.7 Leva / debug patterns

See §5.

---

## 2. Universal style (all lessons)

Applies to every file in every layer.

### 2.1 Section banners — exact format

The course's signature. A JSDoc-style block comment, asterisk-aligned, title-cased short
noun phrase, verbatim:

```js
/**
 * Controls
 */
```

- Used to partition: flat script files by concern (Base, Sizes, Camera, Renderer,
  Animate), long `useFrame` bodies (Controls / Camera / Phases), and store definitions
  (Time / Phases).
- Sub-steps beneath a banner use short single-line comments: `// Geometry`, `// Material`,
  `// Mesh`, `// Update sizes`, `// Update camera`, `// Update renderer`.
- Banners may nest (inner banners inside a function, lesson 18/30) and may be indented
  inside a frame loop (lesson 39).

### 2.2 Formatting (as observed, consistently, across ~70 projects)

- **No semicolons.**
- **4-space indentation.**
- **Single quotes** in JS; double quotes only for JSX string props (`position="top-left"`).
- **Allman-ish braces**: the opening brace of function bodies — including arrow callbacks
  and component functions — goes on its own line:

  ```js
  const tick = () =>
  {
      ...
  }

  export default function Experience()
  {
      ...
  }
  ```

- **Spaced unary minus**: `- 1.5`, `- Math.PI * 0.5`, `position-x={ - 2 }`.
- **Spaces inside JSX braces and literals**: `{ count }`, `position={ [ 1, 2, 3 ] }`,
  `gl={ { antialias: true } }`, `const [ count, setCount ] = useState(0)`.
- **No space after `if` / `for`**: `if(model)`, `for(let i = 0; i < count; i++)` —
  with Allman braces on their blocks, or braceless single-statement bodies
  (`if(value === 'ready')\n    reset()`).
- Index-stride idiom: `const i3 = i * 3`, explicit `+ 0` (`array[i3 + 0]`), and aligned
  bracket padding (`positions[i3    ]`) when it helps columns line up.
- Commented-out alternatives are course culture (finals keep rejected experiments as
  reference). For Utanomori: acceptable in moderation, but prefer deleting dead code in
  production paths — this is a teaching habit, not an engineering one.
  - **folio-2025:** production Bruno *keeps* the habit (whole disabled methods, `// Doesn't
    work` notes, even a misspelled `Ligthing.js` filename shipped unrenamed). So this is
    pragmatism, not a rule — but Utanomori's cleanup branch exists precisely for public
    sharing, so keep the stricter delete-dead-code stance here.
  - **folio-2025:** formatting itself is stable from the course into 2025 production —
    Allman braces, no semicolons, 4-space indent, no space after `if(`/`for(`, spaced
    unary minus, `// Section` mini-banners, space inside array literals (`[ 'intro' ]`)
    all hold unchanged. The guide's formatting rules are safe to enforce long-term.
    (Also: vendored/copied code keeps its upstream style unformatted — same rule as our
    gltfjsx note.)

### 2.3 Naming

- camelCase descriptive nouns, no abbreviations: `environmentMapTexture`,
  `objectsToUpdate`, `loadingBarElement`.
- The `<thing><Role>` triple for object families: `waterGeometry` / `waterMaterial` /
  `water`; `firefliesGeometry` / `firefliesMaterial` / `fireflies`.
- Raw typed arrays suffixed `Array` (`positionsArray`, `scalesArray`) to distinguish from
  the attribute names they feed (`aScale`).
- State flags as `let currentIntersect = null`, `let model = null` — declared at top
  scope next to whatever sets them, null-guarded at use.
- Handlers/actions are verbs (`start`, `restart`, `jump`, `reset`); state fields are
  nouns (`phase`, `blocksCount`).
- Underscore prefix ONLY for constructor params shadowing a property (`constructor(_canvas)`)
  or to dodge an import collision (`_color`) — nowhere else.
  - **folio-2025:** in production this convention is *fading* — it survives only in the
    oldest files (`Events`, `ResourcesLoader`); newer 2025 code drops it (`updateStep(step)`).
    Treat underscore params as legacy: don't introduce them in new Utanomori code.
- **folio-2025:** state machines use SCREAMING_SNAKE static int constants on the class
  (`Menu.OPEN`, `Player.STATE_DEFAULT = 1`, `Inputs.MODE_TOUCH`) instead of the course's
  string phases, with guard clauses over them (`if(this.state !== Player.STATE_DEFAULT)
  return`). Utanomori's zustand string phases (`'ready'`/`'playing'`) are fine for the
  store; plain-JS engine modules with internal state machines should prefer the static
  constant idiom.
- **folio-2025:** shared-shader-state naming is systematic at scale: properties holding a
  uniform get a `Uniform` suffix when a plain twin exists (`this.elapsed` +
  `this.elapsedUniform`); booleans that gate material features are `has*` flags
  (`hasFog`, `hasReveal`); resource keys are `nameKindModel` / `nameTexture`
  (`birchTreesReferencesModel`, `paletteTexture`).

### 2.4 Object creation order

Always **geometry → material → mesh → flags/transform → scene.add**, with the three
sub-comments marking each step:

```js
// Geometry
const waterGeometry = new THREE.PlaneGeometry(2, 2, 512, 512)

// Material
const waterMaterial = new THREE.ShaderMaterial({ ... })

// Mesh
const water = new THREE.Mesh(waterGeometry, waterMaterial)
water.rotation.x = - Math.PI * 0.5
scene.add(water)
```

In R3F the JSX mirror is: transform props on `<mesh>`, then the geometry child, then the
material child.

### 2.5 Parameter-object patterns

Two course-legal styles for a bag of tweakables:

- Empty-then-assign (dominant in shader lessons):
  `const materialParameters = {}` then `materialParameters.color = '#ffffff'`, one
  assignment per line.
- Object literal (`const parameters = { materialColor: '#ffeded' }`) when small.

Parameter holders are named after their target: `materialParameters`,
`rendererParameters`, `earthParameters`; the generic debug bag is always `debugObject`.
Related state is grouped in plain namespace objects rather than loose variables:
`this.animation = { mixer, actions, play }`, `const gpgpu = {}`, `const displacement = {}`.

Named re-apply closure pattern: a settings function that must touch many objects is
stored once, called immediately, and reused as the GUI onChange handler
(`updateAllMaterials`, `updateSun`).

### 2.6 Import ordering

1. `three` namespace (or `three/webgpu`) first
2. three addons/examples (`OrbitControls`, loaders)
3. third-party libs (GUI/leva, gsap, cannon-es, CSM)
4. shader files last, named `<effect>VertexShader` / `<effect>FragmentShader`

In R3F files: fiber/drei/library imports before local components; react hooks wherever
natural. (The course is loose here — grouped, not alphabetized. Don't add an
import-sorter; just keep three-first, shaders-last.)

---

## 3. Vanilla / plain-JS module style (lesson 26 "Code structuring for bigger projects")

**Applies to Utanomori's framework-free engine modules only** — the audio engines
(`ambientSounds.js`-style), field/singleton utilities, and similar plain-JS code that
lives outside React.

**⚠️ The Experience-singleton architecture itself does NOT apply to an R3F app.**
Lesson 26's root orchestrator, service-locator (`this.experience = new Experience()`),
hand-rolled rAF `Time`, `Sizes`, and `Resources` classes exist to solve problems that
R3F/drei already solve (the frame loop, resize, suspense-based loading, context as
dependency injection). Do not introduce an Experience singleton, do not route R3F
components through a service locator, and do not add a second rAF loop.

What DOES transfer to framework-free engine modules:

- **One class per file, default export, class name === filename** (`Camera.js` exports
  `class Camera`).
  - **folio-2025:** production uses *named* exports (`export class Ticker`) with default
    export reserved for utilities — either is fine; keep filename === class name.
    Classes are singular nouns for systems (`Terrain`, `Wind`), plural for
    collection managers (`Zones`, `Objects`, `Explosions`) whose `create()`/`add()`
    return plain-object items, not class instances.
- **Constructor rhythm**: grab/store dependencies first (a few lines of
  `this.x = ...` that read as an honest dependency manifest), optional debug hookup,
  then `set` -prefixed build steps in dependency order:
  `setGeometry()` → `setMaterial()` → `setMesh()`; each `setXxx` creates exactly one
  concern and stores it on `this`.
  - **folio-2025:** the recipe hardened into a near-universal shape: deps first → plain
    state → `setX()` calls in order → per-frame registration last. Method ordering in
    the class body is rigid: constructor → `setX()` builders in call order → imperative
    action verbs (`start`/`stop`/`open`/`close`/`play`) → `update()` **last** →
    getters/setters at the bottom.
- **folio-2025 — method grammar (adopt this vocabulary):** `setX()` = build/wire a
  sub-feature once from the constructor; `update()` = per-frame; `updateX(value)` =
  apply a state change (`updateStep`, `updateProgress`); `changeX` = user-facing switch
  (`changeLevel`); `addX` = registration (`addActions`, `addPunctualEvent`); `getX` =
  computed retrieval; `createX` = factory returning instances. Toggleable behaviors are
  **guarded idempotent verbs**: `start(){ if(this.running) return; ...; this.running =
  true }`.
- **Lifecycle methods** named exactly `resize()` / `update()` / `destroy()`;
  `destroy()` does real disposal (dispose geometries/materials, remove listeners,
  cancel timers/audio nodes).
  - **folio-2025:** production only writes `destroy()` where teardown actually matters
    (intro-only objects: destroy, null the reference, and unsubscribe your own tick
    handler — `ticker.events.off('tick', this.update)` with the bound fn kept from the
    ctor). An always-alive system needs no destroy; don't write ceremony ones. But when
    a phase *ends* (Utanomori's intro/finale), fully reclaim it like folio's Reveal
    step 2 does.
- **Wrapped third-party objects on `.instance`** when a class wraps one real underlying
  object (an `AudioContext` wrapper exposing `this.instance`).
- **Related sub-state in plain namespace objects**: `this.animation = { mixer, actions,
  play }` — not a dozen flat properties.
  - **folio-2025:** this scaled up into a legitimate middle ground before extracting a
    class: `this.mute = {}` / `this.playlist = {}` / `this.bulletTime = {}` built
    imperatively in a `setX()` method, with **closures attached as methods**
    (`this.mute.toggle = () => {...}`, `this.bulletTime.activate = (duration = 1.5) =>
    {...}`). Reach for this before promoting a sub-feature to its own file.
- **Events flow inward, calls flow outward**: only broadcast *sources* get an emitter
  (with a tiny `on`/`off`/`trigger` API and short lowercase event names — `'resize'`,
  `'tick'`, `'ready'`); consumers are driven by direct method calls
  (`engine.update(delta)`), dispatched in one documented order by one owner.
  - **folio-2025:** emitters moved from *inheritance* (`extends EventEmitter`) to
    **composition**: services own `this.events = new Events()`; even tiny plain-object
    items get their own emitter. Event names pair intent vs completion
    (`'open'`/`'opened'`) or are change nouns (`'muteChange'`, `'modeChange'`).
  - **folio-2025 — priority-ordered ticks:** folio's emitter takes a numeric order
    bucket (`ticker.events.on('tick', cb, 9)`; render subscribes at 998 so it is
    provably last). Cross-system frame ordering is *declared at the subscriber*,
    greppable, deterministic — never implied by registration/mount order. In R3F the
    native twin is `useFrame(cb, priority)`; inside plain-JS engines, keep a small
    ordered callback list. This is the production answer to Utanomori's
    frame-ordering bug class (the see-through placed-gate bug was exactly this).
  - **folio-2025 — frame-wait scheduling:** `ticker.wait(nFrames, cb)` as a first-class
    primitive for frame-coupled deferral (warm-ups, deferred impulses, first-frame
    races) instead of `setTimeout`. Utanomori already learned this lesson ad-hoc with
    the placed-gate warm-up counter; a shared frame-wait utility on the game loop is
    the generalized form.
- **Declarative asset manifest**: a pure-data `sources.js`-style array of
  `{ name, type, path }`, assets read by name from a single loaded-items map, one
  `'ready'` gate so consumers never null-check. (Utanomori's audio-loading *tiers* are a
  deliberate deviation — keep the tiers; the manifest idea can still shape each tier's
  file list.)
  - **folio-2025:** production evolved this into a *promise-based* loader: aligned
    positional tuples `[ name, path, type, modifierFn? ]` (per-resource config inline),
    a URL-keyed cache Map so repeated loads dedupe, multi-batch loading with a progress
    callback driving the loader UI, and a tiny intro-critical batch awaited *before*
    the big background batch. This is exactly the shape of Utanomori's audio tiers —
    production validates the tiering; consider the tuple-manifest style per tier.
- Underscore-prefixed constructor params (`constructor(_canvas)`), default args for
  tunables (`radius = 2`). (**folio-2025:** underscore params are legacy — see §2.3.)
- **folio-2025 — manager-of-plain-objects:** collection managers (`register()` /
  `create()`) return mutable plain objects with their own small emitter, held in one
  items array/Map that the manager iterates in a single `update()` loop — no
  class-per-item overhead, per-frame iteration in one place. Utanomori's
  ambientSounds.js / MusicController already lean this way; codify it.
- **folio-2025 — one owner per shared uniform:** the system that owns a piece of global
  shading state exposes named uniform objects (and, in folio, node-builder functions)
  as its public API; many materials import them *by reference*; ONE `update()` writes
  them per frame. This is precisely Utanomori's `themeMaskUniforms` + one
  `updateThemeMask` per frame invariant — production confirms it as the universal rule
  (lighting, fog, water, time all work this way in folio), not a local trick. Time
  specifically: mirror elapsed/delta into shared uniforms once per tick in one place;
  never per-material clocks. Clamp delta (folio: `maxDelta = 1/30`).

---

## 4. Shader conventions (lessons 27–44, 52, 61)

Applies to all `.glsl` files and their JS-side bindings.

### 4.1 File layout

- One folder per effect: `src/shaders/<effect>/vertex.glsl` + `fragment.glsl`
  (never inline template literals when vite-plugin-glsl is available).
- Shared GLSL helpers in `src/shaders/includes/`, **one function per file**
  (`perlinClassic3D.glsl`, `simplexNoise3d.glsl`), pulled in via
  `#include ../includes/perlinClassic3D.glsl` placed *after* uniform+varying
  declarations, *before* functions.
- JS import names carry the effect: `import portalVertexShader from
  './shaders/portal/vertex.glsl'`.
- Borrowed code keeps its attribution comment
  (`// Classic Perlin 2D Noise by Stefan Gustavson`).

### 4.2 Naming (strict, course-wide)

| Kind      | Prefix | Examples                                    |
|-----------|--------|---------------------------------------------|
| uniform   | `u`    | `uTime`, `uBigWavesFrequency`, `uColorStart` |
| attribute | `a`    | `aScale`, `aRandom`, `aTimeMultiplier`       |
| varying   | `v`    | `vUv`, `vElevation`, `vNormal`, `vPosition`  |

Uniform color families spell it out: `uColorWaterDeep`, `uColorSand`, `uColorGrass`.
(Exception noted by the course itself: postprocessing `Effect` uniforms are lowercase
un-prefixed because the library maps them by name.)

JS-side: uniforms declared with `new THREE.Uniform(x)` in the newer lessons (32+), or
`{ value: x }` in older ones — either is fine, be consistent per file. Grouped by blank
lines mirroring their meaning (big waves / small waves / colors).

### 4.3 GLSL formatting & structure

- Same house style: 4-space indent, spaced unary minus (`step(- 0.2, strength)`),
  Allman braces.
- `main()` is partitioned by short step comments in compute order:
  `// Base position`, `// Elevation`, `// Displace the UV`, `// Fresnel`,
  `// Final color` — every fragment ends with a `// Final color` (or
  `// Final position` / `// Final size` in vertex) step.
- Vertex shaders spell out the matrix chain in named intermediates, never one-lined:

  ```glsl
  vec4 modelPosition = modelMatrix * vec4(position, 1.0);
  vec4 viewPosition = viewMatrix * modelPosition;
  vec4 projectedPosition = projectionMatrix * viewPosition;
  gl_Position = projectedPosition;
  ```

- Fragment mains open by normalizing: `vec3 normal = normalize(vNormal);`, and where
  relevant `vec3 viewDirection = normalize(vPosition - cameraPosition);`.
- Each visual effect is compute-mask-then-mix; intermediates named by feature prefix
  (`foamNoise`, `foamMask`, `foamColor`).
- Multi-arg helper calls may use column-aligned per-argument trailing comments:

  ```glsl
  color = halftone(
      color,                 // Input color
      uShadowRepetitions,    // Repetitions
      vec3(0.0, - 1.0, 0.0), // Direction
      ...
  ```

- A trailing `// Varyings` block at the end of vertex `main()` assigns all varyings
  together.
- When patching built-in materials (`onBeforeCompile` / CSM patchMap), injected chunks
  repeat the replaced `#include <...>` on their first line so the patch stays additive.

### 4.4 R3F binding (lesson 61)

`shaderMaterial` + `extend` at **module scope**, above the component:

```js
const PortalMaterial = shaderMaterial(
    { uTime: 0, uColorStart: new THREE.Color('#ffffff') },
    portalVertexShader,
    portalFragmentShader
)
extend({ PortalMaterial })
```

JSX tag is the lowercased key (`<portalMaterial ref={ portalMaterial } />`); per-frame
uniform writes go through the ref (`portalMaterial.current.uTime += delta`), never
through React state.

---

## 5. Debug UI conventions

### 5.1 lil-gui (vanilla / engine-side, lesson 9 onward + lesson 26)

- `const gui = new GUI({ width: 340 })` under a `// Debug` sub-comment in the `Base`
  (or leading `Debug`) section; `const debugObject = {}` right beneath it for values
  that aren't live object properties (hex color strings mirroring Color uniforms,
  action-button closures).
- Debug shipped but gated: active only behind a flag (lesson 26 uses
  `window.location.hash === '#debug'`; every debug block wrapped in
  `if(this.debug.active)`).
- Folder per entity (`this.debugFolder = this.debug.ui.addFolder('fox')`), tweaks
  colocated **next to the thing they tune**, not gathered at the file end.
- Control naming: `.name()` mirrors the uniform or property exactly
  (`.name('uBigWavesFrequencyX')`) or a camelCase composite (`'sunLightIntensity'`).
- Ranges always explicit; the canonical fine step is `0.001`
  (`.min(0).max(10).step(0.001)`), `step(1)` for counts.
- Two chaining forms, both house-legal: dense one-line
  `gui.add(mat.uniforms.uSize, 'value').min(0).max(500).step(1).name('uSize')` and the
  vertical fluent form with each method on its own indented line; plus the compact
  positional overload `gui.add(u, 'value', 0, 2, 0.001).name('uStrength')` in later
  lessons.
- Colors: `gui.addColor(debugObject, 'colorA').onChange(() =>
  { uniforms.uColorA.value.set(debugObject.colorA) })`.
- Buttons: closures on `debugObject` then `gui.add(debugObject, 'createSphere')`.

### 5.2 Leva (R3F, lessons 57/58/63)

- **One `useControls` call per logical object**, folder name as first arg, destructure
  only what's used: `const { position, color, visible } = useControls('sphere', { ... })`.
- Folder names are lowercase nouns of the thing they drive (`'sphere'`, `'cube'`,
  `'debug'`), spaces allowed (`'contact shadows'`, `'environment map'`); control keys
  camelCase (`perfVisible`, `envMapIntensity`).
- Typed control configs instead of magic numbers:
  `scale: { value: 1.5, min: 0, max: 5, step: 0.01 }`.
- Debug-controls-the-debug-UI: `const { perfVisible } = useControls('debug',
  { perfVisible: false })` and `{ perfVisible && <Perf position="top-left" /> }` as the
  FIRST child of the fragment — mounted/unmounted, not hidden.
- `<Leva collapsed />` by default; panel is a DOM sibling of Canvas.
- Pin `leva` to an exact version; caret everything else.

Utanomori's Controls.jsx (12 fixed top-level sections, theme dropdown, versioned
defaults in `config/parameterDefaults.js`) is a scaled-up production form of exactly
this convention — keep its structure; align the *naming grain* (folder = noun of the
thing, key = camelCase property, explicit min/max/step) with the course.

### 5.3 folio-2025 refinements (production debug practice)

- Bindings stay **colocated with the value they control**, gated by
  `if(this.game.debug.active)` as the *last* block of the owning constructor/method,
  in collapsed folders — production confirms the per-feature-folder instinct behind
  Utanomori's Leva scheme. (Folio titles folders with a leading emoji, `'🌱 Grass'`;
  optional flavor, not a rule.)
- **Factories accept a debug panel/folder handle as a parameter**
  (`createEmissiveGradient(..., debugPanel)`), so parameterized families self-register
  their tweaks. Leva equivalent: pass a folder path string into engine-module
  constructors/factories.
- **Manual/auto override binding** (`addManualBinding`): a value normally *driven by
  code* (cycle-interpolated color, distance-driven volume) gets a checkbox + value pair
  — auto by default, debug-overridable. Worth porting to Leva for Utanomori's
  theme-interpolated colors and MusicController distance volumes.
- **Readonly runtime stats** fed from `renderer.info` (`drawCalls`, `triangles`,
  `geometries`, `textures`) into monitor bindings, enabled by a URL hash (`#stats`) —
  zero-cost diagnostics toggles.
- Reusable binding helpers on the debug service (e.g. an SRGB-correct color binding
  that handles the hex round-trip) beat repeating conversion code at every call site.

---

## 6. Application notes for Utanomori

### Adopt — concrete, low-risk (naming / comments / ordering)

- `/**\n * Section\n */` banner comments to partition long files, long `useFrame`
  bodies, store definitions, and engine-module concerns; `// Sub-step` line comments
  beneath them.
- Geometry → material → mesh → flags → add ordering (and its `// Geometry` /
  `// Material` / `// Mesh` markers) wherever objects are built imperatively.
- Shader naming discipline: `u`/`a`/`v` prefixes everywhere; one folder per effect with
  `vertex.glsl` + `fragment.glsl`; shared helpers one-function-per-file in
  `shaders/includes/`; `// Final color` step comments; named matrix-chain intermediates.
- Store grammar: state nouns first / action verbs after; guarded functional `set` with
  `return {}` no-ops for phase transitions; narrow one-field selectors; subscriptions
  bundled in one effect with `unsubscribeX` cleanups; `addEffect` + `getState` for
  per-frame DOM.
- Module-scope shared geometries/materials; `useGLTF.preload` as the last line of model
  files.
- Naming: `<thing>Geometry/<thing>Material/<thing>` triples, `Array`-suffixed raw
  buffers, `debugObject` for GUI-only values, verbs-for-actions/nouns-for-state,
  underscore prefix only for shadowing params.
- Leva grain: folder = lowercase noun, key = camelCase, `{ value, min, max, step }`
  configs, step `0.001` for fine floats.
- Engine classes (audio, fields): `set`-prefixed build steps, `resize/update/destroy`
  lifecycle names, `.instance` for wrapped objects, namespace sub-objects for related
  state, real `destroy()` disposal.
- Import order: three first, addons, libs, shaders last.
- Formatting where files are already being touched: no semicolons, 4-space indent,
  single quotes, spaced JSX braces. (Adopt via Prettier-off/house config, not a
  hand-reformat of untouched files.)

**folio-2025 additions to the adopt list:**

- **Explicit frame-order priorities** — DOWNGRADED to "only on new bugs" (see the
  Personal-signature list below): Utanomori's registration order + documented warm-up
  gates is battle-tested and stays; reach for `useFrame(cb, priority)` only if a NEW
  ordering bug appears, never as a refactor sweep.
- **A shared frame-wait utility** (`wait(nFrames, cb)`) — optional nicety when a warm-up
  counter is next touched; not a refactor task.
- **folio audio-engine patterns** (see §7b): logical-vs-actual volume split;
  `register(options)` items with `onPlay`/`onPlaying` hooks; `playRandomNext`
  never-repeat variation pools; per-item `antiSpam`; mute persisted + blur/focus
  auto-mute + `is-audio-muted` html class; deferred `init()` after first gesture.
- **Guarded idempotent start/stop verbs** and the §3 method grammar
  (`setX`/`updateX`/`changeX`/`addX`/`getX`/`createX`) in engine modules.
- **Dirty-flag instancing**: per-reference `needsUpdate` flags, rewrite matrices only
  for flagged instances, set `instanceMatrix.needsUpdate` once; `StaticDrawUsage` on
  never-moving pools (stones, mushrooms, tree eyes).
- **Manual/auto debug overrides** for code-driven values (§5.3).
- **Asset-compression script** modeled on folio's `compress.js` (gltf-transform
  draco+ktx2 chain, per-texture srgb/linear presets) for deploy prep of the GLBs.
- **Data-in-GLB authoring**: names + `userData` in the DCC file driving per-prop config
  — validates the authored eyePlanes approach; consider extending to safe radii /
  spawn markers instead of JS constants.
- **Off-screen system culling** (folio's Area pattern): separate the gameplay radius
  (enter/leave events) from a visibility circle that skips a whole system's `update()`
  when off-screen — cheap layer above per-mesh frustum culling.

### Do NOT adopt

- **The Experience singleton / service-locator architecture** (lesson 26). R3F owns the
  loop, resize, and DI. No `new Experience()` getters, no second rAF, no global
  `window.experience`.
  - **folio-2025 confirms this stays out**: production hardened the pattern into
    `Game.getInstance()` reached from every constructor — but that is a *vanilla*
    necessity (no React tree to provide through), not a rule. Utanomori's split stands:
    R3F context/hooks + zustand for scene code; module-scope singletons only for
    framework-free engine modules (the audio engine already is one).
- **Externalizing all state to Leva** (lesson 57's teaching device). Utanomori's
  versioned `parameterDefaults.js` + store plumbing is the production-correct form;
  keep the `DEFAULT_*` + version-bump convention.
- **Single-file flat script.js layout.** Utanomori's per-system module split stays.
- **Keeping rejected experiments as commented-out code.** A course habit for teaching;
  delete dead code in this repo (memory files already record removed features — e.g.
  the effects batch — so history isn't lost).
- **`hash === '#debug'` gating** — keep the existing Leva setup and its section scheme.
- **Restructuring things the course has no equivalent for**: the loading-shell
  three-free entry chunk, audio loading tiers, theme-mask transition system,
  see-through buffer, one-cameraRig-owner-per-phase invariant, fixed FOV. These are
  Utanomori inventions that outrank course patterns; the refactor styles their
  *surface* (names, comments, ordering), never their shape.
- **Allman-brace / spaced-negative reformat sweeps** across generated or third-party
  code, or across files not otherwise touched — style follows the file you're in;
  converge opportunistically.

**folio-2025 additions to the do-not-adopt list:**

- **TSL node-material mechanisms** (`Fn`, `positionNode`/`outputNode` slotting,
  `.toVar()`/`.mulAssign()`, TempNode passes, `RenderPipeline` post chaining) —
  Utanomori is GLSL ShaderMaterial; port the *topology* (one owner per uniform, shared
  chunk builders, capability flags) as GLSL chunk strings + `#define` injection, never
  the mechanism.
- **`setAnimationLoop`-driven ticking / a hand-rolled Ticker** — R3F owns the loop;
  express ordering via `useFrame` priorities instead.
- **Howler as the audio backend** — folio's Howler works for its needs, but Utanomori's
  sample-synced 6-layer gapless backing loops *require* Web Audio (Howler cannot do
  that sync). Keep Web Audio; port only the engine/content split and item metadata
  model (§7b).
- **Production's tolerance for commented-out dead code and shipped typos** — folio
  keeps its scars; the cleanup branch's purpose is the opposite. Delete dead code.
- **Manual DOM state machines for UI chrome** — folio's `.js-*` hooks +
  `transitionend` choreography solve a no-framework problem; React owns Utanomori's
  DOM. Port the *state-machine discipline* (static phase constants, guard clauses),
  and optionally the html-class broadcast (`is-audio-muted`) for CSS-reactive chrome.
- **The whole-game 2x time scale / monkey-patching three** (`Object3D.prototype.copy`
  override) — folio-specific pragmatics with no Utanomori problem to solve.

### Personal signature — ours by deliberate choice

Rule (owner-stated): where folio's structure and ours are EQUALLY meaningful, simple and
readable, and the course lessons prescribe neither — keep ours. These are the project's
signature; do not "folio-ify" them during the refactor:

1. **Render-free singleton modules with named exports** for cross-component per-frame
   state (`cameraRig`, `seeThrough`, `themeMask`, `loaderInteraction`, `joystickInput`,
   `trampleField`, `revealCircle`, …) — flat `export const state = {...}` + exported
   functions, imported where needed. Folio's equivalent is class instances reached via
   `Game.getInstance()` and `this.x = {}` namespace-closures; the lessons put everything
   in zustand. Ours reads equally well, fits R3F's import graph, and skips the locator.
2. **create/update function pairs for materials** —
   `createXxxMaterial(texture, options)` + `updateXxxMaterial(material, options)` module
   pairs, with the per-frame updater taking ONE options object assembled in `useFrame`.
   Folio uses material classes + a registry; the lessons build materials inline. Equal
   clarity; ours keeps materials framework-free and testable.
3. **Shared-uniform objects spread into material uniform maps**
   (`...themeMaskUniforms`, `...edgeUniforms`, `...screenPainteryUniforms`) with ONE
   per-frame writer — folio reaches the same one-owner topology through system classes;
   the *spread-shared-`{ value }`-objects mechanism* is ours. Keep it, and keep using it
   for new shared state.
4. **`DEFAULT_*` parameterDefaults + versioned store groups + HMR merge** — folio uses
   `data/` modules read by classes; lessons use `debugObject`. Ours is the most
   disciplined of the three (single source of truth + version-bump convention). Keep.
5. **Rationale-rich comment voice** — our comments state WHY (design decisions,
   rejected alternatives, invariants), where both Bruno registers stay terse and
   what-oriented. Adopt the lesson banner FORMAT for sectioning; keep our rationale
   depth inside sections. This is the project's voice for students reading along.
6. **Implicit frame order + explicit documented gates** — registration order plus
   named warm-up gates (the placed-gate pattern) instead of folio's numeric priority
   buckets. Both are legitimate answers to the same problem; ours is already proven in
   this codebase and is less machinery. (Hence the downgrade in the adopt list above.)

---

## 7. Production reference — folio-2025

What Bruno-style code looks like at ~30k lines of shipped production (his 2025
portfolio: vanilla three.js WebGPU/TSL, Rapier, Howler, Tweakpane). This section is
*reference*, not mandate — the same framing as the rest of the guide applies:
Utanomori keeps its own architecture where better, and R3F-layer conventions come from
the R3F lessons (§1), NOT from this vanilla codebase. Read §7d before copying anything.

### 7a. Architecture at scale

- **One god object, flat systems.** A `Game` service-locator singleton
  (`Game.getInstance()` as the first line of every constructor; instance guard in the
  ctor). Entry file is 12 lines. All wiring lives in one flat async `init()`: ~25
  services assigned in dependency order across three explicit phases — intro-critical
  services + a tiny first resource batch; world construction while
  `Promise.all([bigResourceBatch, dynamicRapierImport])` streams (progress callback
  drives the loader bar); gameplay services after the await. Services take no
  constructor args; they pull everything off `this.game`.
- **Structure is FLAT**: ~60 sibling files under `Game/` with only a few folders
  (World, Physics, Inputs, Materials, Passes, Cycles, utilities). The course's neat
  Utils/World split loosened; one class per file held.
- **Composition over inheritance for events**: nothing extends an emitter anymore;
  services own `this.events = new Events()` (64-line custom pub/sub). The emitter
  gained a numeric **order bucket** (`on(name, cb, order)`) and dropped the course's
  event namespaces.
- **The renderer drives the ticker** (`renderer.setAnimationLoop(t =>
  ticker.update(t))`); the Ticker clamps delta (`maxDelta = 1/30`), keeps a 30-sample
  average, mirrors elapsed/delta into shared shader uniforms once per frame, runs a
  frame-countdown `wait(frames, cb)` queue, then triggers `'tick'`. Every system
  subscribes with an explicit priority: 0 (time) … 1 (player pre-physics) … physics …
  6 (player post) … 9–10 (world systems, uniform writes) … 13–14 (instancing, map,
  audio) … **998 (render — a sentinel guaranteeing last)**. Frame order is data, not
  code.
- **World.js is pure composition** — a constructor plus `step(0|1|2)` instantiating
  content in loading tiers, so progressive loading is encoded *structurally*, not with
  flags. (The R3F mirror: keep composer components logic-free, like §1.1 already says.)
- **Cross-cutting managers**: a `ClosingManager` owns the *entire* Escape/close
  priority cascade as one if/else chain over static state enums — central arbitration
  beats scattered handlers (same philosophy as Utanomori's one-cameraRig-owner-per-
  phase invariant). A `Cycles` keyframe base class interpolates named preset objects
  (numbers lerp, Colors lerpColors) with a gsap-tweened `override.start/end(strength)`
  layer for temporary event takeovers — the closest production analogue to Utanomori's
  theme system; it solves *structurally* the same invariant our
  `captureThemeSnapshot` memory states ("every themed value flows through one
  interpolator or it snaps").
- **Quality is a service** (binary level, UA-sniffed) broadcasting `'change'`;
  consumers rebuild their expensive bits (post-chain swap) on the event rather than
  polling a flag per frame. Viewport emits both `'change'` (immediate) and
  `'throttleChange'` (400 ms settled) so cheap and expensive consumers subscribe to
  different granularities.
- **Data-driven content from Blender**: node-name prefixes and `userData` drive
  physics colliders, area instantiation, respawn points, spline paths; models split
  systematically into `*VisualModel` / `*ReferencesModel` / `*PhysicalModel` GLBs.
- Lifecycle reality: constructors do everything; `destroy()` exists only where a phase
  actually ends (intro objects destroy themselves, null their game reference, and
  unsubscribe their own tick).

### 7b. Audio structure (the production answer)

Folio's `Audio.js` is 769 lines: one class = engine + content, with a crisp internal
split. **This is the model for Utanomori's audio modules** (which already gesture at
most of it):

- **Engine vs content**: ENGINE = `register(options)`, a `groups` Map, one per-frame
  `update()`, `setMute()`. CONTENT = `setPlaylist()` / `setAmbiants()` / `setOneOffs()`
  which are just lists of `register()` calls. Consumers fire sounds by group name with
  zero imports: `audio.groups.get('click').play(true)`.
- **Logical vs actual volume — the key idea**: gameplay code and gsap fades write only
  the item's *logical* `volume`; the engine's single `update()` derives the real
  backend volume each frame (logical × distance fade × mute × time-scale rate). Tweens
  never touch the Howl directly, so fade tweens and spatial attenuation can never
  fight. *"Content owns the intent; the engine owns the node."* This formalizes what
  ambientSounds.js ducking + MusicController distance logic already half-do.
- **`register(options)` items carry their behavior**: `positions` (LIVE Vector3
  references into world objects, not copied coords), `distanceFade` radius, `rate`,
  `antiSpam` (min seconds between plays, enforced *inside* `play()` — no consumer
  debouncing), `onPlay(item, ...args)` for per-trigger randomization (volume/rate
  jitter; extra `play()` args flow in — physics passes `(force, position)`, mapped to
  volume), `onPlaying(item)` for per-frame automation driven by game state.
- **Variation pools**: groups get round-robin `play()` and never-repeat
  `playRandomNext()` (index delta `1 + floor(random * (n - 2))`) — a 5-line fix for
  machine-gun repetition; directly applicable to the owl pool, footsteps, mumbles.
- **Cheap spatialization**: closest of `item.positions` → camera space → normalize →
  `z *= 0.1` → stereo pan; `distanceFadeMultiplier = remapClamp(dist, 0, fade, 1, 0)`.
  And `mute(volume < 0.01)` on inaudible sources to save voices.
- **Autoplay policy**: an `initiated` flag; `register` suppresses autoplay until the
  deferred `init()` (called on first user gesture) replays everything queued.
- **Never block startup on music**: playlist songs use `preload: false, pool: 0` and
  lazy `.load()` on first play. Utanomori's audio tiers (cicadas block GO, rest
  streams) are *more* structured than folio's — production validates the instinct;
  **keep the tiers**.
- **Mute pattern** (adopt wholesale for the sound on/off button): persisted toggle in
  localStorage + window blur/focus auto-mute + an `is-audio-muted` class on `<html>`
  so CSS reacts without state + a `'muteChange'` event + a keyboard action.
- Ambient scheduling: recursive `gsap.delayedCall(30 + random * 60, tryPlay)` loops
  gated on day-cycle intervals (owl at night only), positioned ±30 units around the
  camera focus. Crossfades are gsap tweens on the *logical* volume with
  `overwrite: true` (folio passes `overwrite: true` on every tween — do the same).
- **Backend caveat**: folio uses Howler; Utanomori's sample-synced 6-layer gapless
  backing loops require Web Audio — keep Web Audio, port the shapes above.

### 7c. Debug / quality / ops patterns

- Tweakpane replaced lil-gui; still hash-gated (`#debug`), still colocated per class
  behind `if(debug.active)`, folders collapsed, emoji-titled. Reusable helpers live on
  the Debug service: SRGB-correct color bindings, `addManualBinding` (auto/manual
  override for code-driven values), button grids, readonly `renderer.info` monitors
  behind `#stats`. See §5.3 for what to port to Leva.
- **Feature flags two ways**: build-time `import.meta.env.VITE_*` (compressed assets,
  spawn override, cycle progress) and runtime URL-hash matches (`#debug`, `#skip`,
  `#inspector`).
- **Warm-up**: a one-shot `PreRenderer` renders the whole scene into a 32px cube RT
  with everything forced visible (opt-out via `userData.preventPreRender`) to compile
  every pipeline behind the loader — R3F equivalent: warm-up frames / preload during
  the existing loader phase.
- **Pre-baked noise**: perlin/voronoi/hash rendered once at startup into tiny
  repeat-wrapped render targets (128px, HalfFloat, RedFormat where single-channel);
  runtime shaders sample textures instead of computing noise per-fragment. For
  Utanomori: bake to DataTexture/FBO — and note this *texture* LUT is the SAFE variant
  of what the Metal/ANGLE memory warns about (the danger was dynamically-indexed local
  arrays).
- **Deterministic draw order**: `sortObjects = false` + explicit `renderOrder`
  comparator sorts — no per-frame sort surprises in an art-directed stylized scene.
- **Cheap throttling without timers**: gate expensive per-frame work on
  rounded-position *change* (distance tests, DOM marker writes only when
  `Math.round(position)` changes).
- **Asset pipeline is scripted** (`scripts/compress.js`, ~146 lines): gltf-transform
  draco+ktx2 chains, a toktx regex-preset table choosing etc1s vs uastc / srgb vs
  linear / channel swizzles per texture name, sharp→webp for UI. Worth copying nearly
  verbatim for deploy prep.
- **One canonical material**: a single `MeshDefaultMaterial` implementing the whole
  custom lighting model, composed from `has*` capability flags gating feature blocks
  at build time — each variant compiles only what it needs. Plus a material *registry*
  keyed by Blender-authored material names (`getFromName` cache + `updateObject(mesh)`
  traversal converting imported GLTF materials, exceptions by name). GLSL translation:
  one shared ShaderMaterial factory with `#define` injection / template assembly, not
  N hand-copied shaders — a fit for Utanomori's terrain/props/grass all needing
  theme-mask + see-through + fog.

### 7d. What does NOT transfer (vanilla + TSL specifics)

- **`Game.getInstance()` for scene code.** The singleton is a vanilla necessity, not a
  style; R3F context/hooks + zustand are Utanomori's two blessed channels. Engine
  modules may stay module-scope singletons (audio already is).
- **TSL node composition** — `Fn(([x]) => ...)`, `.toVar()`, `outputNode` slotting,
  the `receivedShadowNode` shadow-catcher hack, TempNode pass classes, `RenderPipeline`
  chaining, typed `setLayout` functions. No GLSL analogue; the equivalents are chunk
  strings, `#define`s, shared uniform objects, `onBeforeCompile`.
- **`setAnimationLoop` → hand-rolled Ticker.** R3F owns the loop; the transferable
  *concepts* are priorities (`useFrame(cb, priority)`), one-place uniform mirroring,
  delta clamping, and `wait(frames, cb)` — not the mechanism.
- **Howler** (see §7b backend caveat) and **msgpack-WebSocket server plumbing** — no
  Utanomori equivalent needed.
- **Manual DOM UI** (`.js-*` hooks, `transitionend` machines, pre-authored index.html
  chrome) — React owns the DOM; port only the state-machine discipline and the
  html-class broadcast trick.
- **Production's hygiene tolerances** — commented dead code, shipped filename typos,
  un-normalized legacy styles across years of files. The cleanup branch holds the
  stricter line.
- Vanilla `new X()` world composition — replaced by JSX component trees; keep
  composers thin (§1.1) and push logic into plain-JS classes/hooks, which is where all
  of §7's class discipline actually lands.
