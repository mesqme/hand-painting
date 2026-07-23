import { HERO_SLOT, ISO, ISO_SLOTS, isoPoint } from '../config.js'

const lerp = (a, b, t) => a + (b - a) * t

export const FINAL_MODEL_SCALE = ISO.scale * 1.24
export const FINAL_SPREAD = 1.18
export const FINAL_SHIFT_X = 1.18

export function finalSlotTransform(slot, frameX, progress)
{
    const scale = lerp(ISO.scale, FINAL_MODEL_SCALE, progress)
    const spread = lerp(1, FINAL_SPREAD, progress)
    const [ sx, sz ] = ISO_SLOTS[slot]
    const point = isoPoint(sx * spread, 1.3 * scale, sz * spread)

    return {
        x: frameX + FINAL_SHIFT_X * progress + point.x,
        y: ISO.centerY + point.y,
        z: point.z,
        scale,
        spread,
    }
}

export function finalDuckOffset(slot, progress)
{
    const scale = lerp(ISO.scale, FINAL_MODEL_SCALE, progress)
    const spread = lerp(1, FINAL_SPREAD, progress)
    const [ heroX, heroZ ] = ISO_SLOTS[HERO_SLOT]
    const [ slotX, slotZ ] = ISO_SLOTS[slot]

    return {
        x: (slotX - heroX) * spread / scale,
        z: (slotZ - heroZ) * spread / scale,
    }
}
