// Headless geometric verification of the iteration-5 fixes (grid containment,
// row-crossing separation) — since the browser pane is unavailable.
import { ISO, ISO_SLOTS, isoPoint, isoSlotOffset, ROW_X, ROW_Y, ROW_SCALE, HERO_SLOT } from '../src/config.js'

const problems = []
const ok = (m) => console.log('  ok —', m)

// Camera + stage projection (matches Experience/SceneWindow): fov 33 at (0,0.1,8.6)
const FOV = 33
const CAM_Y = 0.1
const CAM_Z = 8.6
const tanHalf = Math.tan((FOV / 2) * Math.PI / 180)

// Window bottom border in NDC. Window is 72vh tall, top:50%, translateY(-52%):
// bottom fraction-from-top = 0.5 - 0.52·0.72 + 0.72 = 0.8456; NDC = 1 - 2·frac
const WINDOW_BOTTOM_NDC = 1 - 2 * (0.5 - 0.52 * 0.72 + 0.72)   // = -0.6912

function projectNDCy(worldY, aspect)
{
    const fit = Math.min(Math.max(aspect / 1.72, 0.6), 1)
    const y = worldY * fit
    return (y - CAM_Y) / (tanHalf * CAM_Z)
}

/**
 * 1. Grid containment — replicate Crew's chamfered grid, project every vertex
 */
const extent = 1.9
const step = 0.475
const clip = 1.7
const gridPts = []
for(let x = - extent; x <= extent + 0.001; x += step)
{
    const zEnd = Math.min(extent, x + clip)
    if(zEnd > - extent + 0.001) gridPts.push([ x, - extent ], [ x, zEnd ])
}
for(let z = - extent; z <= extent + 0.001; z += step)
{
    const xStart = Math.max(- extent, z - clip)
    if(xStart < extent - 0.001) gridPts.push([ xStart, z ], [ extent, z ])
}

for(const aspect of [ 1.0, 1.6, 1.777, 2.0 ])
{
    let lowest = Infinity
    for(const [ gx, gz ] of gridPts)
    {
        const p = isoPoint(gx, 0, gz)
        const worldY = ISO.centerY + p.y
        lowest = Math.min(lowest, projectNDCy(worldY, aspect))
    }
    if(lowest < WINDOW_BOTTOM_NDC - 0.001)
        problems.push(`grid front edge NDC ${ lowest.toFixed(3) } below window bottom ${ WINDOW_BOTTOM_NDC.toFixed(3) } at aspect ${ aspect }`)
    else
        ok(`grid contained at aspect ${ aspect } (lowest NDC ${ lowest.toFixed(3) } ≥ ${ WINDOW_BOTTOM_NDC.toFixed(3) })`)
}

/**
 * 2. Iso slots don't overlap on screen (screen-space centre distances)
 */
function screenXY(offset, aspect)
{
    const fit = Math.min(Math.max(aspect / 1.72, 0.6), 1)
    return [ offset.x * fit, (ISO.centerY + offset.y) * fit ]
}
const slotScreens = ISO_SLOTS.map((_, i) => screenXY(isoSlotOffset(i), 1.777))
let minSlot = Infinity
for(let a = 0; a < 4; a++)
    for(let b = a + 1; b < 4; b++)
        minSlot = Math.min(minSlot, Math.hypot(slotScreens[a][0] - slotScreens[b][0], slotScreens[a][1] - slotScreens[b][1]))
// Assembly screen footprint radius ≈ 1.15 half-width · scale 0.55 ≈ 0.63/2
if(minSlot < 0.7)
    problems.push(`iso slots too close on screen: min centre distance ${ minSlot.toFixed(2) }`)
else
    ok(`iso slots well separated (min screen distance ${ minSlot.toFixed(2) })`)

/**
 * 3. Row-formation crossing — simulate the real eased paths, hero vs members
 */
const MEMBERS = [
    { slot: 0, row: 2, arc: 0.55 },
    { slot: 2, row: 0, arc: 0 },
    { slot: 3, row: 3, arc: - 0.55 },
]
const power2InOut = (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(- 2 * t + 2, 2) / 2

// Hero glides iso slot-1 → row (both power2.inOut in the timeline)
const heroFrom = isoSlotOffset(HERO_SLOT)
const heroTo = { x: ROW_X[HERO_SLOT], y: ROW_Y, z: 0 }
const FRAME = WORLD_artist()
function WORLD_artist() { return - 0.2 }  // artist frame; row happens as frame fades — use 0 shift after clamp on landscape

let minPair = Infinity
for(let s = 0; s <= 1.001; s += 0.02)
{
    const rowT = power2InOut(Math.min(s, 1))
    const hero = {
        x: heroFrom.x + (heroTo.x - heroFrom.x) * rowT,
        y: heroFrom.y + (heroTo.y - heroFrom.y) * rowT,
        z: heroFrom.z + (heroTo.z - heroFrom.z) * rowT,
    }
    for(const m of MEMBERS)
    {
        const iso = isoSlotOffset(m.slot)
        const body = {
            x: iso.x + (ROW_X[m.row] - iso.x) * rowT,
            y: iso.y + (ROW_Y - iso.y) * rowT,
            z: iso.z + (0 - iso.z) * rowT + m.arc * Math.sin(Math.PI * rowT),
        }
        minPair = Math.min(minPair, Math.hypot(hero.x - body.x, hero.y - body.y, hero.z - body.z))
    }
}
if(minPair < 0.7)
    problems.push(`row crossing min hero-member distance ${ minPair.toFixed(3) } (assemblies would clip)`)
else
    ok(`row crossing clears (min hero-member distance ${ minPair.toFixed(3) })`)

console.log()
if(problems.length)
{
    console.log('PROBLEMS:')
    problems.forEach((p) => console.log('  ✗', p))
    process.exit(1)
}
console.log('ALL GEOMETRY CHECKS PASSED')
