/**
 * Frame fit
 *
 * One source of truth for the scene-window geometry, so the DOM window and the
 * 3D stage inside it can never diverge. Mirrors the camera (fov 33 at z 8.6 →
 * 0.1963 world-units per viewport-height fraction) and the Experience stage fit.
 */
export function frameFit()
{
    const aspect = window.innerWidth / window.innerHeight
    const fit = Math.min(Math.max(aspect / 1.72, 0.6), 1)
    const pxPerUnit = window.innerHeight * 0.1963 * fit
    const width = Math.min(6.9 * pxPerUnit, window.innerWidth * 0.92)
    const maxShift = Math.max(window.innerWidth / 2 - width / 2 - 8, 0)
    return { fit, pxPerUnit, width, maxShift }
}

/**
 * Clamps a world-space frame shift so the window (and the 3D content that must
 * stay concentric with it) never runs off the viewport. Identity on landscape.
 */
export function clampFrameX(frameX)
{
    const { pxPerUnit, maxShift } = frameFit()
    const shiftPx = Math.min(Math.max(frameX * pxPerUnit, - maxShift), maxShift)
    return shiftPx / pxPerUnit
}
