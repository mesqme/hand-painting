import { useEffect, useRef } from 'react'
import { addAfterEffect } from '@react-three/fiber'

import useStage from '../stores/useStage.jsx'
import { perfProbe } from '../world/perfProbe.js'

/**
 * Step 08 — reads renderer.info after every rendered frame and writes straight
 * into the DOM (no React re-renders). One BatchedMesh visible → one draw call.
 */
export default function PerfMonitor()
{
    const step = useStage((state) => state.step)

    const calls = useRef()
    const triangles = useRef()
    const fps = useRef()

    useEffect(() =>
    {
        let frames = 0
        let last = performance.now()

        const unsubscribe = addAfterEffect(() =>
        {
            const renderer = perfProbe.renderer
            if(!renderer || !calls.current)
                return

            frames++
            const now = performance.now()
            if(now - last >= 500)
            {
                fps.current.textContent = Math.round(frames * 1000 / (now - last))
                frames = 0
                last = now
            }

            calls.current.textContent = renderer.info.render.calls
            triangles.current.textContent = renderer.info.render.triangles.toLocaleString('en-US')
        })

        return unsubscribe
    }, [])

    return (
        <aside className={ `perf ${ step === 7 ? 'is-visible' : '' }` }>
            <p className="perf-title">perf monitor</p>

            <div className="perf-main">
                <span className="perf-value" ref={ calls }>—</span>
                <span className="perf-label">draw calls</span>
            </div>

            <p className="perf-row"><span ref={ triangles }>—</span> triangles</p>
            <p className="perf-row"><span ref={ fps }>—</span> fps</p>
        </aside>
    )
}
