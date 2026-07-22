import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

import { WORLD, SCROLL_END, ISO, isoSlotOffset, HERO_SLOT } from '../config.js'

/**
 * Animated params
 *
 * Single source of truth for the 3D choreography. The master timeline below is
 * scrubbed by scroll and writes ONLY into this object; world components read it
 * per frame and push values onto objects/uniforms (never through React state).
 * Timeline positions are authored in scroll units: 1 unit === 1 section height.
 *
 * Stage grammar: the model works in the CENTER, sheets dock far RIGHT, and the
 * window acts tilt into a 45° level view where the same four-piece crew stands
 * on an even grid — the hero is always crew slot 1 and the crew never leaves
 * the window (act 07 flies the texture sheets off the models instead). Sections:
 * 00 intro (painted teaser) · 01 model · 02 palette · 03 test scene · 04 bake ·
 * 05 hand paint · 06 live updates · 07 combine · 08 compress · 09 batch
 *
 * The page opens on the FULLY PAINTED model (the finished result); the first
 * scroll strips it back to white clay + wireframe (section 01) and the pipeline
 * plays forward from there.
 */

// Center-stage acts tilt the model's top slightly toward the camera, so it
// reads as a 3/4 view rather than the flat head-on angle of an upright mesh.
const CENTER_TILT = 0.32
const CENTER_YAW = - 0.4

