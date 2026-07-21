import { useEffect, useState } from 'react'

import useStage from '../stores/useStage.jsx'
import { addDroppedTexture } from '../world/textureLibrary.js'

/**
 * Step 05 — the artist overlay. Every texture in the library as a draggable
 * swatch; drag one onto the model (or click it) to repaint live. Dropping any
 * image file from the OS adds it to the library and applies it — the exact
 * "artist uploads a new texture into the running scene" loop.
 */
export default function TextureTray()
{
    const step = useStage((state) => state.step)
    const swatches = useStage((state) => state.swatches)
    const activeSwatch = useStage((state) => state.activeSwatch)
    const requestApply = useStage((state) => state.requestApply)

    const [ drag, setDrag ] = useState(null)

    const startDrag = (event, id) =>
    {
        event.preventDefault()

        const originX = event.clientX
        const originY = event.clientY
        let dragging = false

        const move = (moveEvent) =>
        {
            // Ghost only appears past a small threshold, so clicks stay clicks
            if(!dragging && Math.hypot(moveEvent.clientX - originX, moveEvent.clientY - originY) < 7)
                return
            dragging = true
            setDrag({ id, x: moveEvent.clientX, y: moveEvent.clientY })
        }

        const cleanup = () =>
        {
            window.removeEventListener('pointermove', move)
            window.removeEventListener('pointerup', up)
            window.removeEventListener('pointercancel', cancel)
            setDrag(null)
        }

        const up = (upEvent) =>
        {
            cleanup()

            // Released over the model side — apply
            if(dragging && upEvent.clientX > window.innerWidth * 0.42)
                requestApply(id)
        }

        const cancel = () => cleanup()

        window.addEventListener('pointermove', move)
        window.addEventListener('pointerup', up)
        window.addEventListener('pointercancel', cancel)
    }

    /**
     * OS file drop — the live artist loop
     */
    useEffect(() =>
    {
        const onDragOver = (event) => event.preventDefault()
        const onDrop = (event) =>
        {
            event.preventDefault()
            if(useStage.getState().step !== 4)
                return

            const file = [ ...event.dataTransfer.files ].find((file) => file.type.startsWith('image/'))
            if(!file)
                return

            addDroppedTexture(file).then((entry) => requestApply(entry.id))
        }

        window.addEventListener('dragover', onDragOver)
        window.addEventListener('drop', onDrop)

        return () =>
        {
            window.removeEventListener('dragover', onDragOver)
            window.removeEventListener('drop', onDrop)
        }
    }, [requestApply])

    const dragSwatch = drag ? swatches.find((swatch) => swatch.id === drag.id) : null

    return (
        <>
            <aside className={ `tray ${ step === 4 ? 'is-visible' : '' }` }>
                <p className="tray-title">textures — drag one onto the duck</p>

                <div className="tray-row">
                    { swatches.map((swatch) =>
                        <button
                            key={ swatch.id }
                            className={ `swatch ${ swatch.id === activeSwatch ? 'is-active' : '' }` }
                            onPointerDown={ (event) => startDrag(event, swatch.id) }
                            onClick={ () => requestApply(swatch.id) }
                        >
                            <span className="swatch-thumb" style={ { backgroundImage: `url(${ swatch.thumb })` } } />
                            <span className="swatch-label">{ swatch.label }</span>
                        </button>
                    ) }
                </div>

                <p className="tray-note">…or drop any png from your machine on the page to paint live</p>
            </aside>

            { dragSwatch &&
                <div className="drag-ghost" style={ { transform: `translate(${ drag.x }px, ${ drag.y }px)` } }>
                    <span style={ { backgroundImage: `url(${ dragSwatch.thumb })` } } />
                </div>
            }
        </>
    )
}
