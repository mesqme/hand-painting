import * as THREE from 'three'
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'

import useDuckColumn from './useDuckColumn.jsx'
import { createAssetMaterial, updateAssetMaterial } from './materials/assetMaterial.js'
import { ensureLibrary, textureLibrary } from './textureLibrary.js'
import { params } from '../scroll/choreography.js'
import { COLORS } from '../config.js'

/**
 * Steps 06 + 07 — four painted assets with a sheet each; the sheets fly into
 * a single 2×2 atlas, which then compresses into a stamped KTX2 chip.
 */
const MINIS_X = [ - 2.7, - 0.9, 0.9, 2.7 ]
const MINI_Y = 0.34
const MINI_SCALE = 0.42
const ATLAS_Y = 0.08
const SHEET_START_SIZE = 0.62
const SHEET_END_SIZE = 0.88
const QUADRANTS = [ [ - 0.44, 0.44 ], [ 0.44, 0.44 ], [ - 0.44, - 0.44 ], [ 0.44, - 0.44 ] ]

const easeOutBack = (t) =>
{
    const c1 = 1.70158
    const c3 = c1 + 1
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}

const smooth = (t) => t * t * (3 - 2 * t)

const clamp01 = (value) => Math.min(Math.max(value, 0), 1)

export default function AtlasCombine()
{
    const group = useRef()
    const atlas = useRef()
    const stamp = useRef()
    const minis = useRef([])
    const sheets = useRef([])

    const { duckGeometry, columnGeometry } = useDuckColumn()
    const gradientTexture = useTexture('./textures/gradientPalette.png')

    const { miniMaterials, sheetMaterials, stampMaterial } = useMemo(() =>
    {
        ensureLibrary(gradientTexture)
        const entries = textureLibrary.entries.slice(0, 4)

        const miniMaterials = entries.map((entry) => createAssetMaterial({ mapBase: entry.texture, whiteMix: 0 }))
        const sheetMaterials = entries.map((entry) =>
        {
            return new THREE.MeshBasicMaterial({ map: entry.texture, transparent: true, opacity: 0 })
        })
        const stampMaterial = new THREE.MeshBasicMaterial({ map: makeStampTexture(), transparent: true })

        return { miniMaterials, sheetMaterials, stampMaterial }
    }, [gradientTexture])

    useFrame((state) =>
    {
        const elapsed = state.clock.elapsedTime

        group.current.visible = params.minisIn > 0.005 && params.atlasOut < 0.995

        const minisOut = smooth(clamp01(params.minisOut))
        const sheetOpacity = clamp01(params.minisIn * 1.5) * (1 - smooth(clamp01(params.atlasOut)))

        // Minis pop in, then leave when the atlas takes over
        minis.current.forEach((mini, index) =>
        {
            if(!mini)
                return

            const raw = clamp01((params.minisIn - index * 0.1) / 0.65)
            const pop = easeOutBack(raw) * (1 - minisOut)
            mini.scale.setScalar(Math.max(MINI_SCALE * pop, 0.0001))
            mini.position.y = MINI_Y + Math.sin(elapsed * 1.15 + index * 1.7) * 0.045
            updateAssetMaterial(miniMaterials[index], { opacity: clamp01(params.minisIn * 2) * (1 - minisOut) })
        })

        // Sheets fly from under each mini into the 2×2 atlas
        sheets.current.forEach((sheet, index) =>
        {
            if(!sheet)
                return

            const fly = smooth(clamp01((params.atlasFly * 1.18 - index * 0.06)))
            const startX = MINIS_X[index]
            const startY = - 1.05 - ATLAS_Y
            const [ endX, endY ] = QUADRANTS[index]

            sheet.position.x = startX + (endX - startX) * fly
            sheet.position.y = startY + (endY - startY) * fly
            const size = SHEET_START_SIZE + (SHEET_END_SIZE - SHEET_START_SIZE) * fly
            sheet.scale.setScalar(size)
            sheetMaterials[index].opacity = sheetOpacity
        })

        // Atlas → KTX2 chip, drifting right to balance the terminal panel
        const chip = smooth(clamp01(params.atlasChip))
        atlas.current.scale.setScalar(1 - 0.58 * chip)
        atlas.current.position.y = ATLAS_Y
        atlas.current.position.x = chip * 0.85

        const stampPop = easeOutBack(clamp01((params.atlasChip - 0.62) / 0.38))
        stamp.current.scale.setScalar(Math.max(stampPop, 0.0001))
        stamp.current.visible = stampPop > 0.01
        stampMaterial.opacity = sheetOpacity
    })

    return (
        <group ref={ group }>
            { MINIS_X.map((x, index) =>
                <group
                    key={ index }
                    ref={ (instance) => { minis.current[index] = instance } }
                    position={ [ x, MINI_Y, 0 ] }
                    rotation-y={ index * 0.45 - 0.65 }
                >
                    <mesh geometry={ columnGeometry } material={ miniMaterials[index] } />
                    <mesh geometry={ duckGeometry } material={ miniMaterials[index] } />
                </group>
            ) }

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
