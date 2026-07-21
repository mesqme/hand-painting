import * as THREE from 'three'
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'

import { ensureLibrary, textureLibrary } from './textureLibrary.js'
import { params } from '../scroll/choreography.js'
import { COLORS, ROW_X, WORLD } from '../config.js'

/**
 * Acts 07-09 — the texture side of the combine story. Four sheets appear
 * beneath the crew's line-up, fly into a single 2×2 atlas, compress into a
 * stamped KTX2 chip, and in act 09 the chip carries the combined texture into
 * the scene window where it applies to the whole crew.
 */
const ATLAS_Y = 0.08
const SHEET_START_SIZE = 0.62
const SHEET_END_SIZE = 0.88
const QUADRANTS = [ [ - 0.44, 0.44 ], [ 0.44, 0.44 ], [ - 0.44, - 0.44 ], [ 0.44, - 0.44 ] ]

const smooth = (t) => t * t * (3 - 2 * t)
const clamp01 = (value) => Math.min(Math.max(value, 0), 1)
const lerp = (a, b, t) => a + (b - a) * t

export default function AtlasCombine()
{
    const group = useRef()
    const atlas = useRef()
    const stamp = useRef()
    const sheets = useRef([])

    const gradientTexture = useTexture('./textures/gradientPalette.png')

    const { sheetMaterials, stampMaterial } = useMemo(() =>
    {
        ensureLibrary(gradientTexture)

        // Each sheet must show the texture the crew member above it wears, keyed
        // by ROW_X occupant: [knot moss, hero warm, duck warm, torus dusk]
        const SHEET_ENTRIES = [ 2, 1, 1, 3 ]
        const sheetMaterials = SHEET_ENTRIES.map((entryIndex) =>
        {
            const entry = textureLibrary.entries[entryIndex]
            return new THREE.MeshBasicMaterial({ map: entry.texture, transparent: true, opacity: 0 })
        })
        const stampMaterial = new THREE.MeshBasicMaterial({ map: makeStampTexture(), transparent: true })

        return { sheetMaterials, stampMaterial }
    }, [gradientTexture])

    useFrame((state) =>
    {
        const elapsed = state.clock.elapsedTime

        const chipToCrew = smooth(clamp01(params.chipToCrew))
        const sheetOpacity = clamp01(params.sheetsIn * 1.5) * (1 - smooth(clamp01((params.chipToCrew - 0.55) / 0.45)))

        group.current.visible = sheetOpacity > 0.002
        if(!group.current.visible)
            return

        // Sheets fly from under each crew member into the 2×2 atlas
        sheets.current.forEach((sheet, index) =>
        {
            if(!sheet)
                return

            const fly = smooth(clamp01((params.atlasFly * 1.18 - index * 0.06)))
            const startX = ROW_X[index]
            const startY = - 1.05 - ATLAS_Y
            const [ endX, endY ] = QUADRANTS[index]

            sheet.position.x = startX + (endX - startX) * fly
            sheet.position.y = startY + (endY - startY) * fly
            sheet.scale.setScalar(SHEET_START_SIZE + (SHEET_END_SIZE - SHEET_START_SIZE) * fly)
            sheetMaterials[index].opacity = sheetOpacity
        })

        /**
         * Atlas → KTX2 chip; once compact it floats, and in act 09 it flies
         * into the scene window to deliver the combined texture
         */
        const chip = smooth(clamp01(params.atlasChip))
        const idle = Math.max(chip, smooth(clamp01(params.atlasFly)))

        const chipScale = (1 - 0.58 * chip) * (1 - 0.45 * chipToCrew)
        atlas.current.scale.setScalar(Math.max(chipScale, 0.0001))
        atlas.current.position.x = lerp(chip * 0.85, WORLD.zooFrameX, chipToCrew)
        atlas.current.position.y = ATLAS_Y + Math.sin(elapsed * 0.9) * 0.05 * idle * (1 - chipToCrew) - 0.25 * chipToCrew
        atlas.current.rotation.z = (Math.sin(elapsed * 0.55) * 0.05 - 0.03) * idle

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
