import * as THREE from 'three'
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'

import { ensureLibrary, textureLibrary } from './textureLibrary.js'
import { clampFrameX } from '../ui/frameFit.js'
import { params } from '../scroll/choreography.js'
import { COLORS, ATLAS_X, isoSlotOffset } from '../config.js'

/**
 * Acts 07 / 08 — four clearly separated 2D texture cards move into one atlas,
 * then the atlas compresses into KTX2. Cards render in front of the 3D scene
 * with depth testing disabled, because they represent material data rather
 * than objects in the world.
 */
const ATLAS_Y = 0.02
const CARD_START_SCALE = 0.58
const CARD_END_SCALE = 0.78

/**
 * Screen arrangement requested for the scene:
 *   book ←   meat ↑   duck →   barrel ↓
 *
 * The atlas destination preserves that clockwise order so paths never cross:
 *   book top-left, meat top-right, duck bottom-right, barrel bottom-left.
 */
const SHEET_SOURCES = [
    {
        slot: 0,
        crew: 0,
        label: 'barrel',
        offset: [ 0, - 0.72 ],
        quadrant: [ - 0.46, - 0.52 ],
    },
    {
        slot: 1,
        hero: true,
        label: 'duck · aberration',
        offset: [ 0.78, 0 ],
        quadrant: [ 0.46, - 0.52 ],
    },
    {
        slot: 2,
        crew: 1,
        label: 'book',
        offset: [ - 0.78, 0 ],
        quadrant: [ - 0.46, 0.52 ],
    },
    {
        slot: 3,
        crew: 2,
        label: 'meat',
        offset: [ 0, 0.72 ],
        quadrant: [ 0.46, 0.52 ],
    },
]

