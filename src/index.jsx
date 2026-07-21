import './style.css'
import { StrictMode, Suspense, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { Canvas } from '@react-three/fiber'

import Experience from './world/Experience.jsx'
import Sections from './ui/Sections.jsx'
import TextureTray from './ui/TextureTray.jsx'
import PerfMonitor from './ui/PerfMonitor.jsx'
import { buildChoreography } from './scroll/choreography.js'

function App()
{
    useEffect(() =>
    {
        const timeline = buildChoreography()

        return () =>
        {
            timeline.scrollTrigger?.kill()
            timeline.kill()
        }
    }, [])

    return (
        <>
            <div className="canvas-root">
                <Canvas
                    flat
                    dpr={ [ 1, 2 ] }
                    gl={ { antialias: true, alpha: true } }
                    camera={ { fov: 33, near: 0.1, far: 40, position: [ 0, 0.1, 8.6 ] } }
                >
                    <Suspense fallback={ null }>
                        <Experience />
                    </Suspense>
                </Canvas>
            </div>

            <Sections />
            <TextureTray />
            <PerfMonitor />
        </>
    )
}

ReactDOM.createRoot(document.querySelector('#root')).render(
    <StrictMode>
        <App />
    </StrictMode>
)

// Dev-only hooks for automated testing
if(import.meta.env.DEV)
{
    import('./stores/useStage.jsx').then((module) => { window.__stage = module.default })
}
