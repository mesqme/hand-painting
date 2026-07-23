import { useEffect, useRef } from 'react'
import gsap from 'gsap'

import { params } from '../scroll/choreography.js'

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

const BATCH_NOTES = [
    null,
    { eyebrow: 'BATCHCOLOR', title: 'Start with empty channels', detail: 'Reuse the unused instance color attribute as a compact data buffer.' },
    { eyebrow: 'RED CHANNEL', title: 'Store the geometry ID', detail: 'Match R0–R3 on the atlas to the corresponding object signs.' },
    { eyebrow: 'GREEN CHANNEL', title: 'Store the texture variant', detail: 'Assign a G value to each instance while keeping one material.' },
]

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
