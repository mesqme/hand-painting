/**
 * Colors
 */
export const COLORS = {
    background: '#d6d4d1',
    ink: '#3b3a38',
    inkSoft: '#57544f',
    accent: '#e78a2e',
    wire: '#514f4b',
    card: '#f4f2ef',
}

/**
 * Scroll layout
 */
export const LAYOUT = {
    sections: 8,
    sectionVh: 170,
}

// One scroll unit === one section height; the master timeline is authored in these units
export const SCROLL_UNIT = LAYOUT.sectionVh / 100
export const SCROLL_END = (LAYOUT.sections * SCROLL_UNIT - 1) / SCROLL_UNIT

/**
 * World layout
 */
export const WORLD = {
    heroLeftX: - 2.05,
    heroRightX: 2.05,
    bakeHeroX: - 2.05,
    paletteStepX: - 0.55,
    paletteBakeX: 1.45,
    paletteY: 0.08,
    paletteSize: 1.7,
    assemblyHeight: 2.6,
}

/**
 * Copy deck
 */
export const STEPS = [
    {
        id: 'model',
        kicker: '01 · Create the model',
        title: 'Silhouette first, color later',
        body: 'Every asset starts as light, low-poly geometry. The duck and its column go straight into the scene — scale and silhouette are judged before a single color exists.',
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
        side: 'bottom',
    },
    {
        id: 'bake',
        kicker: '04 · Bake',
        title: 'From lookup to texture',
        body: 'The model is duplicated, seams are cut, and a clean 0–1 unwrap is laid out. The gradient version bakes down onto it — one texture that captures the palette exactly as the scene saw it.',
        side: 'center',
    },
    {
        id: 'paint',
        kicker: '05 · Hand paint',
        title: 'The artist paints live',
        body: 'The baked file goes to the artist with a live link. Repaint in Photoshop, drop the file on the page, see it on the mesh instantly — no exports, no rebuilds.',
        hint: 'Try it — drag a swatch onto the duck, or drop any PNG on the page.',
        side: 'left',
    },
    {
        id: 'atlas',
        kicker: '06 · Combine',
        title: 'Four sheets, one atlas',
        body: 'Painted textures come back one per asset. Past sixteen textures the renderer gets grumpy, so before shipping they are packed into a single atlas — one sheet, one material.',
        side: 'left',
    },
    {
        id: 'ktx',
        kicker: '07 · Compress',
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
        kicker: '08 · Batch',
        title: 'One draw call',
        body: 'Different geometry, different paint — same atlas, same material. The whole shelf is merged into a single BatchedMesh and rendered in one draw call.',
        side: 'left',
    },
]
