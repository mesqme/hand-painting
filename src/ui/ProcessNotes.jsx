import { useEffect, useRef } from 'react'
import gsap from 'gsap'

import { params } from '../scroll/choreography.js'
import { frameFit } from './frameFit.js'
import {
    ATLAS_X,
    ATLAS_Y,
    ATLAS_DOCK_X,
    ATLAS_DOCK_Y,
    WORLD,
} from '../config.js'

const BAKE_NOTES = [
    null,
    { eyebrow: 'BAKE 01', title: 'Create seams', detail: 'Mark the UV cuts directly on the neutral model.' },
    { eyebrow: 'BAKE 02', title: 'Display UV islands', detail: 'Check the authored TEXCOORD_1 layout.' },
    { eyebrow: 'BAKE 03', title: 'Bake', detail: 'Transfer the gradient colors into the baked texture.' },
]

const PAINT_NOTES = [
    null,
    { eyebrow: 'PHOTOSHOP', title: 'Moving to Photoshop', detail: 'Bring the baked texture forward as the main working asset.' },
    { eyebrow: 'PHOTOSHOP', title: 'Paint the baked texture', detail: 'Paint the 2D sheet and check the same update on the model.' },
]

const KTX_NOTES = [
    null,
    { eyebrow: 'KTX2', title: 'Compress the atlas', detail: 'Keep one square texture and prepare it for GPU delivery.' },
]

const COMBINE_NOTE = {
    eyebrow: 'ATLAS',
    title: 'Combine the textures',
    detail: 'Merge four square sheets into one square atlas.',
}

const BATCH_NOTES = [
    null,
    { eyebrow: 'RED CHANNEL', title: 'Assign materials', detail: 'Store each atlas material ID in the red channel.' },
    { eyebrow: 'GREEN CHANNEL', title: 'Assign geometries', detail: 'Store each geometry ID in the green channel.' },
    { eyebrow: 'B + A CHANNELS', title: 'Reserve custom data', detail: 'Use the remaining channels for state, animation or interaction.' },
    { eyebrow: 'BATCHED MESH', title: 'One draw call', detail: 'Display multiple geometries and materials with one draw call.' },
]

const smooth = (value) =>
{
    const t = Math.min(Math.max(value, 0), 1)
    return t * t * (3 - 2 * t)
}
const lerp = (a, b, t) => a + (b - a) * t

export default function ProcessNotes()
{
    const root = useRef()
    const eyebrow = useRef()
    const title = useRef()
    const detail = useRef()
    const lastKey = useRef('')

    useEffect(() =>
    {
        const update = () =>
        {
            let note = null
            let mode = ''

            if(params.palettePhase > 0)
            {
                note = {
                    eyebrow: 'PALETTE',
                    title: 'Position UVs',
                    detail: 'Move each model part onto the required gradient color.',
                }
                mode = 'palette'
            }
            else if(params.bakePhase > 0)
            {
                note = BAKE_NOTES[Math.round(params.bakePhase)]
                mode = 'bake'
            }
            else if(params.paintPhase > 0)
            {
                note = PAINT_NOTES[Math.round(params.paintPhase)]
                mode = 'paint'
            }
            else if(params.combinePhase > 0)
            {
                note = COMBINE_NOTE
                mode = 'combine'
            }
            else if(params.ktxPhase > 0)
            {
                note = KTX_NOTES[Math.round(params.ktxPhase)]
                mode = 'ktx'
            }
            else if(params.batchPhase > 0)
            {
                note = BATCH_NOTES[Math.round(params.batchPhase)]
                mode = 'batch'
            }

            const element = root.current
            if(!element)
                return

            if(!note)
            {
                element.style.opacity = 0
                element.style.visibility = 'hidden'
                lastKey.current = ''
                return
            }

            const key = `${ mode }-${ note.title }`
            if(key !== lastKey.current)
            {
                eyebrow.current.textContent = note.eyebrow
                title.current.textContent = note.title
                detail.current.textContent = note.detail
                element.dataset.mode = mode
                lastKey.current = key
            }

            const { pxPerUnit } = frameFit()
            let worldX = params.paletteX
            let worldY = params.paletteY
            let halfHeight = WORLD.paletteSize * params.paletteScale * 0.54

            if(mode === 'combine')
            {
                worldX = ATLAS_X
                worldY = ATLAS_Y
                halfHeight = 1.05
            }
            else if(mode === 'ktx')
            {
                const chip = smooth(params.atlasChip)
                const dock = smooth(params.atlasDock)
                worldX = lerp(ATLAS_X, ATLAS_DOCK_X, dock)
                worldY = lerp(ATLAS_Y, ATLAS_DOCK_Y, dock)
                halfHeight = lerp(1.05, 0.56, chip)
            }
            else if(mode === 'batch')
            {
                const phase = Math.round(params.batchPhase)
                worldX = params.frameX
                worldY = - 1.22
                halfHeight = 0

                if(phase === 1)
                {
                    const chip = smooth(params.atlasChip)
                    const inspect = smooth(params.atlasInspect)
                    worldX = ATLAS_DOCK_X
                    worldY = ATLAS_DOCK_Y
                    halfHeight = lerp(1, 0.55, chip) * lerp(1, 1.65, inspect)
                }
            }

            element.style.left = `${ window.innerWidth / 2 + worldX * pxPerUnit }px`
            element.style.top = `${ window.innerHeight / 2 - worldY * pxPerUnit + halfHeight * pxPerUnit + 12 }px`
            element.style.transform = 'translateX(-50%)'
            element.style.opacity = 1
            element.style.visibility = 'visible'
        }

        gsap.ticker.add(update)
        return () => gsap.ticker.remove(update)
    }, [])

    return (
        <aside ref={ root } className="process-note">
            <p ref={ eyebrow } className="process-note-eyebrow" />
            <p ref={ title } className="process-note-title" />
            <p ref={ detail } className="process-note-detail" />
        </aside>
    )
}