const smooth = (value) =>
{
    const t = Math.min(Math.max(value, 0), 1)
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
    const backing = useRef()
    const sheets = useRef([])

    const maps = useTexture({
        gradient: './textures/gradientPalette.png',
        baked: './textures/duck_baked.png',
        base: './textures/duck_base.png',
        pastel: './textures/duck_pastel.png',
        red: './textures/duck_red.png',
        aberration: './textures/duck_base_abberation.png',
    })

    const { sheetMaterials, backingMaterial, stampMaterial } = useMemo(() =>
    {
        ensureLibrary(maps)

        const sheetMaterials = SHEET_SOURCES.map((source) =>
        {
            const texture = source.hero
                ? textureLibrary.aberration
                : textureLibrary.crewPaints[source.crew]?.texture
            const cardTexture = makeTextureCard(texture.image, source.label)
            const material = new THREE.MeshBasicMaterial({
                map: cardTexture,
                transparent: true,
                opacity: 0,
                depthTest: false,
                depthWrite: false,
            })
            material.toneMapped = false
            return material
        })

        const backingMaterial = new THREE.MeshBasicMaterial({
            color: COLORS.card,
            transparent: true,
            opacity: 0,
            depthTest: false,
            depthWrite: false,
        })
        const stampMaterial = new THREE.MeshBasicMaterial({
            map: makeStampTexture(),
            transparent: true,
            opacity: 0,
            depthTest: false,
            depthWrite: false,
        })

        return { sheetMaterials, backingMaterial, stampMaterial }
    }, [maps])

    useFrame((state) =>
    {
        const sheetIn = smooth(params.sheetsIn)
        const fly = smooth(params.atlasFly)
        const chip = smooth(params.atlasChip)
        const batchStage = smooth(params.batchData)
        const opacity = sheetIn

        group.current.visible = opacity > 0.002
        if(!group.current.visible)
            return

        const fit = THREE.MathUtils.clamp(state.viewport.aspect / 1.72, 0.6, 1)
        const halfVisible = (state.viewport.width / 2) / fit
        const atlasX = Math.min(ATLAS_X, halfVisible - 1.08)

        const compressedX = lerp(atlasX, 0.85, chip)
        const batchX = clampFrameX(params.frameX) - 2.45
        atlas.current.position.x = lerp(compressedX, batchX, batchStage)
        atlas.current.position.y = lerp(ATLAS_Y, 1.42, batchStage)
        atlas.current.rotation.z = 0
        atlas.current.scale.setScalar((1 - chip * 0.58) * lerp(1, 0.62, batchStage))

        const frameX = clampFrameX(params.frameX)
        SHEET_SOURCES.forEach((source, index) =>
        {
            const sheet = sheets.current[index]
            if(!sheet)
                return

            const iso = isoSlotOffset(source.slot)
            const startX = frameX + iso.x + source.offset[0] - atlas.current.position.x
            const startY = iso.y + source.offset[1] - atlas.current.position.y
            const endX = source.quadrant[0]
            const endY = source.quadrant[1]

            // The control point bends outward in the card's own arrow
            // direction. With the preserved quadrant order, paths remain
            // disjoint throughout the flight.
            const controlX = (startX + endX) * 0.5 + source.offset[0] * 0.34
            const controlY = (startY + endY) * 0.5 + source.offset[1] * 0.34

            sheet.position.x = quadratic(startX, controlX, endX, fly)
            sheet.position.y = quadratic(startY, controlY, endY, fly)
            sheet.position.z = lerp(1.9, 0.06 + index * 0.006, fly)
            sheet.scale.setScalar(lerp(CARD_START_SCALE, CARD_END_SCALE, fly))
            sheetMaterials[index].opacity = opacity
            sheet.renderOrder = 30 + index
        })

        const atlasReady = smooth((params.atlasFly - 0.66) / 0.34)
        backingMaterial.opacity = opacity * atlasReady * 0.96
        backing.current.visible = backingMaterial.opacity > 0.002

        const stampPop = smooth((params.atlasChip - 0.55) / 0.45)
        stamp.current.scale.setScalar(Math.max(stampPop, 0.0001))
        stamp.current.visible = stampPop > 0.01
        stampMaterial.opacity = opacity
        stamp.current.renderOrder = 40
    })

    return (
        <group ref={ group }>
            <group ref={ atlas } position={ [ 0, ATLAS_Y, 0.55 ] }>
                <mesh ref={ backing } material={ backingMaterial } position-z={ 0.01 } renderOrder={ 29 }>
                    <planeGeometry args={ [ 1.93, 2.14 ] } />
                </mesh>

                { SHEET_SOURCES.map((source, index) =>
                    <mesh
                        key={ source.label }
                        ref={ (instance) => { sheets.current[index] = instance } }
                        material={ sheetMaterials[index] }
                    >
                        <planeGeometry args={ [ 1, 1.12 ] } />
                    </mesh>
                ) }

                <mesh ref={ stamp } material={ stampMaterial } position={ [ 0, 0, 0.1 ] } rotation-z={ - 0.04 }>
                    <planeGeometry args={ [ 1.5, 0.66 ] } />
                </mesh>
            </group>
        </group>
    )
}

function makeTextureCard(source, label)
{
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 574
    const context = canvas.getContext('2d')

    context.fillStyle = '#f5f2ed'
    roundRect(context, 3, 3, 506, 568, 20)
    context.fill()

    context.strokeStyle = 'rgba(59, 58, 56, 0.34)'
    context.lineWidth = 3
    roundRect(context, 5, 5, 502, 564, 18)
    context.stroke()

    context.save()
    roundRect(context, 20, 20, 472, 472, 11)
    context.clip()
    context.drawImage(source, 20, 20, 472, 472)
    context.restore()

    context.fillStyle = '#3b3a38'
    context.font = '500 22px Jost, "Segoe UI", sans-serif'
    context.textAlign = 'left'
    context.textBaseline = 'middle'
    context.fillText(label, 24, 532)

    context.fillStyle = '#e78a2e'
    context.beginPath()
    context.arc(476, 532, 6, 0, Math.PI * 2)
    context.fill()

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

    context.strokeStyle = 'rgba(255, 255, 255, 0.75)'
    context.lineWidth = 5
    roundRect(context, 18, 18, 476, 188, 18)
    context.stroke()

    context.fillStyle = '#faf7f2'
    context.font = '700 108px Jost, "Century Gothic", sans-serif'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText('KTX2', 256, 112)

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
