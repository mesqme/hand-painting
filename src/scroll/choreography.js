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
 * Stage grammar: the model works in the center, sheets move between docks, and the
 * window acts tilt into a 45° level view where the same four-piece crew stands
 * on an even grid — the hero is always crew slot 1. Sections:
 * 00 intro · 01 model · 02 palette · 03 test scene · 04 bake · 05 hand paint ·
 * 06 live updates · 07 combine · 08 compress · 09 batched mesh
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
    heroScale: 1.14,
    heroOpacity: 1,
    heroRotX: CENTER_TILT,
    heroRotY: CENTER_YAW,
    heroSpinY: 0,
    heroStanding: 0,
    whiteMix: 0,
    clayWipe: 0,
    wireOpacity: 0,
    reveal: 1,
    heroSurface: 1,

    // Palette / texture sheet
    paletteX: WORLD.sheetX,
    paletteY: WORLD.paletteY,
    paletteScale: 1,
    paletteOpacity: 0,
    uvLines: 0,
    uvProgress: 0,
    palettePhase: 0,
    sheetPaint: 0,
    sheetWire: 0,

    // Bake
    seamOpacity: 0,
    bakeSweep: 0,
    bakeSheetClear: 0,
    bakePhase: 0,
    paintPhase: 0,

    // Crew (the three non-hero members, acts 03/06/07/08/09)
    crewVisible: 0,
    crewPaint: 0,
    crewSurface: 1,
    crewWire: 0,

    // Artist live loop (act 06 — the dropdown next to the model)
    dropdownIn: 0,
    dropdownOpen: 0,
    paintTexture: 3,

    // Atlas sheets / KTX chip
    sheetsIn: 0,
    atlasFly: 0,
    atlasChip: 0,
    atlasInspect: 0,
    atlasDock: 0,
    combinePhase: 0,
    ktxPhase: 0,

    // Batched-mesh explanation (three substeps inside act 09)
    batchData: 0,
    batchAtlasR: 0,
    batchRed: 0,
    batchGreen: 0,
    batchPhase: 0,
    batchNeutral: 0,
    batchColor: 0,
    perfVisible: 0,

    // Final credits composition
    finalVisible: 0,

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

