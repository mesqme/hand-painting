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
 * Barrel and meat use their authored painted maps. The gradient palette
 * remains the temporary book texture until its painted map arrives. Dropping
 * any PNG on the page still appends a live swatch to the dropdown.
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
 * @param {object} maps — hero maps plus barrel and meat crew maps
 */
export function ensureLibrary(maps)
{
    if(textureLibrary.entries.length > 0)
        return textureLibrary

    const gradient = prepareMapTexture(maps.gradient)
    const baked = prepareMapTexture(maps.baked)
    const base = prepareMapTexture(maps.base)
    const barrel = prepareMapTexture(maps.barrel)
    const meat = prepareMapTexture(maps.meat)

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

    // Crew / atlas maps follow MEMBERS order: barrel, book, meat. Book keeps
    // the gradient placeholder until its painted texture is delivered.
    textureLibrary.crewPaints = [
        { id: 'crew-barrel', texture: barrel },
        { id: 'crew-book', texture: gradient },
        { id: 'crew-meat', texture: meat },
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

function makeThumb(source)
{
    const canvas = document.createElement('canvas')
    canvas.width = 96
    canvas.height = 96
    const context = canvas.getContext('2d')
    context.drawImage(source, 0, 0, 96, 96)
    return canvas.toDataURL('image/png')
}
