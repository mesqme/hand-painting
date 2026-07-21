import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

import { WORLD, SCROLL_END, ISO, isoSlotOffset, HERO_SLOT, ROW_X, ROW_Y, ROW_SCALE } from '../config.js'

/**
 * Animated params
 *
 * Single source of truth for the 3D choreography. The master timeline below is
 * scrubbed by scroll and writes ONLY into this object; world components read it
 * per frame and push values onto objects/uniforms (never through React state).
 * Timeline positions are authored in scroll units: 1 unit === 1 section height.
 *
 * Stage grammar: the model works in the CENTER, sheets dock far RIGHT, and the
 * window acts (03/06/09) tilt into a 45° level view where the same four-piece
 * crew stands on an even grid — the hero is always crew slot 1. Acts:
 * 01 model · 02 palette · 03 test scene · 04 bake · 05 hand paint ·
 * 06 artist live loop · 07 combine · 08 compress · 09 batch
 */
export const params = {
    // Hero assembly
    heroX: WORLD.heroLeftX,
    heroY: 0,
    heroZ: 0,
    heroScale: 1,
    heroOpacity: 1,
    heroRotX: 0,
    heroRotY: 0,
    heroStanding: 0,
    whiteMix: 1,
    wireOpacity: 0.28,
    reveal: 0,
    heroSurface: 1,

    // Palette / texture sheet (right dock)
    paletteX: WORLD.sheetX,
    paletteOpacity: 0,
    uvLines: 0,
    uvProgress: 0,
    sheetPaint: 0,
    sheetWire: 0,

    // Bake
    seamOpacity: 0,
    seamWidth: 1.5,
    bakeSweep: 0,
    bakeSheetClear: 0,

    // Crew (the three non-hero members + floor grid, acts 03/06/07/09)
    crewVisible: 0,
    crewPaint: 0,
    crewRow: 0,
    crewSurface: 1,
    crewWire: 0,
    batchTexApply: 0,

    // Artist live loop
    artistDragA: 0,
    artistWipeA: 0,
    artistDragB: 0,
    artistWipeB: 0,

    // Atlas sheets / KTX chip
    sheetsIn: 0,
    atlasFly: 0,
    atlasChip: 0,
    chipToCrew: 0,

    // Scene-preview window
    frameOpacity: 0,
    frameX: WORLD.testFrameX,
}

/**
 * Hero targets for the window acts (crew slot 1) and the act-07 row
 */
const heroIso = (frameX) =>
{
    const offset = isoSlotOffset(HERO_SLOT)
    return {
        heroX: frameX + offset.x,
        heroY: offset.y,
        heroZ: offset.z,
        heroRotX: ISO.pitch,
        heroRotY: ISO.yaw,
        heroScale: ISO.scale,
    }
}

const heroRow = {
    heroX: ROW_X[HERO_SLOT],
    heroY: ROW_Y,
    heroZ: 0,
    heroRotX: 0,
    heroRotY: - 0.15,
    heroScale: ROW_SCALE,
}

const heroCenter = { heroX: 0, heroY: 0, heroZ: 0, heroRotX: 0, heroRotY: 0, heroScale: 1 }

/**
 * Master timeline
 */
