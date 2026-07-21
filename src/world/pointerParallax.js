/**
 * Pointer parallax
 *
 * Render-free singleton: the whole stage leans gently towards the cursor.
 * One listener, one per-frame damped update called from Experience.
 */
export const pointerParallax = {
    targetX: 0,
    targetY: 0,
    currentX: 0,
    currentY: 0,
}

let started = false

export function startPointerParallax()
{
    if(started)
        return
    started = true

    window.addEventListener('pointermove', (event) =>
    {
        pointerParallax.targetX = (event.clientX / window.innerWidth) * 2 - 1
        pointerParallax.targetY = (event.clientY / window.innerHeight) * 2 - 1
    })
}

export function updatePointerParallax(delta)
{
    const damping = 1 - Math.pow(0.005, delta)
    pointerParallax.currentX += (pointerParallax.targetX - pointerParallax.currentX) * damping
    pointerParallax.currentY += (pointerParallax.targetY - pointerParallax.currentY) * damping
}
