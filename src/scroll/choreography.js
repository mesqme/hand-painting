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
 * on an even grid — the hero is always crew slot 1. Sections:
 * 00 intro · 01 model · 02 palette · 03 test scene · 04 bake · 05 hand paint ·
 * 06 live updates · 07 combine · 08 compress · 09 RGBA data · 10 UV remap
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
    paletteY: WORLD.paletteY,
    paletteScale: 1,
    paletteOpacity: 0,
    uvLines: 0,
    uvProgress: 0,
    sheetPaint: 0,
    sheetWire: 0,

    // Bake
    seamOpacity: 0,
    bakeSweep: 0,
    bakeSheetClear: 0,
    bakePhase: 0,
    paintFocus: 0,

    // Crew (the three non-hero members + floor grid, acts 03/06/07/09/10)
    crewVisible: 0,
    crewPaint: 0,
    crewSurface: 1,
    crewWire: 0,
    batchTexApply: 0,

    // Artist live loop (act 06 — the dropdown next to the model)
    dropdownIn: 0,
    dropdownOpen: 0,
    paintTexture: 3,

    // Atlas sheets / KTX chip
    sheetsIn: 0,
    atlasFly: 0,
    atlasChip: 0,
    ktxPhase: 0,

    // Batch-data explanation (acts 09 / 10)
    batchData: 0,
    batchDecode: 0,

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
            scrub: 0.9,
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
     * 04 — a deliberate sequence:
     * gradient → wireframe → seams → UV layout → seams off → bake
     */
    tl.set(params, { bakePhase: 1 }, 3.96)
    tl.to(params, { heroSurface: 0, duration: 0.26, ease: 'power1.inOut' }, 3.98)
    tl.to(params, { wireOpacity: 0.32, duration: 0.2 }, 4.02)

    tl.set(params, { bakePhase: 2 }, 4.22)
    tl.to(params, { seamOpacity: 1, duration: 0.2 }, 4.24)

    tl.set(params, { bakePhase: 3 }, 4.43)
    tl.to(params, { bakeSheetClear: 1, duration: 0.16 }, 4.44)
    tl.to(params, { sheetWire: 1, duration: 0.24 }, 4.48)

    tl.to(params, { seamOpacity: 0, duration: 0.18 }, 4.68)
    tl.set(params, { bakePhase: 4 }, 4.75)
    tl.to(params, { bakeSweep: 1, duration: 0.48, ease: 'power1.inOut' }, 4.76)
    tl.to(params, { heroSurface: 1, duration: 0.48, ease: 'power1.inOut' }, 4.76)
    tl.to(params, { wireOpacity: 0, duration: 0.2 }, 5.02)
    tl.to(params, { sheetWire: 0, duration: 0.2 }, 5.06)
    tl.to(params, { bakeSheetClear: 0, duration: 0.18 }, 5.08)

    /**
     * 05 — the texture becomes the center of attention for Photoshop work.
     * The painted base wipes in with a sharp, noisy paint edge.
     */
    tl.set(params, { bakePhase: 0, paintFocus: 1, paintTexture: 0 }, 5.14)
    tl.to(params, {
        heroX: WORLD.paintHeroX,
        heroScale: 0.78,
        heroOpacity: 0.78,
        paletteX: WORLD.paintSheetX,
        paletteY: 0,
        paletteScale: 1.34,
        duration: 0.45,
    }, 5.14)
    tl.to(params, { sheetPaint: 1, duration: 0.68, ease: 'power1.inOut' }, 5.32)
    tl.to(params, { reveal: 1, duration: 0.68, ease: 'power1.inOut' }, 5.32)

    /**
     * 05 → 06 — the same level view returns with the painted base selected.
     */
    tl.to(params, { paletteOpacity: 0, duration: 0.25 }, 5.82)
    tl.to(params, { paletteScale: 1, paintFocus: 0, duration: 0.2 }, 5.82)
    tl.to(params, { ...heroIso(WORLD.artistFrameX), heroOpacity: 1, duration: 0.44 }, 5.86)
    tl.to(params, { heroStanding: 1, duration: 0.2 }, 5.95)
    tl.set(params, { frameX: WORLD.artistFrameX, crewPaint: 1 }, 5.8)
    tl.to(params, { frameOpacity: 1, duration: 0.34, ease: 'power2.out' }, 5.92)
    tl.to(params, { crewVisible: 1, duration: 0.42, ease: 'power2.out' }, 5.98)

    /**
     * 06 — open the larger dropdown and switch immediately:
     * base → pastel → red → aberration.
     */
    tl.to(params, { dropdownIn: 1, duration: 0.22, ease: 'power2.out' }, 6.04)
    tl.to(params, { dropdownOpen: 1, duration: 0.34, ease: 'power2.out' }, 6.16)
    tl.set(params, { paintTexture: 1 }, 6.46)
    tl.set(params, { paintTexture: 2 }, 6.68)
    tl.set(params, { paintTexture: 3 }, 6.9)
    tl.to(params, { dropdownOpen: 0, duration: 0.2 }, 7.02)
    tl.to(params, { dropdownIn: 0, duration: 0.18 }, 7.12)

    /**
     * 07 — texture cards appear beside the four assets and follow four
     * non-crossing paths into the atlas.
     */
    tl.to(params, { sheetsIn: 1, duration: 0.38, ease: 'power2.out' }, 7.16)
    tl.to(params, { atlasFly: 1, duration: 0.78, ease: 'power1.inOut' }, 7.42)

    /**
     * 08 — window and crew leave while the stable atlas is compressed in
     * three readable KTX2 phases.
     */
    tl.to(params, { crewVisible: 0, duration: 0.32 }, 8.12)
    tl.to(params, { heroOpacity: 0, duration: 0.3 }, 8.12)
    tl.to(params, { frameOpacity: 0, duration: 0.32 }, 8.12)
    tl.to(params, { heroStanding: 0, duration: 0.12 }, 8.28)
    tl.set(params, { ktxPhase: 1 }, 8.3)
    tl.to(params, { atlasChip: 0.35, duration: 0.28 }, 8.32)
    tl.set(params, { ktxPhase: 2 }, 8.58)
    tl.to(params, { atlasChip: 0.72, duration: 0.28 }, 8.6)
    tl.set(params, { ktxPhase: 3 }, 8.86)
    tl.to(params, { atlasChip: 1, duration: 0.28 }, 8.88)

    /**
     * 09 — return in wireframe and encode RGBA data for each instance.
     */
    tl.set(params, {
        ktxPhase: 0,
        crewPaint: 1,
        crewSurface: 0,
        crewWire: 0.3,
        heroSurface: 0,
        wireOpacity: 0.3,
        frameX: WORLD.zooFrameX,
        ...heroIso(WORLD.zooFrameX),
        heroStanding: 1,
    }, 9.08)
    tl.to(params, { frameOpacity: 1, duration: 0.42, ease: 'power2.out' }, 9.12)
    tl.to(params, { crewVisible: 1, duration: 0.4, ease: 'power2.out' }, 9.16)
    tl.to(params, { heroOpacity: 1, duration: 0.35 }, 9.18)
    tl.to(params, { batchData: 1, duration: 0.72, ease: 'power1.inOut' }, 9.3)

    /**
     * 10 — decode R/G, highlight atlas regions, remap UVs and apply the
     * texture to every instance at a readable pace.
     */
    tl.to(params, { batchDecode: 1, duration: 0.78, ease: 'power1.inOut' }, 10.08)
    tl.to(params, { batchTexApply: 1, duration: 0.78, ease: 'power1.inOut' }, 10.08)
    tl.to(params, { crewSurface: 1, duration: 0.78, ease: 'power1.inOut' }, 10.08)
    tl.to(params, { heroSurface: 1, duration: 0.72, ease: 'power1.inOut' }, 10.12)
    tl.to(params, { crewWire: 0, duration: 0.35 }, 10.56)
    tl.to(params, { wireOpacity: 0, duration: 0.35 }, 10.56)

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
