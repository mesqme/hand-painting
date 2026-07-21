import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

import { WORLD, SCROLL_END } from '../config.js'

/**
 * Animated params
 *
 * Single source of truth for the 3D choreography. The master timeline below is
 * scrubbed by scroll and writes ONLY into this object; world components read it
 * per frame and push values onto objects/uniforms (never through React state).
 * Timeline positions are authored in scroll units: 1 unit === 1 section height.
 */
export const params = {
    // Hero assembly
    heroX: WORLD.heroLeftX,
    heroY: 0,
    heroScale: 1,
    heroOpacity: 1,
    whiteMix: 1,
    wireOpacity: 0.28,
    reveal: 0,

    // Palette plane
    paletteX: WORLD.paletteStepX,
    paletteOpacity: 0,
    uvLines: 0,
    uvProgress: 0,

    // Test-scene ring
    ringIn: 0,
    ringOut: 0,

    // Bake rig
    bakeCopyOpacity: 0,
    bakeUnwrap: 0,
    bakeSweep: 0,
    bakeSheetClear: 0,

    // Atlas combine
    minisIn: 0,
    minisOut: 0,
    atlasFly: 0,
    atlasChip: 0,
    atlasOut: 0,

    // Batched finale
    batchIn: 0,
}

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
     * 01 → 02 — model travels right, clay turns gradient, palette card in
     */
    tl.set(params, { paletteX: WORLD.paletteStepX }, 0.5)
    tl.to(params, { heroX: WORLD.heroRightX, duration: 0.4 }, 0.55)
    tl.to(params, { whiteMix: 0, duration: 0.35 }, 0.6)
    tl.to(params, { wireOpacity: 0, duration: 0.3 }, 0.6)
    tl.to(params, { paletteOpacity: 1, duration: 0.3, ease: 'power2.out' }, 0.75)
    tl.to(params, { uvLines: 1, duration: 0.25 }, 0.85)

    /**
     * 02 — UV islands land on the palette
     */
    tl.to(params, { uvProgress: 1, duration: 0.55, ease: 'power1.inOut' }, 1.05)

    /**
     * 02 → 03 — palette out, model shrinks to the test scene
     */
    tl.to(params, { uvLines: 0, duration: 0.2 }, 1.62)
    tl.to(params, { paletteOpacity: 0, duration: 0.25 }, 1.62)
    tl.to(params, { heroX: 0, heroScale: 0.6, duration: 0.35 }, 1.68)
    tl.to(params, { ringIn: 1, duration: 0.45, ease: 'power2.out' }, 1.95)

    /**
     * 03 → 04 — ring away, bake layout (model left, target sheet right)
     */
    tl.to(params, { ringOut: 1, duration: 0.25 }, 2.55)
    tl.to(params, { heroX: WORLD.bakeHeroX, heroScale: 1, duration: 0.35 }, 2.65)
    tl.set(params, { paletteX: WORLD.paletteBakeX }, 2.5)
    tl.to(params, { paletteOpacity: 1, duration: 0.25, ease: 'power2.out' }, 2.9)

    /**
     * 04 — split; the sheet clears to an empty canvas, the copy unwraps onto
     * it, the bake sweep passes
     */
    tl.to(params, { heroY: 0.55, duration: 0.2 }, 3.05)
    tl.to(params, { bakeCopyOpacity: 1, duration: 0.12, ease: 'none' }, 3.02)
    tl.to(params, { bakeSheetClear: 1, duration: 0.18 }, 3.05)
    tl.to(params, { bakeUnwrap: 1, duration: 0.42, ease: 'power1.inOut' }, 3.2)
    tl.to(params, { bakeSweep: 1, duration: 0.2, ease: 'none' }, 3.64)

    /**
     * 04 → 05 — merge back fast, baked model reaches the paint spot before
     * the tray becomes interactive (step-4 window opens at t≈3.82)
     */
    tl.to(params, { bakeCopyOpacity: 0, duration: 0.17 }, 3.78)
    tl.to(params, { paletteOpacity: 0, duration: 0.22 }, 3.82)
    tl.to(params, { heroY: 0, duration: 0.2 }, 3.78)
    tl.to(params, { heroX: WORLD.heroRightX - 0.1, duration: 0.28 }, 3.85)

    /**
     * 05 — first painted texture wipes over the bake, early in the tray window
     */
    tl.to(params, { reveal: 1, duration: 0.3, ease: 'power1.inOut' }, 4.05)

    /**
     * 05 → 06 — hero away late (tray stays usable), minis with their own sheets
     */
    tl.to(params, { heroOpacity: 0, heroScale: 0.7, duration: 0.22 }, 4.78)
    tl.to(params, { minisIn: 1, duration: 0.4, ease: 'power2.out' }, 4.87)

    /**
     * 06 — four sheets fly into one atlas
     */
    tl.to(params, { atlasFly: 1, duration: 0.45, ease: 'power2.inOut' }, 5.35)

    /**
     * 06 → 07 — minis away, atlas compresses into a KTX2 chip
     */
    tl.to(params, { minisOut: 1, duration: 0.22 }, 5.72)
    tl.to(params, { atlasChip: 1, duration: 0.35 }, 5.95)

    /**
     * 07 → 08 — chip away, batched shelf in
     */
    tl.to(params, { atlasOut: 1, duration: 0.22 }, 6.55)
    tl.to(params, { batchIn: 1, duration: 0.45, ease: 'power2.out' }, 6.72)

    // Pin the timeline length to the exact scroll span so unit === section
    tl.set(params, { batchIn: 1 }, SCROLL_END)

    // Dev-only hook for automated checks
    if(import.meta.env.DEV)
    {
        window.__params = params
        window.__timeline = tl
    }

    return tl
}
