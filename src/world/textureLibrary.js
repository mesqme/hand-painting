import * as THREE from 'three'

import useStage from '../stores/useStage.jsx'

/**
 * Texture library
 *
 * Render-free singleton holding every swatch the tray can apply. Entries carry
 * the live three.js texture plus a small dataURL thumb for the DOM. Painted
 * variants are placeholders generated from the gradient palette until real
 * hand-painted files exist — drop any PNG on the page to add one live.
 */
export const textureLibrary = {
    gradient: null,
    entries: [],
}

const VARIANTS = [
    { id: 'paint-warm', label: 'paint · warm', filter: 'hue-rotate(-32deg) saturate(1.65) brightness(1.05)' },
    { id: 'paint-moss', label: 'paint · moss', filter: 'hue-rotate(120deg) saturate(1.05) brightness(0.97)' },
    { id: 'paint-dusk', label: 'paint · dusk', filter: 'hue-rotate(225deg) saturate(1.2) brightness(0.9)' },
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

export function ensureLibrary(gradientTexture)
{
    if(textureLibrary.entries.length > 0)
        return textureLibrary

    prepareMapTexture(gradientTexture)
    textureLibrary.gradient = gradientTexture

    textureLibrary.entries.push({
        id: 'baked',
        label: 'baked · gradient',
        texture: gradientTexture,
        thumb: makeThumb(gradientTexture.image),
    })

    for(const variant of VARIANTS)
    {
        const canvas = paintVariantCanvas(gradientTexture.image, variant.filter)
        const texture = prepareMapTexture(new THREE.CanvasTexture(canvas))
        textureLibrary.entries.push({
            id: variant.id,
            label: variant.label,
            texture,
            thumb: makeThumb(canvas),
        })
    }

    pushSwatches()

    // The act-05 reveal shows the first painted variant — keep the tray in sync
    useStage.setState({ activeSwatch: textureLibrary.entries[1].id })

    return textureLibrary
}

export function getTextureById(id)
{
    const entry = textureLibrary.entries.find((entry) => entry.id === id)
    return entry ? entry.texture : null
}

export function getPaintedDefault()
{
    return textureLibrary.entries[1]?.texture ?? textureLibrary.gradient
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
    useStage.getState().setSwatches(textureLibrary.entries.map((entry) =>
    {
        return { id: entry.id, label: entry.label, thumb: entry.thumb }
    }))
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

    // Brush pass — soft monochrome dabs so the sheet reads hand-touched
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
