import { useEffect, useRef } from 'react'
import gsap from 'gsap'

import { params } from '../scroll/choreography.js'

const BAKE_NOTES = [
    null,
    { eyebrow: 'BAKE 01', title: 'Prepare wireframe', detail: 'Keep the geometry visible while the surface is removed.' },
    { eyebrow: 'BAKE 02', title: 'Create seams', detail: 'Mark the UV cuts on the model.' },
    { eyebrow: 'BAKE 03', title: 'Unwrap UV islands', detail: 'Check the real TEXCOORD_1 layout.' },
    { eyebrow: 'BAKE 04', title: 'Bake', detail: 'Transfer the gradient colors into the baked texture.' },
]

const KTX_NOTES = [
    null,
    { eyebrow: 'KTX2 01', title: 'Generate mipmaps', detail: 'Prepare stable texture levels for distance.' },
    { eyebrow: 'KTX2 02', title: 'Transcode UASTC', detail: 'Compress the atlas for GPU delivery.' },
    { eyebrow: 'KTX2 03', title: 'KTX2 ready', detail: 'One GPU-ready atlas · 2.1 MB.' },
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

            if(params.bakePhase > 0)
            {
                note = BAKE_NOTES[Math.round(params.bakePhase)]
                mode = 'bake'
            }
            else if(params.paintFocus > 0.02)
            {
                note = {
                    eyebrow: 'PHOTOSHOP',
                    title: 'Paint the baked texture',
                    detail: 'The 2D texture is now the main working asset.',
                }
                mode = 'paint'
            }
            else if(params.ktxPhase > 0)
            {
                note = KTX_NOTES[Math.round(params.ktxPhase)]
                mode = 'ktx'
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
