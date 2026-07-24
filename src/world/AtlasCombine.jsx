import * as THREE from 'three'
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'

import { ensureLibrary, textureLibrary } from './textureLibrary.js'
import { clampFrameX } from '../ui/frameFit.js'
import { params } from '../scroll/choreography.js'
import { ATLAS_X, ATLAS_Y, ATLAS_DOCK_X, ATLAS_DOCK_Y, COLORS, isoSlotOffset } from '../config.js'

/**
 * Four borderless square textures first scale up directly over their matching
 * objects, then travel into corresponding atlas quadrants:
 *
 *   book R2  | meat R3
 *   barrel R0| duck R1
 *
 * The 2x2 atlas remains in the live scene for KTX2 and red-channel lookup.
 */
const CARD_START_SCALE = 0.56

const SHEET_SOURCES = [
    { slot: 0, crew: 0, label: 'barrel', red: 0, quadrant: [ - 0.5, - 0.5 ], bend: [ - 0.16, - 0.08 ] },
    { slot: 1, hero: true, label: 'duck', red: 1, quadrant: [ 0.5, - 0.5 ], bend: [ 0.16, - 0.08 ] },
    { slot: 2, crew: 1, label: 'book', red: 2, quadrant: [ - 0.5, 0.5 ], bend: [ - 0.16, 0.08 ] },
    { slot: 3, crew: 2, label: 'meat', red: 3, quadrant: [ 0.5, 0.5 ], bend: [ 0.16, 0.08 ] },
]

const clamp01 = (value) => Math.min(Math.max(value, 0), 1)
const smooth = (value) =>
{
    const t = clamp01(value)
    return t * t * (3 - 2 * t)
}
const lerp = (a, b, t) => a + (b - a) * t

function quadratic(start, control, end, t)
{
    const inverse = 1 - t
    return inverse * inverse * start + 2 * inverse * t * control + t * t * end
}

