import { useEffect, useRef } from 'react'
import gsap from 'gsap'

import PerfMonitor from './PerfMonitor.jsx'
import { frameFit, clampFrameX } from './frameFit.js'
import { params } from '../scroll/choreography.js'

/**
 * Acts 03 / 06 / 09 — the "scene preview" window. A faked embedded canvas
 * (border, blueprint grid, floor line, window-chrome tag) that sits BEHIND
 * the transparent WebGL canvas, so framed acts read as running inside a
 * separate experience viewport. DOM on purpose: it adds zero draw calls.
 * The perf monitor lives inside the window chrome (act 09).
 */
export default function SceneWindow()
{
    const root = useRef()

    useEffect(() =>
    {
        const update = () =>
        {
            const element = root.current
            if(!element)
                return

            const opacity = params.frameOpacity
            element.style.opacity = opacity
            element.style.visibility = opacity > 0.002 ? 'visible' : 'hidden'

            // Shared frame math (frameFit) — the 3D stage in Crew clamps its
            // shift through the same helper, so window and scene stay concentric
            const { pxPerUnit, width } = frameFit()
            const shift = clampFrameX(params.frameX) * pxPerUnit

            element.style.transform = `translate(calc(-50% + ${ shift }px), -52%)`
            element.style.width = `${ width }px`
        }

        gsap.ticker.add(update)
        return () => gsap.ticker.remove(update)
    }, [])

    return (
        <div ref={ root } className="scene-window">
            <div className="scene-window-chrome">
                <span className="scene-window-dot" style={ { background: '#e0654f' } } />
                <span className="scene-window-dot" style={ { background: '#e2a63d' } } />
                <span className="scene-window-dot" style={ { background: '#7fb069' } } />
                <span className="scene-window-label">scene preview — live</span>
            </div>

            <PerfMonitor />
        </div>
    )
}
