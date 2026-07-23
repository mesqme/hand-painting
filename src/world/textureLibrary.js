import * as THREE from 'three'

import useStage from '../stores/useStage.jsx'

/**
 * Texture library
 *
 * Hero duck maps (real files):
 *   duck_base          — the hand-paint reveal target
 *   duck_baked         — bake-step result (mapBase after the bake sweep)
 *   duck_pastel /
 *   duck_red /
 *   duck_base_abberation — the intro look and final live-update choice
 *
 * The gradient palette stays for act 02 (and as a uv0-friendly stand-in for
 * the crew, whose meshes don't share the duck's uv1 unwrap). Dropping any
 * PNG on the page still appends a live swatch to the dropdown.
 */
export const textureLibrary = {
    gradient: null,
    baked: null,
    base: null,
    aberration: null,
    entries: [],
    crewPaints: [],
}

// Dropdown-only variants (act 06). Order = scripted demo scan order.
const DROPDOWN_VARIANTS = [
    { id: 'pastel', label: 'paint · pastel', key: 'pastel' },
    { id: 'red', label: 'paint · red', key: 'red' },
    { id: 'aberration', label: 'paint · aberration', key: 'aberration' },
]

let dropCount = 0

/**
 * glTF UV convention — every map sampled by the model keeps flipY false
 */
export function prepareMapTexture(texture)
{
    texture.flipY = false
    texture.colorSpace = THREE.SRGBColorSpace
    texture.needsUpdate = true
    return texture
}

/**
 * @param {object} maps — { gradient, baked, base, pastel, red, aberration }
 */
export function ensureLibrary(maps)
{
    if(textureLibrary.entries.length > 0)
        return textureLibrary

    const gradient = prepareMapTexture(maps.gradient)
    const baked = prepareMapTexture(maps.baked)
    const base = prepareMapTexture(maps.base)

    textureLibrary.gradient = gradient
    textureLibrary.baked = baked
    textureLibrary.base = base

    for(const variant of DROPDOWN_VARIANTS)
    {
        const texture = prepareMapTexture(maps[variant.key])
        textureLibrary.entries.push({
            id: variant.id,
            label: variant.label,
            texture,
            thumb: makeThumb(texture.image),
        })
    }

    textureLibrary.aberration = textureLibrary.entries.find((entry) => entry.id === 'aberration')?.texture ?? base

    // Crew / atlas stand-ins — hue-shifted gradients that still read on uv0
    // (crew meshes don't share the duck's uv1 unwrap)
    textureLibrary.crewPaints = [
        { id: 'crew-warm', texture: makeCrewPaint(gradient, 'hue-rotate(-32deg) saturate(1.65) brightness(1.05)') },
        { id: 'crew-moss', texture: makeCrewPaint(gradient, 'hue-rotate(120deg) saturate(1.05) brightness(0.97)') },
        { id: 'crew-dusk', texture: makeCrewPaint(gradient, 'hue-rotate(225deg) saturate(1.2) brightness(0.9)') },
    ]

    pushSwatches()
    useStage.setState({ activeSwatch: 'aberration' })

    return textureLibrary
}

export function getTextureById(id)
{
    if(id === 'base')
        return textureLibrary.base
    if(id === 'baked')
        return textureLibrary.baked

    const entry = textureLibrary.entries.find((entry) => entry.id === id)
    return entry ? entry.texture : null
}

export function getPaintedDefault()
{
    return textureLibrary.aberration
}

export function getBakedTexture()
{
    return textureLibrary.baked
}

/**
 * Artist flow — a dropped image file becomes a live swatch
 */
export function addDroppedTexture(file)
{
    return new Promise((resolve, reject) =>
    {
        const url = URL.createObjectURL(file)
        const image = new Image()

        image.onload = () =>
        {
            const canvas = document.createElement('canvas')
            canvas.width = 1024
            canvas.height = 1024
            const context = canvas.getContext('2d')
            context.drawImage(image, 0, 0, 1024, 1024)
            URL.revokeObjectURL(url)

            dropCount++
            const entry = {
                id: `drop-${ dropCount }`,
                label: file.name.replace(/\.[^.]+$/, '').slice(0, 18),
                texture: prepareMapTexture(new THREE.CanvasTexture(canvas)),
                thumb: makeThumb(canvas),
            }
            textureLibrary.entries.push(entry)
            pushSwatches()
            resolve(entry)
        }

        image.onerror = () =>
        {
            URL.revokeObjectURL(url)
            reject(new Error('Could not read image'))
        }

        image.src = url
    })
}

/**
 * Helpers
 */
function pushSwatches()
{
    // Base begins the artist comparison; the three variants (+ any dropped
    // files) complete the choosable list.
    const swatches = [
        { id: 'base', label: 'paint · base', thumb: makeThumb(textureLibrary.base.image) },
        ...textureLibrary.entries.map((entry) =>
        {
            return { id: entry.id, label: entry.label, thumb: entry.thumb }
        }),
    ]
    useStage.getState().setSwatches(swatches)
}

function makeCrewPaint(gradient, filter)
{
    const canvas = paintVariantCanvas(gradient.image, filter)
    return prepareMapTexture(new THREE.CanvasTexture(canvas))
}

function paintVariantCanvas(image, filter)
{
    const canvas = document.createElement('canvas')
    canvas.width = 1024
    canvas.height = 1024
    const context = canvas.getContext('2d')

    context.filter = filter
    context.drawImage(image, 0, 0, 1024, 1024)
    context.filter = 'none'

    for(let i = 0; i < 170; i++)
    {
        const x = Math.random() * 1024
        const y = Math.random() * 1024
        const radiusX = 14 + Math.random() * 56
        const radiusY = radiusX * (0.35 + Math.random() * 0.5)
        const rotation = Math.random() * Math.PI

        context.globalAlpha = 0.04 + Math.random() * 0.05
        context.globalCompositeOperation = Math.random() < 0.5 ? 'multiply' : 'screen'
        context.fillStyle = Math.random() < 0.5 ? '#3a3630' : '#ffffff'
        context.beginPath()
        context.ellipse(x, y, radiusX, radiusY, rotation, 0, Math.PI * 2)
        context.fill()
    }
    context.globalAlpha = 1
    context.globalCompositeOperation = 'source-over'

    return canvas
}

function makeThumb(source)
{
    const canvas = document.createElement('canvas')
    canvas.width = 96
    canvas.height = 96
    const context = canvas.getContext('2d')
    context.drawImage(source, 0, 0, 96, 96)
    return canvas.toDataURL('image/png')
}