const heroCenter = { heroX: 0.48, heroY: 0, heroZ: 0, heroRotX: CENTER_TILT, heroRotY: CENTER_YAW, heroScale: 1 }

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
     * 00 → 01 — finished teaser to neutral model.
     */
    // One uninterrupted move from the painted intro to the palette pose.
    // Section 01 is a short label inside this journey, not a stopping point.
    tl.to(params, {
        heroX: 0,
        heroScale: 1,
        heroRotY: 0.42,
        duration: 1.02,
        ease: 'power1.inOut',
    }, 0.02)
    tl.to(params, { whiteMix: 1, duration: 0.24 }, 0.1)
    tl.to(params, { wireOpacity: 0.36, duration: 0.22 }, 0.16)
    // Change the hidden source only once the clay is fully opaque, avoiding a
    // visible painted-to-gradient flash during the intro handoff.
    tl.set(params, { reveal: 0 }, 0.38)
    tl.to(params, { whiteMix: 0, duration: 0.26 }, 0.5)
    tl.to(params, { wireOpacity: 0, duration: 0.24 }, 0.62)

    /**
     * 01 → 02 — gradient palette and authored UV positioning.
     */
    tl.to(params, { paletteOpacity: 1, duration: 0.28, ease: 'power2.out' }, 0.86)
    tl.to(params, { uvLines: 1, duration: 0.22 }, 0.96)
    tl.set(params, { palettePhase: 1 }, 1.02)
    tl.to(params, { uvProgress: 1, duration: 1.18, ease: 'power1.inOut' }, 1.1)
    tl.set(params, { palettePhase: 0 }, 2.5)

    /**
     * 02 → 03 — enter the level view.
     */
    tl.to(params, { uvLines: 0, duration: 0.18 }, 2.54)
    tl.to(params, { paletteOpacity: 0, duration: 0.2 }, 2.54)
    tl.to(params, { ...heroIso(WORLD.testFrameX), duration: 0.42 }, 2.58)
    tl.set(params, { frameX: WORLD.testFrameX, crewPaint: 0 }, 2.62)
    tl.to(params, { frameOpacity: 1, duration: 0.3, ease: 'power2.out' }, 2.64)
    tl.to(params, { crewVisible: 1, duration: 0.34, ease: 'power2.out' }, 2.72)
    tl.to(params, { heroStanding: 1, duration: 0.42, ease: 'power1.inOut' }, 2.64)

    /**
     * 03 — test three candidate scales before settling on the production size.
     */
    tl.to(params, { heroScale: ISO.scale * 0.78, duration: 0.26, ease: 'sine.inOut' }, 2.94)
    tl.to(params, { heroScale: ISO.scale * 1.2, duration: 0.28, ease: 'sine.inOut' }, 3.22)
    tl.to(params, { heroScale: ISO.scale, duration: 0.24, ease: 'sine.inOut' }, 3.5)

    /**
     * 03 → 04 — the frame, crew and hero transition together. The scene uses
     * no rendered floor, so there is no ground handoff or waiting tick.
     */
    tl.to(params, { crewVisible: 0, duration: 0.22 }, 3.62)
    tl.to(params, { frameOpacity: 0, duration: 0.22 }, 3.62)
    tl.to(params, { heroStanding: 0, duration: 0.32, ease: 'power1.inOut' }, 3.58)
    tl.to(params, { ...heroCenter, duration: 0.42 }, 3.62)

    /**
     * 04 — neutral surface + wireframe, seams, authored UV1, then bake.
     * The solid model remains opaque throughout.
     */
    tl.set(params, {
        bakeSheetClear: 1,
        paletteX: WORLD.bakeSheetX,
        paletteY: WORLD.paletteY,
        paletteScale: 1,
    }, 3.76)
    tl.to(params, { paletteOpacity: 1, duration: 0.24, ease: 'power2.out' }, 3.76)
    tl.to(params, { whiteMix: 1, clayWipe: 0, duration: 0.2 }, 3.78)
    tl.to(params, { wireOpacity: 0.32, duration: 0.18 }, 3.82)

    tl.set(params, { bakePhase: 1 }, 4.04)
    tl.to(params, { seamOpacity: 1, duration: 0.2 }, 4.05)
    tl.to(params, { sheetWire: 1, duration: 0.24 }, 4.08)

    tl.set(params, { bakePhase: 2 }, 4.3)

    tl.to(params, { seamOpacity: 0, duration: 0.16 }, 4.56)
    tl.set(params, { bakePhase: 3 }, 4.7)
    tl.to(params, { bakeSweep: 1, duration: 0.48, ease: 'power1.inOut' }, 4.71)
    tl.to(params, { bakeSheetClear: 0, duration: 0.48, ease: 'power1.inOut' }, 4.71)
    tl.to(params, { clayWipe: 1, duration: 0.48, ease: 'power1.inOut' }, 4.71)
    tl.to(params, { wireOpacity: 0, duration: 0.18 }, 5.02)
    tl.to(params, { sheetWire: 0, duration: 0.18 }, 5.04)
    tl.set(params, { bakePhase: 0, whiteMix: 0, clayWipe: 0 }, 5.2)

    /**
     * 05 — the bake sheet travels from left to center while the hero makes
     * room on the right. Copy enters only after that composition is ready.
     */
    tl.set(params, { paintTexture: 0, heroOpacity: 1 }, 5.22)
    tl.to(params, {
        heroX: WORLD.paintHeroX,
        heroScale: 0.8,
        heroOpacity: 1,
        paletteX: WORLD.paintSheetX,
        paletteY: 0,
        paletteScale: 1.34,
        duration: 0.4,
    }, 5.22)
    tl.set(params, { paintPhase: 1 }, 5.48)
    tl.set(params, { paintPhase: 2 }, 5.64)
    tl.to(params, { sheetPaint: 1, duration: 0.5, ease: 'power1.inOut' }, 5.65)
    tl.to(params, { reveal: 1, duration: 0.5, ease: 'power1.inOut' }, 5.65)

    /**
     * 05 → 06 — the hero is already on the right, so it settles gently into
     * the live-scene slot without crossing the other objects.
     */
    tl.to(params, { paletteOpacity: 0, duration: 0.18 }, 6.18)
    tl.set(params, { paintPhase: 0, frameX: WORLD.artistFrameX, crewPaint: 0 }, 6.28)
    tl.to(params, {
        ...heroIso(WORLD.artistFrameX),
        heroSpinY: 0,
        heroOpacity: 1,
        duration: 0.4,
        ease: 'power2.inOut',
    }, 6.28)
    tl.to(params, { frameOpacity: 1, duration: 0.24, ease: 'power2.out' }, 6.36)
    tl.to(params, { crewVisible: 1, duration: 0.24, ease: 'power2.out' }, 6.46)
    tl.to(params, { heroStanding: 1, duration: 0.4, ease: 'power1.inOut' }, 6.28)

    /**
     * 06 — open the larger dropdown and wipe quickly through
     * base → pastel → red → aberration.
     */
    tl.to(params, { dropdownIn: 1, duration: 0.18, ease: 'power2.out' }, 6.72)
    tl.to(params, { dropdownOpen: 1, duration: 0.22, ease: 'power2.out' }, 6.8)
    tl.to(params, { paintTexture: 1, duration: 0.16, ease: 'power1.inOut' }, 7.06)
    tl.to(params, { paintTexture: 2, duration: 0.16, ease: 'power1.inOut' }, 7.28)
    tl.to(params, { paintTexture: 3, duration: 0.16, ease: 'power1.inOut' }, 7.5)
    tl.to(params, { dropdownOpen: 0, duration: 0.1 }, 7.68)
    tl.to(params, { dropdownIn: 0, duration: 0.1 }, 7.78)

    /**
     * 07 — four square image sheets align with their assets, shed their
     * temporary outlines, and merge edge-to-edge into one square atlas.
     */
    tl.set(params, { combinePhase: 1 }, 7.88)
    tl.to(params, { sheetsIn: 1, duration: 0.26, ease: 'power2.out' }, 7.9)
    tl.to(params, { atlasFly: 1, duration: 0.5, ease: 'power1.inOut' }, 8.12)

    /**
     * 08 — keep the live preview and combined atlas in place. Compression is
     * one simple scale change plus the KTX2 badge.
     */
    tl.set(params, { ktxPhase: 1 }, 8.72)
    tl.set(params, { combinePhase: 0 }, 8.72)
    tl.to(params, { atlasDock: 1, duration: 0.26, ease: 'power2.inOut' }, 8.72)
    tl.to(params, { atlasChip: 1, duration: 0.28, ease: 'power2.inOut' }, 8.8)
    tl.set(params, { ktxPhase: 0 }, 9.16)

    /**
     * 09 — neutral wireframe scene + compact batchColor demonstration:
     * empty channels, R geometry IDs from the atlas, then G texture IDs.
     */
    tl.set(params, {
        batchPhase: 1,
        crewSurface: 1,
        crewWire: 0.2,
        heroSurface: 1,
        wireOpacity: 0.2,
        batchNeutral: 0,
        batchColor: 0,
        perfVisible: 0,
    }, 9.28)
    tl.to(params, { batchNeutral: 1, duration: 0.18, ease: 'power1.inOut' }, 9.28)
    tl.set(params, { crewPaint: 1 }, 9.48)
    tl.to(params, { batchData: 1, duration: 0.18, ease: 'power2.out' }, 9.46)

    // R: enlarge the atlas, explain material assignment, then fill values.
    tl.to(params, { atlasInspect: 1, duration: 0.24, ease: 'power2.out' }, 9.5)
    tl.to(params, { batchAtlasR: 1, duration: 0.2, ease: 'power2.out' }, 9.72)
    tl.to(params, { batchRed: 1, duration: 0.24, ease: 'power1.inOut' }, 9.94)

    // Reset the atlas before moving attention to geometry.
    tl.set(params, { batchPhase: 0 }, 10.18)
    tl.to(params, {
        atlasInspect: 0,
        batchAtlasR: 0,
        duration: 0.22,
        ease: 'power2.inOut',
    }, 10.18)

    // G: highlight geometry wireframes, explain the channel, then fill values.
    tl.set(params, { batchPhase: 2 }, 10.42)
    tl.to(params, { crewWire: 0.62, wireOpacity: 0.62, duration: 0.22 }, 10.42)
    tl.to(params, { batchGreen: 1, duration: 0.26, ease: 'power2.out' }, 10.68)

    // Return wireframes to normal weight and reserve B/A.
    tl.to(params, { crewWire: 0.2, wireOpacity: 0.2, duration: 0.2 }, 10.94)
    tl.set(params, { batchPhase: 3 }, 10.96)

    // Apply all materials together, then clear the explanatory furniture.
    tl.set(params, { batchPhase: 0 }, 11.16)
    tl.to(params, {
        batchColor: 1,
        crewWire: 0,
        wireOpacity: 0,
        sheetsIn: 0,
        batchData: 0,
        batchRed: 0,
        batchGreen: 0,
        duration: 0.28,
        ease: 'power1.inOut',
    }, 11.16)

    // Only the colored scene and one-draw-call proof remain.
    tl.set(params, { batchPhase: 4 }, 11.48)
    tl.to(params, { perfVisible: 1, duration: 0.2, ease: 'power2.out' }, 11.48)

    /**
     * 10 — clear the explanatory UI and hand off to the credits vignette.
     */
    tl.to(params, {
        frameOpacity: 0,
        batchData: 0,
        batchAtlasR: 0,
        batchRed: 0,
        batchGreen: 0,
        sheetsIn: 0,
        perfVisible: 0,
        duration: 0.24,
    }, 11.76)
    tl.set(params, { batchPhase: 0, ktxPhase: 0 }, 11.8)
    tl.to(params, { finalVisible: 1, duration: 0.42, ease: 'power2.inOut' }, 11.8)

    // Pin the timeline length to the exact scroll span.
    tl.set(params, { finalVisible: 1 }, SCROLL_END)

    // Dev-only hook for automated checks
    if(import.meta.env.DEV)
    {
        window.__params = params
        window.__timeline = tl
    }

    return tl
}
