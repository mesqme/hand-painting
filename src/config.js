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

// One scroll unit === one section height; the master timeline is authored in these units
export const SCROLL_UNIT = LAYOUT.sectionVh / 100
export const SCROLL_END = (LAYOUT.sections * SCROLL_UNIT - 1) / SCROLL_UNIT

/**
 * World layout
 *
 * The presentation keeps one consistent stage: the model works in the CENTER,
 * texture sheets dock far RIGHT (clear of the model), scene-preview windows
 * shift the stage.
 */
export const WORLD = {
    heroLeftX: - 2.05,
    sheetX: 2.35,
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
 *     the normalised space from useDuckColumn.jsx) sits exactly on that plane.
 *
 * Applied to the hero in choreography.js (heroIso) + DuckColumnAssembly.jsx, and
 * to the crew in Crew.jsx. Tweak pitch/yaw here to change the whole level view.
 *
 * NOTE: this only reads right when the GLB geometry is upright (no baked node
 * rotation). The optimised duckColumn.glb is; a tilted export would lean.
 */
export const ISO = {
    pitch: 0.6155,   // atan(1 / sqrt(2)) — the classic isometric elevation
    yaw: Math.PI / 4,
    centerY: - 0.35, // scene raised so the grid's front corner clears the window bottom
    scale: 0.5,
    standHeight: 1.3 * 0.5,  // assembly bottom sits at -1.3 · scale
}

// Full (uncut) floor grid half-extent on the iso XZ plane — sized so the whole
// square, front corner included, projects inside the scene window at every
// aspect (see verify-geometry). No chamfering: the ground reads complete.
export const ISO_GRID_EXTENT = 1.2
export const ISO_GRID_STEP = 0.4

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
export const ATLAS_X = 2.35

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
        title: 'Hand-Painting\nfor Three.js',
        body: 'A production texture pipeline.',
        side: 'right',
        hero: true,
    },
    {
        id: 'model',
        kicker: '01 · Create the model',
        body: 'Model the asset with clean, even topology that unwraps easily. High-poly or low-poly — what matters is that it is ready to texture.',
        side: 'right',
    },
    {
        id: 'palette',
        kicker: '02 · Gradient palette',
        body: 'Unwrap the model and lay every part on a shared gradient palette. This colors the model without baking anything, so geometry and colors stay editable.',
        side: 'left',
    },
    {
        id: 'scene',
        kicker: '03 · Test in the scene',
        body: 'Drop the gradient-mapped asset into the running scene next to its siblings and check scale, layout and palette balance early.',
        side: 'right',
    },
    {
        id: 'bake',
        kicker: '04 · Bake',
        body: 'Cut seams, unwrap into real UV islands, and bake the gradient down onto that layout — one texture per asset.',
        side: 'left',
        // The bake sweep + skin return play late in the section — keep the card up for them
        cardOut: 0.85,
    },
    {
        id: 'paint',
        kicker: '05 · Hand paint',
        body: 'Send the baked texture to the artist. They repaint it in Photoshop and the model wears the result.',
        side: 'left',
    },
    {
        id: 'artist',
        kicker: '06 · Live updates',
        body: 'The artist gets a link to the running scene. Pick a repainted texture from the dropdown next to the model and it updates instantly, in context, next to its neighbours.',
        hint: 'This part is real — pick a texture from the dropdown, or drop any PNG.',
        side: 'right',
    },
    {
        id: 'atlas',
        kicker: '07 · Combine',
        body: 'Pack the finished textures into one atlas, so the whole set ships as a single sheet and material.',
        side: 'left',
    },
    {
        id: 'ktx',
        kicker: '08 · Compress',
        body: 'Transcode the atlas to KTX2 — GPU-native, mipmapped, and a fraction of the size. One script per platform.',
        side: 'left',
        terminal: [
            '$ gltf-transform uastc scene.glb scene.ktx2.glb',
            '      --level 4 --rdo 4 --zstd 18',
            '',
            '$ toktx --t2 --uastc 4 --genmipmap',
            '      atlas.ktx2 atlas.png',
            '',
            'atlas.png  16.8 MB  →  atlas.ktx2  2.1 MB',
        ],
    },
    {
        id: 'batch',
        kicker: '09 · Batch',
        body: 'Different geometry, different paint, one atlas and one material — merged into a single draw call.',
        side: 'left',
    },
]
