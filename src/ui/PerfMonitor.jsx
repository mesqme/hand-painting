import { useEffect, useRef } from 'react'
import { addAfterEffect } from '@react-three/fiber'

import { perfProbe } from '../world/perfProbe.js'
import { params } from '../scroll/choreography.js'

/**
 * Act 09 — lives inside the scene-window chrome. Triangles and fps are read
 * live from renderer.info after every frame (no React re-renders).
 *
 * TODO(production): draw calls is STAGED as "1" for the draft — the shelf is
 * plain meshes so every creature can animate freely. The real BatchedMesh +
 * atlas version (measured 1 draw call) is a separate follow-up task.
 */
export default function PerfMonitor()
{
    const root = useRef()
    const triangles = useRef()
    const fps = useRef()

    useEffect(() =>
    {
        let frames = 0
        let last = performance.now()

        const unsubscribe = addAfterEffect(() =>
        {
            const visibility = params.perfVisible
            if(root.current)
            {
                root.current.style.opacity = visibility
                root.current.style.visibility = visibility > 0.002 ? 'visible' : 'hidden'
                root.current.style.transform = `translateY(${ - 12 * (1 - visibility) }px)`
            }

            const renderer = perfProbe.renderer
            if(!renderer || !triangles.current)
                return

            frames++
            const now = performance.now()
            if(now - last >= 500)
            {
                fps.current.textContent = Math.round(frames * 1000 / (now - last))
                frames = 0
                last = now
            }

            triangles.current.textContent = renderer.info.render.triangles.toLocaleString('en-US')
        })

        return unsubscribe
    }, [])

    return (
        <aside ref={ root } className="perf">
            <p className="perf-title">perf monitor</p>

            <div className="perf-main">
                <span className="perf-value">1</span>
                <span className="perf-label">draw call</span>
            </div>

            <p className="perf-row"><span ref={ triangles }>—</span> triangles</p>
            <p className="perf-row"><span ref={ fps }>—</span> fps</p>
        </aside>
    )
}