export function buildChoreography()
{
    gsap.registerPlugin(ScrollTrigger)

    const tl = gsap.timeline({
        defaults: { ease: 'power2.inOut' },
        scrollTrigger: {
            trigger: '.page',
            start: 'top top',
            end: 'bottom bottom',
            scrub: 0.6,
        },
    })

    /**
     * 01 → 02 — the very first scroll already moves: model to center stage,
     * a small left turn (front view kept), clay turns gradient, sheet in
     */
    tl.to(params, { heroX: 0, duration: 0.45 }, 0.1)
    tl.to(params, { heroRotY: - 0.5, duration: 0.45 }, 0.1)
    tl.to(params, { whiteMix: 0, duration: 0.35 }, 0.2)
    tl.to(params, { wireOpacity: 0, duration: 0.3 }, 0.2)
    tl.to(params, { paletteOpacity: 1, duration: 0.3, ease: 'power2.out' }, 0.55)
    tl.to(params, { uvLines: 1, duration: 0.25 }, 0.7)

    /**
     * 02 — islands pack onto the palette, model colors resolve in lockstep
     */
    tl.to(params, { uvProgress: 1, duration: 0.6, ease: 'power1.inOut' }, 0.95)

    /**
     * 02 → 03 — into the level view: the hero takes its crew slot on the grid
     */
    tl.to(params, { uvLines: 0, duration: 0.2 }, 1.62)
    tl.to(params, { paletteOpacity: 0, duration: 0.22 }, 1.62)
    tl.to(params, { ...heroIso(WORLD.testFrameX), duration: 0.38 }, 1.66)
    tl.to(params, { heroStanding: 1, duration: 0.2 }, 1.75)
    tl.set(params, { frameX: WORLD.testFrameX, crewPaint: 0, crewRow: 0 }, 1.9)
    tl.to(params, { frameOpacity: 1, duration: 0.33, ease: 'power2.out' }, 1.92)
    tl.to(params, { crewVisible: 1, duration: 0.45, ease: 'power2.out' }, 1.98)

    /**
     * 03 → 04 — out of the window, model back to center stage for the bake
     */
    tl.to(params, { crewVisible: 0, duration: 0.25 }, 2.55)
    tl.to(params, { frameOpacity: 0, duration: 0.22 }, 2.56)
    tl.to(params, { heroStanding: 0, duration: 0.15 }, 2.58)
    tl.to(params, { ...heroCenter, duration: 0.35 }, 2.65)
    tl.to(params, { paletteOpacity: 1, duration: 0.25, ease: 'power2.out' }, 2.9)

    /**
     * 04 — seams appear and thicken, the model drops to wireframe, the sheet
     * clears and shows the unwrapped layout as wireframe too, then the bake
     * sweep wipes the baked skin back onto the model
     */
    tl.to(params, { seamOpacity: 1, duration: 0.14 }, 2.98)
    tl.to(params, { seamWidth: 4, duration: 0.16 }, 3.14)
    tl.to(params, { heroSurface: 0, duration: 0.12, ease: 'none' }, 3.34)
    tl.to(params, { wireOpacity: 0.3, duration: 0.12 }, 3.34)
    tl.to(params, { bakeSheetClear: 1, duration: 0.15 }, 3.3)
    tl.to(params, { sheetWire: 1, duration: 0.18 }, 3.42)
    tl.to(params, { bakeSweep: 1, duration: 0.2, ease: 'none' }, 3.64)
    tl.to(params, { heroSurface: 1, duration: 0.22, ease: 'power1.inOut' }, 3.66)
    tl.to(params, { seamOpacity: 0, duration: 0.15 }, 3.8)
    tl.to(params, { seamWidth: 1.5, duration: 0.15 }, 3.8)
    tl.to(params, { wireOpacity: 0, duration: 0.14 }, 3.86)
    tl.to(params, { sheetWire: 0, duration: 0.15 }, 3.9)
    tl.to(params, { bakeSheetClear: 0, duration: 0.15 }, 3.92)

    /**
     * 05 — nothing travels: the sheet wipes baked → painted and the model
     * wears the paint with it
     */
    tl.to(params, { sheetPaint: 1, duration: 0.4, ease: 'power1.inOut' }, 4.15)
    tl.to(params, { reveal: 1, duration: 0.4, ease: 'power1.inOut' }, 4.15)

    /**
     * 05 → 06 — the SAME level view returns (artist window): hero back on its
     * crew slot among the same, now painted, neighbours
     */
    tl.to(params, { paletteOpacity: 0, duration: 0.22 }, 4.62)
    tl.to(params, { ...heroIso(WORLD.artistFrameX), duration: 0.38 }, 4.66)
    tl.to(params, { heroStanding: 1, duration: 0.2 }, 4.75)
    tl.set(params, { frameX: WORLD.artistFrameX, crewPaint: 1, crewRow: 0 }, 4.6)
    tl.to(params, { frameOpacity: 1, duration: 0.3, ease: 'power2.out' }, 4.72)
    tl.to(params, { crewVisible: 1, duration: 0.4, ease: 'power2.out' }, 4.8)

    /**
     * 06 — scripted artist loop: two drag-and-drops, each repainting the model
     */
    tl.to(params, { artistDragA: 1, duration: 0.22, ease: 'power1.inOut' }, 4.98)
    tl.to(params, { artistWipeA: 1, duration: 0.25, ease: 'power2.inOut' }, 5.2)
    tl.to(params, { artistDragB: 1, duration: 0.22, ease: 'power1.inOut' }, 5.26)
    tl.to(params, { artistWipeB: 1, duration: 0.25, ease: 'power2.inOut' }, 5.48)

    /**
     * 06 → 07 — the window fades and the WHOLE crew glides out of the level
     * view into the frontal line-up, sheets appearing beneath
     */
    tl.to(params, { frameOpacity: 0, duration: 0.22 }, 5.75)
    tl.to(params, { heroStanding: 0, duration: 0.15 }, 5.75)
    tl.to(params, { crewRow: 1, duration: 0.38 }, 5.78)
    tl.to(params, { ...heroRow, duration: 0.36 }, 5.79)
    tl.to(params, { sheetsIn: 1, duration: 0.22, ease: 'power2.out' }, 6.15)

    /**
     * 07 — four sheets fly into one atlas
     */
    tl.to(params, { atlasFly: 1, duration: 0.45, ease: 'power2.inOut' }, 6.4)

    /**
     * 07 → 08 — crew away, atlas compresses into a KTX2 chip
     */
    tl.to(params, { crewVisible: 0, duration: 0.22 }, 6.9)
    tl.to(params, { heroOpacity: 0, duration: 0.2 }, 6.9)
    tl.to(params, { atlasChip: 1, duration: 0.35 }, 6.95)

    /**
     * 08 → 09 — back to the level view in WIREFRAME: the crew returns unlit,
     * the hero joins them, everything waits for its texture
     */
    tl.set(params, {
        crewRow: 0,
        crewPaint: 1,
        crewSurface: 0,
        crewWire: 0.3,
        heroSurface: 0,
        wireOpacity: 0.3,
        frameX: WORLD.zooFrameX,
        ...heroIso(WORLD.zooFrameX),
        heroStanding: 1,
    }, 7.5)
    tl.to(params, { frameOpacity: 1, duration: 0.35, ease: 'power2.out' }, 7.62)
    tl.to(params, { crewVisible: 1, duration: 0.3, ease: 'power2.out' }, 7.66)
    tl.to(params, { heroOpacity: 1, duration: 0.25 }, 7.7)

    /**
     * 09 — the combined KTX texture flies in and applies: every model wipes
     * from wireframe to its hand-painted skin and the crew comes alive
     */
    tl.to(params, { chipToCrew: 1, duration: 0.2, ease: 'power1.inOut' }, 7.95)
    tl.to(params, { batchTexApply: 1, duration: 0.25, ease: 'power1.inOut' }, 8.1)
    tl.to(params, { crewSurface: 1, duration: 0.25, ease: 'power1.inOut' }, 8.1)
    tl.to(params, { heroSurface: 1, duration: 0.2, ease: 'power1.inOut' }, 8.15)
    tl.to(params, { crewWire: 0, duration: 0.15 }, 8.22)
    tl.to(params, { wireOpacity: 0, duration: 0.15 }, 8.22)

    // Pin the timeline length to the exact scroll span so unit === section
    tl.set(params, { batchTexApply: 1 }, SCROLL_END)

    // Dev-only hook for automated checks
    if(import.meta.env.DEV)
    {
        window.__params = params
        window.__timeline = tl
    }

    return tl
}
