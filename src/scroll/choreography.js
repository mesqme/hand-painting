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
    scaleGuide: 0,
    scaleStatus: 0,
    scaleFeedback: 0,

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
    noteOpacity: 0,

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

    // Batched-mesh explanation: one sequential R-channel lookup per object
    batchData: 0,
    batchLookup: 0,
    batchPhase: 0,
    batchNeutral: 0,
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
    tl.to(params, { noteOpacity: 1, duration: 0.12, ease: 'power1.out' }, 1.02)
    tl.to(params, { uvProgress: 1, duration: 1.18, ease: 'power1.inOut' }, 1.1)
    tl.to(params, { noteOpacity: 0, duration: 0.14, ease: 'power1.in' }, 2.34)
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
     * 03 — validate three candidate scales: small ×, large ×, production ✓.
     * The guide remains attached to the real assembly, so every box change is
     * the actual model scale rather than a detached UI approximation.
     */
    tl.to(params, { scaleGuide: 1, duration: 0.14, ease: 'power2.out' }, 2.84)
    tl.to(params, { heroScale: ISO.scale * 0.78, duration: 0.2, ease: 'sine.inOut' }, 2.9)
    tl.set(params, { scaleStatus: 1, scaleFeedback: 0 }, 3.1)
    tl.to(params, { scaleFeedback: 1, duration: 0.14, ease: 'power2.out' }, 3.1)

    tl.set(params, { scaleStatus: 0, scaleFeedback: 0 }, 3.26)
    tl.to(params, { heroScale: ISO.scale * 1.2, duration: 0.2, ease: 'sine.inOut' }, 3.26)
    tl.set(params, { scaleStatus: 1, scaleFeedback: 0 }, 3.46)
    tl.to(params, { scaleFeedback: 1, duration: 0.14, ease: 'power2.out' }, 3.46)

    tl.set(params, { scaleStatus: 0, scaleFeedback: 0 }, 3.62)
    tl.to(params, { heroScale: ISO.scale, duration: 0.2, ease: 'sine.inOut' }, 3.62)
    tl.set(params, { scaleStatus: 2, scaleFeedback: 0 }, 3.82)
    tl.to(params, { scaleFeedback: 1, duration: 0.14, ease: 'power2.out' }, 3.82)
    tl.to(params, { scaleGuide: 0, duration: 0.12 }, 3.98)
    tl.set(params, { scaleStatus: 0, scaleFeedback: 0 }, 4.1)

    /**
     * 03 → 04 — the frame, crew and hero transition together. The scene uses
     * no rendered floor, so there is no ground handoff or waiting tick.
     */
    tl.to(params, { crewVisible: 0, duration: 0.22 }, 4.12)
    tl.to(params, { frameOpacity: 0, duration: 0.22 }, 4.12)
    tl.to(params, { heroStanding: 0, duration: 0.32, ease: 'power1.inOut' }, 4.08)
    tl.to(params, { ...heroCenter, duration: 0.42 }, 4.12)

    /**
     * 04 — neutral surface + wireframe, seams, authored UV1, then bake.
     * The solid model remains opaque throughout.
     */
    tl.set(params, {
        bakeSheetClear: 1,
        paletteX: WORLD.bakeSheetX,
        paletteY: WORLD.paletteY,
        paletteScale: 1,
    }, 4.26)
    tl.to(params, { paletteOpacity: 1, duration: 0.24, ease: 'power2.out' }, 4.26)
    tl.to(params, { whiteMix: 1, clayWipe: 0, duration: 0.2 }, 4.28)
    tl.to(params, { wireOpacity: 0.32, duration: 0.18 }, 4.32)

    tl.set(params, { bakePhase: 1, noteOpacity: 0 }, 4.54)
    tl.to(params, { noteOpacity: 1, duration: 0.12, ease: 'power1.out' }, 4.54)
    tl.to(params, { seamOpacity: 1, duration: 0.2 }, 4.55)
    tl.to(params, { sheetWire: 1, duration: 0.24 }, 4.58)

    tl.to(params, { noteOpacity: 0, duration: 0.14, ease: 'power1.in' }, 4.94)
    tl.to(params, { seamOpacity: 0, duration: 0.16 }, 5.06)
    tl.set(params, { bakePhase: 0 }, 5.08)
    tl.set(params, { bakePhase: 2, noteOpacity: 0 }, 5.2)
    tl.to(params, { noteOpacity: 1, duration: 0.12, ease: 'power1.out' }, 5.2)
    tl.to(params, { bakeSweep: 1, duration: 0.48, ease: 'power1.inOut' }, 5.21)
    tl.to(params, { bakeSheetClear: 0, duration: 0.48, ease: 'power1.inOut' }, 5.21)
    tl.to(params, { clayWipe: 1, duration: 0.48, ease: 'power1.inOut' }, 5.21)
    tl.to(params, { noteOpacity: 0, duration: 0.16, ease: 'power1.in' }, 5.52)
    tl.to(params, { wireOpacity: 0, duration: 0.18 }, 5.52)
    tl.to(params, { sheetWire: 0, duration: 0.18 }, 5.54)
    tl.set(params, { bakePhase: 0, whiteMix: 0, clayWipe: 0 }, 5.7)

    /**
     * 05 — the bake sheet travels from left to center while the hero makes
     * room on the right. Copy enters only after that composition is ready.
     */
    tl.set(params, { paintTexture: 0, heroOpacity: 1, paintPhase: 1, noteOpacity: 0 }, 5.72)
    tl.to(params, { noteOpacity: 1, duration: 0.12, ease: 'power1.out' }, 5.72)
    tl.to(params, {
        heroX: WORLD.paintHeroX,
        heroScale: 0.8,
        heroOpacity: 1,
        paletteX: WORLD.paintSheetX,
        paletteY: 0,
        paletteScale: 1.34,
        duration: 0.4,
    }, 5.72)
    tl.to(params, { noteOpacity: 0, duration: 0.12, ease: 'power1.in' }, 6)
    tl.set(params, { paintPhase: 0, noteOpacity: 0 }, 6.14)
    tl.to(params, { sheetPaint: 1, duration: 0.5, ease: 'power1.inOut' }, 6.15)
    tl.to(params, { reveal: 1, duration: 0.5, ease: 'power1.inOut' }, 6.15)

    /**
     * 05 → 06 — the hero is already on the right, so it settles gently into
     * the live-scene slot without crossing the other objects.
     */
    tl.to(params, { paletteOpacity: 0, duration: 0.18 }, 6.68)
    tl.set(params, { paintPhase: 0, noteOpacity: 0, frameX: WORLD.artistFrameX, crewPaint: 1 }, 6.78)
    tl.to(params, {
        ...heroIso(WORLD.artistFrameX),
        heroSpinY: 0,
        heroOpacity: 1,
        duration: 0.4,
        ease: 'power2.inOut',
    }, 6.78)
    tl.to(params, { frameOpacity: 1, duration: 0.24, ease: 'power2.out' }, 6.86)
    tl.to(params, { crewVisible: 1, duration: 0.24, ease: 'power2.out' }, 6.96)
    tl.to(params, { heroStanding: 1, duration: 0.4, ease: 'power1.inOut' }, 6.78)

    /**
     * 06 — open the larger dropdown and wipe quickly through
     * base → pastel → red → aberration.
     */
    tl.to(params, { dropdownIn: 1, duration: 0.18, ease: 'power2.out' }, 7.22)
    tl.to(params, { dropdownOpen: 1, duration: 0.22, ease: 'power2.out' }, 7.3)
    tl.to(params, { paintTexture: 1, duration: 0.16, ease: 'power1.inOut' }, 7.56)
    tl.to(params, { paintTexture: 2, duration: 0.16, ease: 'power1.inOut' }, 7.78)
    tl.to(params, { paintTexture: 3, duration: 0.16, ease: 'power1.inOut' }, 8)
    tl.to(params, { dropdownOpen: 0, duration: 0.1 }, 8.18)
    tl.to(params, { dropdownIn: 0, duration: 0.1 }, 8.28)

    /**
     * 07 — four square image sheets align with their assets, shed their
     * temporary outlines, and merge edge-to-edge into one square atlas.
     */
    tl.set(params, { combinePhase: 1, noteOpacity: 0 }, 8.38)
    tl.to(params, { noteOpacity: 1, duration: 0.12, ease: 'power1.out' }, 8.38)
    tl.to(params, { sheetsIn: 1, duration: 0.26, ease: 'power2.out' }, 8.4)
    tl.to(params, { atlasFly: 1, duration: 0.5, ease: 'power1.inOut' }, 8.62)
    tl.to(params, { noteOpacity: 0, duration: 0.14, ease: 'power1.in' }, 9.04)

    /**
     * 08 — keep the live preview and combined atlas in place. Compression is
     * one simple scale change plus the KTX2 badge.
     */
    tl.set(params, { ktxPhase: 1, noteOpacity: 0 }, 9.22)
    tl.set(params, { combinePhase: 0 }, 9.22)
    tl.to(params, { noteOpacity: 1, duration: 0.12, ease: 'power1.out' }, 9.22)
    tl.to(params, { atlasDock: 1, duration: 0.26, ease: 'power2.inOut' }, 9.22)
    tl.to(params, { atlasChip: 1, duration: 0.28, ease: 'power2.inOut' }, 9.3)
    tl.to(params, { noteOpacity: 0, duration: 0.14, ease: 'power1.in' }, 9.5)
    tl.set(params, { ktxPhase: 0, noteOpacity: 0 }, 9.66)

    /**
     * 09 — one red-channel lookup at a time. Each R ID appears on its
     * geometry, matches the same atlas region, then reveals that object.
     */
    tl.set(params, {
        batchPhase: 1,
        crewSurface: 1,
        crewWire: 0.2,
        heroSurface: 1,
        wireOpacity: 0.2,
        batchNeutral: 0,
        batchLookup: 0,
        perfVisible: 0,
        noteOpacity: 0,
    }, 9.72)
    tl.to(params, { noteOpacity: 1, duration: 0.12, ease: 'power1.out' }, 9.72)
    tl.to(params, { batchNeutral: 1, duration: 0.18, ease: 'power1.inOut' }, 9.72)
    tl.set(params, { crewPaint: 1 }, 9.9)
    tl.to(params, { batchData: 1, duration: 0.18, ease: 'power2.out' }, 9.88)
    tl.to(params, { batchLookup: 4, duration: 1.72, ease: 'none' }, 9.98)

    // G, B and A stay available for optional per-instance data.
    tl.to(params, { noteOpacity: 0, duration: 0.14, ease: 'power1.in' }, 11.58)
    tl.set(params, { batchPhase: 2, noteOpacity: 0 }, 11.74)
    tl.to(params, { noteOpacity: 1, duration: 0.12, ease: 'power1.out' }, 11.74)

    // Clear the lookup furniture only after every object has been colored.
    tl.to(params, { noteOpacity: 0, duration: 0.12, ease: 'power1.in' }, 11.88)
    tl.set(params, { batchPhase: 0, noteOpacity: 0 }, 12.02)
    tl.to(params, {
        crewWire: 0,
        wireOpacity: 0,
        sheetsIn: 0,
        batchData: 0,
        duration: 0.24,
        ease: 'power1.inOut',
    }, 12.02)

    // Only the colored scene and one-draw-call proof remain.
    tl.set(params, { batchPhase: 3, noteOpacity: 0 }, 12.28)
    tl.to(params, { noteOpacity: 1, duration: 0.1, ease: 'power1.out' }, 12.28)
    tl.to(params, { perfVisible: 1, duration: 0.2, ease: 'power2.out' }, 12.28)
    tl.to(params, { noteOpacity: 0, duration: 0.1, ease: 'power1.in' }, 12.48)

    /**
     * 10 — clear the explanatory UI and hand off to the credits vignette.
     */
    tl.to(params, {
        frameOpacity: 0,
        batchData: 0,
        sheetsIn: 0,
        perfVisible: 0,
        duration: 0.24,
    }, 12.58)
    tl.set(params, { batchPhase: 0, ktxPhase: 0, noteOpacity: 0 }, 12.62)
    tl.to(params, { finalVisible: 1, duration: 0.3, ease: 'power2.inOut' }, 12.82)

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