export default function AtlasCombine()
{
    const group = useRef()
    const atlas = useRef()
    const stamp = useRef()
    const sheets = useRef([])
    const redLabels = useRef([])

    const maps = useTexture({
        gradient: './textures/gradientPalette.png',
        baked: './textures/duck_baked.png',
        base: './textures/duck_base.png',
        pastel: './textures/duck_pastel.png',
        red: './textures/duck_red.png',
        aberration: './textures/duck_base_abberation.png',
        barrel: './textures/barrel.png',
        meat: './textures/meat.png',
    })

    const { sheetMaterials, stampMaterial, redMaterials } = useMemo(() =>
    {
        ensureLibrary(maps)

        const sheetMaterials = SHEET_SOURCES.map((source) =>
        {
            const texture = source.hero
                ? textureLibrary.aberration
                : textureLibrary.crewPaints[source.crew]?.texture
            const material = new THREE.MeshBasicMaterial({
                map: makeSheetTexture(texture.image),
                transparent: true,
                opacity: 0,
                depthTest: false,
                depthWrite: false,
            })
            material.toneMapped = false
            return material
        })

        const stampMaterial = new THREE.MeshBasicMaterial({
            map: makeStampTexture(),
            transparent: true,
            opacity: 0,
            depthTest: false,
            depthWrite: false,
        })

        const redMaterials = SHEET_SOURCES.map((source) =>
        {
            return new THREE.MeshBasicMaterial({
                map: makeIdTexture(`R${ source.red }`, '#c94f43'),
                transparent: true,
                opacity: 0,
                depthTest: false,
                depthWrite: false,
            })
        })

        return { sheetMaterials, stampMaterial, redMaterials }
    }, [maps])

    useFrame((state) =>
    {
        const sheetIn = smooth(params.sheetsIn)
        const fly = smooth(params.atlasFly)
        const chip = smooth(params.atlasChip)
        const inspect = smooth(params.atlasInspect)
        const dock = smooth(params.atlasDock)
        group.current.visible = sheetIn > 0.002
        if(!group.current.visible)
            return

        const fit = THREE.MathUtils.clamp(state.viewport.aspect / 1.72, 0.6, 1)
        const halfVisible = (state.viewport.width / 2) / fit
        const atlasX = Math.min(ATLAS_X, halfVisible - 1.08)
        const frameX = clampFrameX(params.frameX)
        group.current.scale.setScalar(fit)

        // The atlas is a 2D reference pinned to the preview corner. KTX2 and
        // batch inspection may change its scale, never its position.
        atlas.current.position.x = lerp(atlasX, ATLAS_DOCK_X, dock)
        atlas.current.position.y = lerp(ATLAS_Y, ATLAS_DOCK_Y, dock)
        atlas.current.rotation.z = 0
        atlas.current.scale.setScalar(lerp(1, 0.55, chip) * lerp(1, 1.65, inspect))

        SHEET_SOURCES.forEach((source, index) =>
        {
            const sheet = sheets.current[index]
            if(!sheet)
                return

            const iso = isoSlotOffset(source.slot)
            const startX = frameX + iso.x - atlasX
            const startY = iso.y - ATLAS_Y
            const endX = source.quadrant[0]
            const endY = source.quadrant[1]
            const controlX = (startX + endX) * 0.5 + source.bend[0]
            const controlY = (startY + endY) * 0.5 + source.bend[1]

            sheet.position.x = quadratic(startX, controlX, endX, fly)
            sheet.position.y = quadratic(startY, controlY, endY, fly)
            sheet.position.z = lerp(1.9, 0.06 + index * 0.004, fly)
            sheet.scale.setScalar(lerp(CARD_START_SCALE * sheetIn, 1, fly))
            sheetMaterials[index].opacity = sheetIn
            sheet.renderOrder = 30 + index

            const label = redLabels.current[index]
            if(label)
            {
                const lookup = clamp01(params.batchLookup - index)
                const redIn = smooth((lookup - 0.24) / 0.2)
                label.scale.setScalar(Math.max(0.76 + redIn * 0.24, 0.0001))
                label.visible = redIn > 0.002
                label.renderOrder = 52
                redMaterials[index].opacity = redIn
            }
        })

        // Compression completes the complete 2D dock before section 09:
        // compact atlas in the lower-right, KTX2 badge at its lower-right.
        const stampPop = smooth(chip)
        stamp.current.position.x = lerp(0, 0.72, stampPop)
        stamp.current.position.y = lerp(0, - 0.76, stampPop)
        stamp.current.scale.setScalar(Math.max(stampPop * 0.28, 0.0001))
        stamp.current.visible = stampPop > 0.01
        stampMaterial.opacity = sheetIn
        stamp.current.renderOrder = 48
    })

    return (
        <group ref={ group }>
            <group ref={ atlas } position={ [ 0, ATLAS_Y, 0.55 ] }>
                { SHEET_SOURCES.map((source, index) =>
                    <mesh
                        key={ source.label }
                        ref={ (instance) => { sheets.current[index] = instance } }
                        material={ sheetMaterials[index] }
                    >
                        <planeGeometry args={ [ 1, 1 ] } />
                    </mesh>
                ) }

                { SHEET_SOURCES.map((source, index) =>
                    <mesh
                        key={ `red-${ source.label }` }
                        ref={ (instance) => { redLabels.current[index] = instance } }
                        material={ redMaterials[index] }
                        position={ [ source.quadrant[0], source.quadrant[1], 0.12 ] }
                    >
                        <planeGeometry args={ [ 0.5, 0.27 ] } />
                    </mesh>
                ) }

                <mesh ref={ stamp } material={ stampMaterial } position={ [ 0, 0, 0.1 ] }>
                    <planeGeometry args={ [ 1.5, 0.66 ] } />
                </mesh>
            </group>
        </group>
    )
}

function makeSheetTexture(source)
{
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 512
    const context = canvas.getContext('2d')
    context.drawImage(source, 0, 0, 512, 512)

    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.needsUpdate = true
    return texture
}

function makeStampTexture()
{
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 224
    const context = canvas.getContext('2d')

    context.fillStyle = COLORS.accent
    roundRect(context, 6, 6, 500, 212, 26)
    context.fill()
    context.fillStyle = '#faf7f2'
    context.font = '700 108px Jost, "Century Gothic", sans-serif'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText('KTX2', 256, 112)

    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    return texture
}

function makeIdTexture(label, color)
{
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 128
    const context = canvas.getContext('2d')

    context.fillStyle = 'rgba(247, 244, 239, 0.94)'
    roundRect(context, 4, 4, 248, 120, 25)
    context.fill()
    context.strokeStyle = color
    context.lineWidth = 8
    roundRect(context, 7, 7, 242, 114, 22)
    context.stroke()
    context.fillStyle = color
    context.font = '700 72px Cascadia Code, Consolas, monospace'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText(label, 128, 65)

    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    return texture
}

function roundRect(context, x, y, width, height, radius)
{
    context.beginPath()
    context.moveTo(x + radius, y)
    context.lineTo(x + width - radius, y)
    context.quadraticCurveTo(x + width, y, x + width, y + radius)
    context.lineTo(x + width, y + height - radius)
    context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
    context.lineTo(x + radius, y + height)
    context.quadraticCurveTo(x, y + height, x, y + height - radius)
    context.lineTo(x, y + radius)
    context.quadraticCurveTo(x, y, x + radius, y)
}
