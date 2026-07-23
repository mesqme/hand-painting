/**
 * Colors
 */
export const COLORS = {
    background: '#d6d4d1',
    ink: '#3b3a38',
    inkSoft: '#57544f',
    accent: '#e78a2e',
    seam: '#d94a2f',
    wire: '#514f4b',
    card: '#f4f2ef',
}

/**
 * Scroll layout
 */
export const LAYOUT = {
    sections: 10,
    sectionVh: 170,
}

// One scroll unit === one section height; the master timeline is authored in these units.
export const SCROLL_END = LAYOUT.sections

/**
 * World layout
 *
 * The presentation keeps one consistent stage: the model works in the CENTER,
 * texture sheets can dock left or right depending on the workflow beat, and
 * scene-preview windows shift the stage.
 */
export const WORLD = {
    heroLeftX: - 2.05,
    sheetX: 2.35,
    bakeSheetX: - 2.25,
    paintSheetX: 0,
    paintHeroX: 1.95,
    paletteY: 0.08,
    paletteSize: 1.7,
    assemblyHeight: 2.6,

    // Scene-preview windows
    testFrameX: - 0.55,
    artistFrameX: - 0.2,
    zooFrameX: 0.7,
}

/**
 * The window scene — a 45° "level view"   ← SCENE-PREVIEW ORIENTATION LIVES HERE
 *
 * How the scene-preview objects stand on the ground and are viewed at 45°:
 *   - one camera serves the whole page, so instead of a second camera the whole
 *     scene is tilted by (pitch, yaw) — reads exactly like a camera at ~(7,7,7);
 *   - objects stay UPRIGHT (their own +Y), placed on the pre-tilt XZ plane at
 *     ISO_SLOTS positions, so their feet all rest on one invisible ground plane
 *     and columns render vertical on screen (see isoPoint / isoSlotOffset below);
 *   - `standHeight` lifts each assembly so its base (geometry bottom at -1.3 in
 *     the normalised space from usePairs.jsx) sits exactly on that plane.
 *
 * Applied to the hero in choreography.js (heroIso) + DuckColumnAssembly.jsx, and
 * to the crew in Crew.jsx. Tweak pitch/yaw here to change the whole level view.
 *
 * NOTE: this only reads right when the GLB geometry is upright (no baked node
 * rotation). The pairs.glb columns are; a tilted export would lean.
 */
export const ISO = {
    pitch: 0.6155,   // atan(1 / sqrt(2)) — the classic isometric elevation
    yaw: Math.PI / 4,
    centerY: - 0.35, // raises the four standing assemblies inside the window
    scale: 0.5,
    standHeight: 1.3 * 0.5,  // assembly bottom sits at -1.3 · scale
}

// Even grid, no overlaps: front-left, front-right (HERO), back-left, back-right
export const ISO_SLOTS = [
    [ - 0.8, 0.8 ],
    [ 0.8, 0.8 ],
    [ - 0.8, - 0.8 ],
    [ 0.8, - 0.8 ],
]

export const HERO_SLOT = 1

// Act 07 — the texture atlas docks on the right while the crew stays in the
// scene window; the four sheets fly from the models onto these quadrants
export const ATLAS_X = 2.1

/**
 * Rotates an iso-local point (x, y, z) into world space: Rx(pitch) · Ry(yaw)
 */
export function isoPoint(x, y, z)
{
    const cy = Math.cos(ISO.yaw)
    const sy = Math.sin(ISO.yaw)
    const cx = Math.cos(ISO.pitch)
    const sx = Math.sin(ISO.pitch)

    const x1 = x * cy + z * sy
    const z1 = - x * sy + z * cy

    return {
        x: x1,
        y: y * cx - z1 * sx,
        z: y * sx + z1 * cx,
    }
}

/**
 * World offset (from the window center) of a crew slot's assembly center
 */
export function isoSlotOffset(slotIndex)
{
    const [ sx, sz ] = ISO_SLOTS[slotIndex]
    const p = isoPoint(sx, ISO.standHeight, sz)
    return { x: p.x, y: ISO.centerY + p.y, z: p.z }
}

/**
 * Copy deck
 */
export const STEPS = [
    {
        id: 'intro',
        at: 0,
        title: 'Hand-Painting\nfor Three.js',
        body: 'A production texturing pipeline',
        side: 'right',
        hero: true,
    },
    {
        id: 'model',
        at: 0.28,
        kicker: '01 · Create the model',
        body: 'Create balanced geometry with clean topology and enough resolution for the asset. The model must be easy to unwrap and edit.',
        side: 'right',
    },
    {
        id: 'palette',
        at: 1.12,
        kicker: '02 · Gradient palette',
        body: 'Place each part of the model on a shared gradient palette. Geometry and colors remain editable before anything is baked.',
        side: 'left',
    },
    {
        id: 'scene',
        at: 2.72,
        kicker: '03 · Test in the scene',
        body: 'Check the asset inside the scene next to the other objects. Review its scale, silhouette and palette balance.',
        side: 'right',
    },
    {
        id: 'bake',
        at: 3.74,
        kicker: '04 · Bake',
        body: 'Turn the model into wireframe, create seams, inspect the UV islands, and bake the gradient colors into the final UV layout.',
        hint: 'Drag the model to inspect the seams. It snaps back when released.',
        side: 'right',
    },
    {
        id: 'paint',
        at: 5.62,
        kicker: '05 · Hand paint',
        body: 'The baked texture becomes the main working file. The artist repaints it in Photoshop and checks the result on the model.',
        side: 'left',
    },
    {
        id: 'artist',
        at: 6.48,
        kicker: '06 · Live updates',
        body: 'Open the texture list and compare the painted options directly in the scene: base, pastel, red, then aberration.',
        hint: 'You can also choose an option yourself or drop any PNG.',
        side: 'left',
    },
    {
        id: 'atlas',
        at: 7.84,
        kicker: '07 · Combine',
        body: 'Show each painted texture over its matching object, then move the four square textures into one combined atlas.',
        side: 'left',
    },
    {
        id: 'ktx',
        at: 8.68,
        kicker: '08 · Compress',
        body: 'Compress the combined atlas to KTX2 while keeping the result visible inside the scene.',
        side: 'left',
    },
    {
        id: 'batch',
        at: 9.28,
        kicker: '09 · Batched mesh',
        body: 'Reuse the batch color attribute as compact per-instance data. R identifies geometry and G identifies the texture variant.',
        hint: 'B and A remain available for animation, interaction and object state.',
        side: 'left',
    },
]