export const params = {
    // Hero assembly — starts PAINTED (the intro teaser)
    heroX: WORLD.heroLeftX,
    heroY: 0,
    heroZ: 0,
    heroScale: 1,
    heroOpacity: 1,
    heroRotX: CENTER_TILT,
    heroRotY: CENTER_YAW,
    heroStanding: 0,
    whiteMix: 0,
    wireOpacity: 0,
    reveal: 1,
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
    bakeSweep: 0,
    bakeSheetClear: 0,

    // Crew (the three non-hero members + floor grid, acts 03/06/07/09)
    crewVisible: 0,
    crewPaint: 0,
    crewSurface: 1,
    crewWire: 0,
    batchTexApply: 0,

    // Artist live loop (act 06 — the dropdown next to the model)
    dropdownIn: 0,
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
 * Hero targets for the window acts (crew slot 1)
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

const heroCenter = { heroX: 0, heroY: 0, heroZ: 0, heroRotX: CENTER_TILT, heroRotY: CENTER_YAW, heroScale: 1 }

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
     * 00 → 01 — the opening painted model reacts to the first scroll and is
     * stripped back to white clay + wireframe (the raw starting point)
     */
    tl.to(params, { whiteMix: 1, duration: 0.35 }, 0.05)
    tl.to(params, { wireOpacity: 0.28, duration: 0.3 }, 0.1)
    tl.to(params, { reveal: 0, duration: 0.25, ease: 'none' }, 0.3)

    /**
     * 01 → 02 — model to center stage, clay turns gradient, sheet in
     */
    tl.to(params, { heroX: 0, duration: 0.45 }, 1.1)
    tl.to(params, { whiteMix: 0, duration: 0.35 }, 1.2)
    tl.to(params, { wireOpacity: 0, duration: 0.3 }, 1.2)
    tl.to(params, { paletteOpacity: 1, duration: 0.3, ease: 'power2.out' }, 1.55)
    tl.to(params, { uvLines: 1, duration: 0.25 }, 1.7)

    /**
     * 02 — islands pack onto the palette, model colors resolve in lockstep
     */
    tl.to(params, { uvProgress: 1, duration: 0.6, ease: 'power1.inOut' }, 1.95)

    /**
     * 02 → 03 — into the level view: the hero takes its crew slot on the grid
     */
    tl.to(params, { uvLines: 0, duration: 0.2 }, 2.62)
    tl.to(params, { paletteOpacity: 0, duration: 0.22 }, 2.62)
    tl.to(params, { ...heroIso(WORLD.testFrameX), duration: 0.38 }, 2.66)
    tl.to(params, { heroStanding: 1, duration: 0.2 }, 2.75)
    tl.set(params, { frameX: WORLD.testFrameX, crewPaint: 0 }, 2.9)
    tl.to(params, { frameOpacity: 1, duration: 0.33, ease: 'power2.out' }, 2.92)
    tl.to(params, { crewVisible: 1, duration: 0.45, ease: 'power2.out' }, 2.98)

    /**
     * 03 → 04 — out of the window, model back to center stage for the bake
     */
    tl.to(params, { crewVisible: 0, duration: 0.25 }, 3.55)
    tl.to(params, { frameOpacity: 0, duration: 0.22 }, 3.56)
    tl.to(params, { heroStanding: 0, duration: 0.15 }, 3.58)
    tl.to(params, { ...heroCenter, duration: 0.35 }, 3.65)
    tl.to(params, { paletteOpacity: 1, duration: 0.25, ease: 'power2.out' }, 3.9)

    /**
     * 04 — the red seams appear (no thickening — the color alone reads), the
     * model drops to wireframe, the sheet clears and shows the unwrapped
     * layout as wireframe too, then the bake sweep wipes the baked skin back
     * onto the model
     */
    tl.to(params, { seamOpacity: 1, duration: 0.18 }, 3.98)
    tl.to(params, { heroSurface: 0, duration: 0.12, ease: 'none' }, 4.34)
    tl.to(params, { wireOpacity: 0.3, duration: 0.12 }, 4.34)
    tl.to(params, { bakeSheetClear: 1, duration: 0.15 }, 4.3)
    tl.to(params, { sheetWire: 1, duration: 0.18 }, 4.42)
    tl.to(params, { bakeSweep: 1, duration: 0.2, ease: 'none' }, 4.64)
    tl.to(params, { heroSurface: 1, duration: 0.22, ease: 'power1.inOut' }, 4.66)
    tl.to(params, { seamOpacity: 0, duration: 0.15 }, 4.8)
    tl.to(params, { wireOpacity: 0, duration: 0.14 }, 4.86)
    tl.to(params, { sheetWire: 0, duration: 0.15 }, 4.9)
    tl.to(params, { bakeSheetClear: 0, duration: 0.15 }, 4.92)

    /**
     * 05 — nothing travels: the sheet wipes baked → painted and the model
     * wears the paint with it
     */
    tl.to(params, { sheetPaint: 1, duration: 0.4, ease: 'power1.inOut' }, 5.15)
    tl.to(params, { reveal: 1, duration: 0.4, ease: 'power1.inOut' }, 5.15)

    /**
     * 05 → 06 — the SAME level view returns (artist window): hero back on its
     * crew slot among the same, now painted, neighbours
     */
    tl.to(params, { paletteOpacity: 0, duration: 0.22 }, 5.62)
    tl.to(params, { ...heroIso(WORLD.artistFrameX), duration: 0.38 }, 5.66)
    tl.to(params, { heroStanding: 1, duration: 0.2 }, 5.75)
    tl.set(params, { frameX: WORLD.artistFrameX, crewPaint: 1 }, 5.6)
    tl.to(params, { frameOpacity: 1, duration: 0.3, ease: 'power2.out' }, 5.72)
    tl.to(params, { crewVisible: 1, duration: 0.4, ease: 'power2.out' }, 5.8)

    /**
     * 06 — scripted artist loop: the texture dropdown next to the model opens,
     * an option is picked, the model repaints — twice
     */
    tl.to(params, { dropdownIn: 1, duration: 0.2, ease: 'power2.out' }, 5.88)
    tl.to(params, { artistDragA: 1, duration: 0.22, ease: 'power1.inOut' }, 5.98)
    tl.to(params, { artistWipeA: 1, duration: 0.25, ease: 'power2.inOut' }, 6.2)
    tl.to(params, { artistDragB: 1, duration: 0.22, ease: 'power1.inOut' }, 6.26)
    tl.to(params, { artistWipeB: 1, duration: 0.25, ease: 'power2.inOut' }, 6.48)
    tl.to(params, { dropdownIn: 0, duration: 0.18 }, 6.76)

    /**
     * 06 → 07 — nobody moves: the crew keeps its slots in the scene window and
     * each model's texture sheet appears UPON it
     */
    tl.to(params, { sheetsIn: 1, duration: 0.25, ease: 'power2.out' }, 7.12)

    /**
     * 07 — the four sheets fly off the models into one atlas docked right
     */
    tl.to(params, { atlasFly: 1, duration: 0.45, ease: 'power2.inOut' }, 7.4)

    /**
     * 07 → 08 — window and crew away, atlas compresses into a KTX2 chip
     */
    tl.to(params, { crewVisible: 0, duration: 0.22 }, 7.9)
    tl.to(params, { heroOpacity: 0, duration: 0.2 }, 7.9)
    tl.to(params, { frameOpacity: 0, duration: 0.22 }, 7.9)
    tl.to(params, { heroStanding: 0, duration: 0.1 }, 7.98)
    tl.to(params, { atlasChip: 1, duration: 0.35 }, 7.95)

    /**
     * 08 → 09 — back to the level view in WIREFRAME: the crew returns unlit,
     * the hero joins them, everything waits for its texture
     */
    tl.set(params, {
        crewPaint: 1,
        crewSurface: 0,
        crewWire: 0.3,
        heroSurface: 0,
        wireOpacity: 0.3,
        frameX: WORLD.zooFrameX,
        ...heroIso(WORLD.zooFrameX),
        heroStanding: 1,
    }, 8.5)
    tl.to(params, { frameOpacity: 1, duration: 0.35, ease: 'power2.out' }, 8.62)
    tl.to(params, { crewVisible: 1, duration: 0.3, ease: 'power2.out' }, 8.66)
    tl.to(params, { heroOpacity: 1, duration: 0.25 }, 8.7)

    /**
     * 09 — the combined KTX texture flies in and applies: every model wipes
     * from wireframe to its hand-painted skin and the crew comes alive
     */
    tl.to(params, { chipToCrew: 1, duration: 0.2, ease: 'power1.inOut' }, 8.95)
    tl.to(params, { batchTexApply: 1, duration: 0.25, ease: 'power1.inOut' }, 9.1)
    tl.to(params, { crewSurface: 1, duration: 0.25, ease: 'power1.inOut' }, 9.1)
    tl.to(params, { heroSurface: 1, duration: 0.2, ease: 'power1.inOut' }, 9.15)
    tl.to(params, { crewWire: 0, duration: 0.15 }, 9.22)
    tl.to(params, { wireOpacity: 0, duration: 0.15 }, 9.22)

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
