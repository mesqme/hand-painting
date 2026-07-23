import * as THREE from 'three'
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'

import { ensureLibrary, textureLibrary } from './textureLibrary.js'
import { clampFrameX } from '../ui/frameFit.js'
import { params } from '../scroll/choreography.js'
import { COLORS, ATLAS_X, isoSlotOffset, WORLD } from '../config.js'

/**
 * Acts 07-09 — the texture side of the combine story. The crew never leaves
 * the scene window: each member's texture sheet appears UPON its model, the
 * four sheets fly into a single 2×2 atlas docked right, compress into a
 * stamped KTX2 chip, and in act 09 the chip carries the combined texture into
 * the scene window where it applies to the whole crew.
 */
const ATLAS_Y = 0.08
const SHEET_START_SIZE = 0.5
const SHEET_END_SIZE = 0.88
const QUADRANTS = [ [ - 0.44, 0.44 ], [ 0.44, 0.44 ], [ - 0.44, - 0.44 ], [ 0.44, - 0.44 ] ]

// Which crew slot each quadrant's sheet lifts off from, and the paint that
// model wears (crew stand-ins + hero base). Hero slot uses duck_base.
const SHEET_SOURCES = [
    { slot: 0, crew: 0 },
    { slot: 1, hero: true },
    { slot: 2, crew: 1 },
    { slot: 3, crew: 2 },
]

const smooth = (t) => t * t * (3 - 2 * t)
const clamp01 = (value) => Math.min(Math.max(value, 0), 1)
const lerp = (a, b, t) => a + (b - a) * t

export default function AtlasCombine()
{
    const group = useRef()
    const atlas = useRef()
    const stamp = useRef()
    const sheets = useRef([])

    const maps = useTexture({
        gradient: './textures/gradientPalette.png',
        baked: './textures/duck_baked.png',
        base: './textures/duck_base.png',
        pastel: './textures/duck_pastel.png',
        red: './textures/duck_red.png',
        aberration: './textures/duck_base_abberation.png',
    })

    const { sheetMaterials, stampMaterial } = useMemo(() =>
    {
        ensureLibrary(maps)

        const sheetMaterials = SHEET_SOURCES.map((source) =>
        {
            const texture = source.hero
                ? textureLibrary.base
                : textureLibrary.crewPaints[source.crew]?.texture
            return new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: 0 })
        })
        const stampMaterial = new THREE.MeshBasicMaterial({ map: makeStampTexture(), transparent: true })

        return { sheetMaterials, stampMaterial }
    }, [maps])

    useFrame((state) =>
    {
        const chipToCrew = smooth(clamp01(params.chipToCrew))
        const sheetOpacity = clamp01(params.sheetsIn * 1.5) * (1 - smooth(clamp01((params.chipToCrew - 0.55) / 0.45)))

        group.current.visible = sheetOpacity > 0.002
        if(!group.current.visible)
            return

        // Right dock for the atlas, clamped on-screen like the palette sheet
        const fit = THREE.MathUtils.clamp(state.viewport.aspect / 1.72, 0.6, 1)
        const halfVisible = (state.viewport.width / 2) / fit
        const atlasX = Math.min(ATLAS_X, halfVisible - 1.0)

        /**
         * Atlas → KTX2 chip; in act 09 it flies into the scene window to
         * deliver the combined texture. The sheet/atlas stays STABLE (no idle
         * float) — it's a 2D texture, not a floating 3D object.
         */
        const chip = smooth(clamp01(params.atlasChip))

        const chipScale = (1 - 0.58 * chip) * (1 - 0.45 * chipToCrew)
        atlas.current.scale.setScalar(Math.max(chipScale, 0.0001))
        atlas.current.position.x = lerp(lerp(atlasX, 0.85, chip), WORLD.zooFrameX, chipToCrew)
        atlas.current.position.y = ATLAS_Y - 0.25 * chipToCrew
        atlas.current.rotation.z = 0

        // Sheets lift off the models (which HOLD their scene-window slots) and
        // fly into the 2×2 atlas. Start poses are world-space model centers
        // converted into atlas-local space.
        const frameX = clampFrameX(params.frameX)
        sheets.current.forEach((sheet, index) =>
        {
            if(!sheet)
                return

            const fly = smooth(clamp01((params.atlasFly * 1.18 - index * 0.06)))
            const iso = isoSlotOffset(SHEET_SOURCES[index].slot)
            const startX = frameX + iso.x - atlas.current.position.x
            const startY = iso.y - atlas.current.position.y
            const startZ = iso.z + 0.4 - 0.55
            const [ endX, endY ] = QUADRANTS[index]

            sheet.position.x = startX + (endX - startX) * fly
            sheet.position.y = startY + (endY - startY) * fly
            sheet.position.z = startZ * (1 - fly)
            sheet.scale.setScalar(SHEET_START_SIZE + (SHEET_END_SIZE - SHEET_START_SIZE) * fly)
            sheetMaterials[index].opacity = sheetOpacity
        })

        const stampPop = clamp01((params.atlasChip - 0.62) / 0.38)
        stamp.current.scale.setScalar(Math.max(stampPop, 0.0001))
        stamp.current.visible = stampPop > 0.01
        stampMaterial.opacity = sheetOpacity
    })

    return (
        <group ref={ group }>
            <group ref={ atlas } position={ [ 0, ATLAS_Y, 0.55 ] }>
                { QUADRANTS.map((quadrant, index) =>
                    <mesh
                        key={ index }
                        ref={ (instance) => { sheets.current[index] = instance } }
                        material={ sheetMaterials[index] }
                    >
                        <planeGeometry args={ [ 1, 1 ] } />
                    </mesh>
                ) }

                <mesh ref={ stamp } material={ stampMaterial } position={ [ 0, 0, 0.06 ] } rotation-z={ - 0.1 }>
                    <planeGeometry args={ [ 1.5, 0.66 ] } />
                </mesh>
            </group>
        </group>
    )
}

/**
 * Canvas-drawn KTX2 stamp
 */
function makeStampTexture()
{
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 224
    const context = canvas.getContext('2d')

    context.fillStyle = COLORS.accent
    roundRect(context, 6, 6, 500, 212, 26)
    context.fill()

    context.strokeStyle = 'rgba(255, 255, 255, 0.75)'
    context.lineWidth = 5
    roundRect(context, 18, 18, 476, 188, 18)
    context.stroke()

    context.fillStyle = '#faf7f2'
    context.font = '700 108px Jost, "Century Gothic", sans-serif'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText('KTX2', 256, 96)

    context.font = '500 34px Jost, "Century Gothic", sans-serif'
    context.fillText('16.8 MB → 2.1 MB', 256, 170)

    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 4
    return texture
}

function roundRect(context, x, y, width, height, radius)
{
    context.beginPath()
    context.moveTo(x + radius, y)
    context.arcTo(x + width, y, x + width, y + height, radius)
    context.arcTo(x + width, y + height, x, y + height, radius)
    context.arcTo(x, y + height, x, y, radius)
    context.arcTo(x, y, x + width, y, radius)
    context.closePath()
}
