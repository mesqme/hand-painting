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
    sections: 9,
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
 * The window scene — a 45° "level view"
 *
 * One camera serves the whole page, so the window acts tilt the SCENE instead:
 * a group rotated (pitch, yaw) reads exactly like a camera at ~(7,7,7). Four
 * assemblies stand on an even XZ grid; the hero is always crew slot 1.
 */
export const ISO = {
    pitch: 0.6155,   // atan(1 / sqrt(2)) — the classic isometric elevation
    yaw: Math.PI / 4,
    centerY: - 0.72,
    scale: 0.55,
    standHeight: 1.3 * 0.55,  // assembly bottom sits at -1.3 · scale
}

// Even grid, no overlaps: front-left, front-right (HERO), back-left, back-right
export const ISO_SLOTS = [
    [ - 0.85, 0.85 ],
    [ 0.85, 0.85 ],
    [ - 0.85, - 0.85 ],
    [ 0.85, - 0.85 ],
]

// Act 07 line-up: the crew leaves the window and forms this frontal row
export const ROW_X = [ - 2.7, - 0.9, 0.9, 2.7 ]
export const ROW_Y = 0.3
export const ROW_SCALE = 0.5
export const HERO_SLOT = 1

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
        id: 'model',
        kicker: '01 · Create the model',
        title: 'Geometry that wants to be painted',
        body: 'Every asset starts as balanced geometry — high-poly or low-poly, whatever the shot needs. What matters is topology that unwraps without a fight: even quads, sensible loops, no stretched corners.',
        side: 'right',
        hero: true,
    },
    {
        id: 'palette',
        kicker: '02 · Gradient palette',
        title: 'Color becomes a lookup',
        body: 'The model is UV-unwrapped at full scale and every part is parked on a strip of one shared gradient palette. Nothing is baked yet — geometry and palette colors stay editable the whole time.',
        side: 'left',
    },
    {
        id: 'scene',
        kicker: '03 · Test in the scene',
        title: 'Into the level, early',
        body: 'The gradient-mapped asset drops into the running scene next to its siblings. Layout, readability and palette balance get checked while everything is still cheap to change.',
        side: 'right',
    },
    {
        id: 'bake',
        kicker: '04 · Bake',
        title: 'Cut, unwrap, bake it down',
        body: 'Seams are cut along the model and the surface unfolds into real UV islands. The gradient look bakes down onto the new layout — one texture that captures the palette exactly as the scene saw it.',
        side: 'left',
        // The bake sweep + skin return play late in the section — keep the card up for them
        cardOut: 0.85,
    },
    {
        id: 'paint',
        kicker: '05 · Hand paint',
        title: 'Repainted in Photoshop',
        body: 'The baked sheet goes to the artist. In Photoshop every gradient strip becomes brushwork — and when the file comes back, the texture and the model wear it together.',
        side: 'left',
    },
    {
        id: 'artist',
        kicker: '06 · Live loop',
        title: 'Drop it into the running scene',
        body: 'The artist gets a link to the running scene with an upload overlay. Drag a repainted file in — the model updates instantly, in context, next to its neighbours. Correct, save, drop again.',
        hint: 'This part is real — drag a swatch into the scene, or drop any PNG.',
        side: 'right',
    },
    {
        id: 'atlas',
        kicker: '07 · Combine',
        title: 'Four sheets, one atlas',
        body: 'Painted textures come back one per asset. Past sixteen textures the renderer gets grumpy, so before shipping they are packed into a single atlas — one sheet, one material.',
        side: 'left',
    },
    {
        id: 'ktx',
        kicker: '08 · Compress',
        title: 'PNG out, KTX2 in',
        body: 'The atlas is transcoded to KTX2 — GPU-native, mip-mapped, a fraction of the size. One script covers every platform.',
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
        title: 'One draw call',
        body: 'Different geometry, different paint — same atlas, same material. The whole shelf is merged into a single BatchedMesh and rendered in one draw call.',
        side: 'left',
    },
]
