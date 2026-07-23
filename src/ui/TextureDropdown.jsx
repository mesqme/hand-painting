import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'

import useStage from '../stores/useStage.jsx'
import { addDroppedTexture } from '../world/textureLibrary.js'
import { params } from '../scroll/choreography.js'
import { frameFit, clampFrameX } from './frameFit.js'
import { WORLD, isoSlotOffset, HERO_SLOT } from '../config.js'

/**
 * Act 06 — the artist control: a dropdown list docked NEXT TO THE MODEL inside
 * the scene window. Scroll opens it and switches base → pastel → red →
 * aberration. Each short selection change drives the same painterly wipe used
 * in the hand-painting step, while the list highlight crossfades quickly.
 * The same dropdown remains fully interactive.
 */
const ARTIST_STEP = 6

export default function TextureDropdown()
{
    const root = useRef()
    const list = useRef()
    const optionButtons = useRef([])

    const step = useStage((state) => state.step)
    const swatches = useStage((state) => state.swatches)
    const activeSwatch = useStage((state) => state.activeSwatch)
    const requestApply = useStage((state) => state.requestApply)

    const [ userOpen, setUserOpen ] = useState(false)

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
     * Per-frame drive: position next to the hero, fade with params.dropdownIn,
     * and play the scripted open → painterly option sequence
     */
    useEffect(() =>
    {
        const update = () =>
        {
            const element = root.current
            if(!element)
                return

            const opacity = params.dropdownIn
            element.style.opacity = opacity
            element.style.visibility = opacity > 0.002 ? 'visible' : 'hidden'

            // Docked to the right of the hero's crew slot, mirroring the 3D fit
            const { pxPerUnit } = frameFit()
            const heroOffset = isoSlotOffset(HERO_SLOT)
            const frameX = clampFrameX(WORLD.artistFrameX)
            const x = window.innerWidth / 2 + (frameX + heroOffset.x + 0.62) * pxPerUnit
            const y = window.innerHeight / 2 - (heroOffset.y + 0.72) * pxPerUnit
            element.style.transform = `translate(${ x }px, ${ y }px)`

            const scriptedOpen = params.dropdownOpen
            const openAmount = userOpen ? 1 : scriptedOpen
            const highlight = scriptedOpen > 0.02 ? Math.round(params.paintTexture) : - 1

            const listElement = list.current
            if(listElement)
            {
                const clipped = (1 - openAmount) * 100
                listElement.style.clipPath = `inset(0 0 ${ clipped }% 0 round 11px)`
                listElement.style.transform = `translateY(${ (1 - openAmount) * - 8 }px)`
                listElement.style.opacity = Math.min(openAmount * 1.6, 1)
                listElement.style.pointerEvents = openAmount > 0.9 ? 'auto' : 'none'
            }

            optionButtons.current.forEach((button, index) =>
            {
                button && button.classList.toggle('is-scanned', index === highlight)
            })
        }

        gsap.ticker.add(update)
        return () => gsap.ticker.remove(update)
    }, [userOpen])

    // Close the real dropdown whenever the act changes
    useEffect(() => { setUserOpen(false) }, [step])

    const active = swatches.find((swatch) => swatch.id === activeSwatch) ?? swatches[0]

    return (
        <div ref={ root } className="dropdown">
            <p className="dropdown-title">texture</p>

            <button className="dropdown-header" onClick={ () => setUserOpen(!userOpen) }>
                { active && <span className="dropdown-thumb" style={ { backgroundImage: `url(${ active.thumb })` } } /> }
                <span className="dropdown-label">{ active ? active.label : '—' }</span>
                <span className="dropdown-caret">▾</span>
            </button>

            <div ref={ list } className="dropdown-list">
                { swatches.map((swatch, index) =>
                    <button
                        key={ swatch.id }
                        ref={ (instance) => { optionButtons.current[index] = instance } }
                        className={ `dropdown-option ${ swatch.id === activeSwatch ? 'is-active' : '' }` }
                        onClick={ () =>
                        {
                            requestApply(swatch.id)
                            setUserOpen(false)
                        } }
                    >
                        <span className="dropdown-thumb" style={ { backgroundImage: `url(${ swatch.thumb })` } } />
                        <span className="dropdown-label">{ swatch.label }</span>
                    </button>
                ) }
            </div>

            <p className="dropdown-note">…or drop any png on the page</p>
        </div>
    )
}
