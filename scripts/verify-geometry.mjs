// Headless geometric verification of the level-view / scene-window fit —
// since the browser pane is unavailable. Checks that NOTHING inside the fake
// canvas (grid, models, shadows) pokes past its borders.
import { ISO, ISO_SLOTS, ISO_GRID_EXTENT, isoPoint, isoSlotOffset } from '../src/config.js'

const problems = []
const ok = (m) => console.log('  ok —', m)

// Camera + stage projection (matches Experience/SceneWindow): fov 33 at (0,0.1,8.6)
const FOV = 33
const CAM_Y = 0.1
const CAM_Z = 8.6
const tanHalf = Math.tan((FOV / 2) * Math.PI / 180)

// Window borders in NDC. Window is 72vh tall, top:50%, translateY(-52%):
// bottom fraction-from-top = 0.5 - 0.52·0.72 + 0.72 = 0.8456; NDC = 1 - 2·frac
const WINDOW_BOTTOM_NDC = 1 - 2 * (0.5 - 0.52 * 0.72 + 0.72)   // = -0.6912
const WINDOW_TOP_NDC = 1 - 2 * (0.5 - 0.52 * 0.72)             // =  0.7488

const ASPECTS = [ 1.0, 1.33, 1.6, 1.777, 2.0, 2.4 ]

function projectNDCy(worldY, aspect)
{
    const fit = Math.min(Math.max(aspect / 1.72, 0.6), 1)
    const y = worldY * fit
    return (y - CAM_Y) / (tanHalf * CAM_Z)
}

/**
 * 1. Grid containment — the FULL square grid (no chamfer), all four corners
 */
const corners = []
for(const gx of [ - ISO_GRID_EXTENT, ISO_GRID_EXTENT ])
    for(const gz of [ - ISO_GRID_EXTENT, ISO_GRID_EXTENT ])
        corners.push([ gx, gz ])

for(const aspect of ASPECTS)
{
    let lowest = Infinity
    for(const [ gx, gz ] of corners)
    {
        const p = isoPoint(gx, 0, gz)
        lowest = Math.min(lowest, projectNDCy(ISO.centerY + p.y, aspect))
    }
    if(lowest < WINDOW_BOTTOM_NDC + 0.02)
        problems.push(`grid front corner NDC ${ lowest.toFixed(3) } below window bottom ${ WINDOW_BOTTOM_NDC.toFixed(3) } at aspect ${ aspect }`)
    else
        ok(`full grid contained at aspect ${ aspect } (lowest NDC ${ lowest.toFixed(3) } ≥ ${ WINDOW_BOTTOM_NDC.toFixed(3) })`)
}

/**
 * 2. Model containment — every slot's assembly top (plus float/bob headroom)
 *    under the window top, every bottom above the window bottom
 */
for(const aspect of ASPECTS)
{
    let maxTop = - Infinity
    let minBottom = Infinity
    for(let slot = 0; slot < 4; slot++)
    {
        const offset = isoSlotOffset(slot)
        // Assembly spans ±1.3·scale around its center; +0.12·scale headroom
        // covers the duck float and hero bob
        maxTop = Math.max(maxTop, projectNDCy(offset.y + 1.42 * ISO.scale, aspect))
        minBottom = Math.min(minBottom, projectNDCy(offset.y - 1.3 * ISO.scale, aspect))
    }
    if(maxTop > WINDOW_TOP_NDC - 0.02)
        problems.push(`model top NDC ${ maxTop.toFixed(3) } above window top ${ WINDOW_TOP_NDC.toFixed(3) } at aspect ${ aspect }`)
    else if(minBottom < WINDOW_BOTTOM_NDC + 0.02)
        problems.push(`model bottom NDC ${ minBottom.toFixed(3) } below window bottom ${ WINDOW_BOTTOM_NDC.toFixed(3) } at aspect ${ aspect }`)
    else
        ok(`models contained at aspect ${ aspect } (top ${ maxTop.toFixed(3) } ≤ ${ WINDOW_TOP_NDC.toFixed(3) }, bottom ${ minBottom.toFixed(3) } ≥ ${ WINDOW_BOTTOM_NDC.toFixed(3) })`)
}

/**
 * 3. Iso slots don't overlap on screen (screen-space centre distances)
 */
function screenXY(offset, aspect)
{
    const fit = Math.min(Math.max(aspect / 1.72, 0.6), 1)
    return [ offset.x * fit, offset.y * fit ]
}
const slotScreens = ISO_SLOTS.map((_, i) => screenXY(isoSlotOffset(i), 1.777))
let minSlot = Infinity
for(let a = 0; a < 4; a++)
    for(let b = a + 1; b < 4; b++)
        minSlot = Math.min(minSlot, Math.hypot(slotScreens[a][0] - slotScreens[b][0], slotScreens[a][1] - slotScreens[b][1]))
// Assembly screen footprint radius ≈ 1.15 half-width · scale 0.5 ≈ 0.58/2
if(minSlot < 0.62)
    problems.push(`iso slots too close on screen: min centre distance ${ minSlot.toFixed(2) }`)
else
    ok(`iso slots well separated (min screen distance ${ minSlot.toFixed(2) })`)

/**
 * 4. Contact shadows stay on the grid (shadow plane reaches ±0.31 in z)
 */
for(const [ sx, sz ] of ISO_SLOTS)
{
    if(Math.abs(sx) + 0.58 > ISO_GRID_EXTENT + 0.35 || Math.abs(sz) + 0.31 > ISO_GRID_EXTENT + 0.35)
        problems.push(`slot (${ sx }, ${ sz }) shadow spills far off the grid`)
}
ok('contact shadows sit on (or near) the grid')

console.log()
if(problems.length)
{
    console.log('PROBLEMS:')
    problems.forEach((p) => console.log('  ✗', p))
    process.exit(1)
}
console.log('ALL GEOMETRY CHECKS PASSED')
