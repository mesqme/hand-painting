import { useEffect, useRef } from 'react'
import gsap from 'gsap'

import { params } from '../scroll/choreography.js'
import { frameFit, clampFrameX } from './frameFit.js'
import {
    ATLAS_DOCK_X,
    ATLAS_DOCK_Y,
    WORLD,
} from '../config.js'

const BAKE_NOTES = [
    null,
    { title: 'Create seams', detail: 'Make cuts to form simple-shaped islands.' },
    { title: 'Bake', detail: 'Transfer the gradient colors into the baked texture.' },
]

const PAINT_NOTES = [
    null,
    { title: 'Moving to Photoshop', detail: 'Or use any comfortable software for painting.' },
]

const KTX_NOTES = [
    null,
    { title: 'Compress the atlas', detail: 'Keep one square texture and prepare it for GPU delivery.' },
]

const COMBINE_NOTE = {
    title: 'Combine the textures',
    detail: 'Merge four square sheets into one square atlas.',
}

const BATCH_NOTES = [
    null,
    { title: 'Match geometry to atlas', detail: 'Use each geometry ID to retrieve its UV scale and offset from the atlas.' },
    { title: 'Reserve G, B and A', detail: 'Use the remaining channels for more textures, animation, state or interaction.' },
    { title: 'One draw call', detail: 'Display multiple geometries and materials with one draw call.' },
]

const smooth = (value) =>
{
    const t = Math.min(Math.max(value, 0), 1)
    return t * t * (3 - 2 * t)
}
export default function ProcessNotes()
{
    const root = useRef()
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

            const noteOpacity = smooth(params.noteOpacity)
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
                title.current.textContent = note.title
                detail.current.textContent = note.detail
                element.dataset.mode = mode
                lastKey.current = key
            }

            if(mode === 'batch')
            {
                const phase = Math.round(params.batchPhase)
                const { pxPerUnit } = frameFit()
                const frameCenter = window.innerWidth / 2 + clampFrameX(params.frameX) * pxPerUnit

                if(phase === 3)
                {
                    const perf = document.querySelector('.perf')
                    const rect = perf?.getBoundingClientRect()
                    element.style.left = `${ rect ? rect.left + rect.width / 2 : frameCenter }px`
                    element.style.top = `${ rect ? rect.bottom + 12 : window.innerHeight * 0.32 }px`
                    element.style.width = 'min(360px, 82vw)'
                }
                else
                {
                    element.style.left = `${ frameCenter }px`
                    element.style.top = `${ window.innerHeight / 2 + pxPerUnit * 1.18 }px`
                    element.style.width = 'min(430px, 70vw)'
                }

                element.style.transform = 'translateX(-50%)'
                element.style.opacity = noteOpacity
                element.style.visibility = noteOpacity > 0.002 ? 'visible' : 'hidden'
                return
            }

            element.style.width = ''
            const { pxPerUnit } = frameFit()
            let worldX = params.paletteX
            let worldY = params.paletteY
            let halfHeight = WORLD.paletteSize * params.paletteScale * 0.54

            if(mode === 'bake' && Math.round(params.bakePhase) === 1)
            {
                worldX = params.heroX
                worldY = params.heroY
                halfHeight = WORLD.assemblyHeight * params.heroScale * 0.5
            }
            else if(mode === 'combine')
            {
                worldX = ATLAS_DOCK_X
                worldY = ATLAS_DOCK_Y
                halfHeight = 1.05
            }
            else if(mode === 'ktx')
            {
                worldX = ATLAS_DOCK_X
                worldY = ATLAS_DOCK_Y
                halfHeight = 1.05
            }
            element.style.left = `${ window.innerWidth / 2 + worldX * pxPerUnit }px`
            element.style.top = `${ window.innerHeight / 2 - worldY * pxPerUnit + halfHeight * pxPerUnit + 12 }px`
            element.style.transform = 'translateX(-50%)'
            element.style.opacity = noteOpacity
            element.style.visibility = noteOpacity > 0.002 ? 'visible' : 'hidden'
        }

        gsap.ticker.add(update)
        return () => gsap.ticker.remove(update)
    }, [])

    return (
        <aside ref={ root } className="process-note">
            <p ref={ title } className="process-note-title" />
            <p ref={ detail } className="process-note-detail" />
        </aside>
    )
}
