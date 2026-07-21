import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'

import useStage from '../stores/useStage.jsx'
import { addDroppedTexture } from '../world/textureLibrary.js'
import { params } from '../scroll/choreography.js'
import { WORLD, isoSlotOffset, HERO_SLOT } from '../config.js'

/**
 * Act 06 — the artist overlay. Every texture in the library as a draggable
 * swatch; drag one into the scene (or click it) to repaint live, and dropping
 * any image file from the OS adds it to the library and applies it.
 *
 * On top of the real interactions, scroll runs a SCRIPTED demo: a ghost thumb
 * flies from a swatch into the scene window and the model repaints on landing
 * (params.artistDrag/Wipe A+B) — the exact story an artist lives daily.
 */
const ARTIST_STEP = 5
const DEMO_SWATCHES = [ 2, 3 ]

export default function TextureTray()
{
    const demoGhost = useRef()
    const swatchButtons = useRef([])

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

            // Released over the scene side — apply
            if(dragging && upEvent.clientX > window.innerWidth * 0.3)
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
            if(useStage.getState().step !== ARTIST_STEP)
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

    /**
     * Scripted demo ghost — follows the choreography params
     */
    useEffect(() =>
    {
        const update = () =>
        {
            const ghost = demoGhost.current
            if(!ghost)
                return

            const second = params.artistDragB > 0.01
            const progress = second ? params.artistDragB : params.artistDragA
            const swatchIndex = second ? DEMO_SWATCHES[1] : DEMO_SWATCHES[0]
            const button = swatchButtons.current[swatchIndex]

            if(progress < 0.01 || progress > 0.985 || !button)
            {
                ghost.style.opacity = 0
                return
            }

            // Source: the real swatch; target: the hero on its crew slot
            const rect = button.getBoundingClientRect()
            const fit = Math.min(Math.max((window.innerWidth / window.innerHeight) / 1.72, 0.6), 1)
            const pxPerUnit = window.innerHeight * 0.1963 * fit
            const heroOffset = isoSlotOffset(HERO_SLOT)
            const targetX = window.innerWidth / 2 + (WORLD.artistFrameX + heroOffset.x) * pxPerUnit
            const targetY = window.innerHeight / 2 - (heroOffset.y + 0.4) * pxPerUnit

            const eased = progress * progress * (3 - 2 * progress)
            const x = rect.x + rect.width / 2 + (targetX - rect.x - rect.width / 2) * eased
            const y = rect.y + rect.height / 2 + (targetY - rect.y - rect.height / 2) * eased - Math.sin(Math.PI * eased) * 70

            ghost.style.opacity = Math.min(progress * 10, (1 - progress) * 10, 1)
            ghost.style.transform = `translate(${ x }px, ${ y }px)`
            ghost.style.backgroundImage = button.querySelector('.swatch-thumb')?.style.backgroundImage ?? ''
        }

        gsap.ticker.add(update)
        return () => gsap.ticker.remove(update)
    }, [])

    const dragSwatch = drag ? swatches.find((swatch) => swatch.id === drag.id) : null

    return (
        <>
            <aside className={ `tray ${ step === ARTIST_STEP ? 'is-visible' : '' }` }>
                <p className="tray-title">textures — drag one into the scene</p>

                <div className="tray-row">
                    { swatches.map((swatch, index) =>
                        <button
                            key={ swatch.id }
                            ref={ (instance) => { swatchButtons.current[index] = instance } }
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

            <div ref={ demoGhost } className="demo-ghost" />

            { dragSwatch &&
                <div className="drag-ghost" style={ { transform: `translate(${ drag.x }px, ${ drag.y }px)` } }>
                    <span style={ { backgroundImage: `url(${ dragSwatch.thumb })` } } />
                </div>
            }
        </>
    )
}
