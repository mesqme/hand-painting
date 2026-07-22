import './style.css'
import { StrictMode, Suspense, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { Canvas } from '@react-three/fiber'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

import Experience from './world/Experience.jsx'
import Sections from './ui/Sections.jsx'
import TextureDropdown from './ui/TextureDropdown.jsx'
import SceneWindow from './ui/SceneWindow.jsx'
import { buildChoreography } from './scroll/choreography.js'

function App()
{
    useEffect(() =>
    {
        const timeline = buildChoreography()
        const trigger = timeline.scrollTrigger

        /**
         * Keep the scroll FRACTION stable across resizes. Sections are sized
         * in vh, so a resize changes the document height while the browser
         * keeps (or clamps) the PIXEL scroll — the same pixel then lands on a
         * different act. Reading trigger.progress inside ScrollTrigger's
         * refresh cycle is unreliable for the same reason (the progress may
         * have been computed from a clamped pixel against stale bounds, and
         * the error compounds on every debounced refresh while dragging the
         * window edge). So instead: record the fraction from LIVE values on
         * every user scroll — the only moment scrollY and the document height
         * are guaranteed consistent — and restore it on resize/refresh.
         */
        const docHeight = () => document.documentElement.scrollHeight
        const maxScroll = () => Math.max(docHeight() - window.innerHeight, 1)

        let lastDocHeight = docHeight()
        let savedProgress = window.scrollY / maxScroll()

        const save = () =>
        {
            // A height change means this scroll event came from a resize
            // reflow (browser clamping), not from the user — don't record it
            if(docHeight() !== lastDocHeight)
            {
                lastDocHeight = docHeight()
                return
            }
            savedProgress = window.scrollY / maxScroll()
        }

        const restore = () =>
        {
            lastDocHeight = docHeight()
            window.scrollTo(0, Math.round(savedProgress * maxScroll()))
        }

        window.addEventListener('scroll', save, { passive: true })
        window.addEventListener('resize', restore)
        ScrollTrigger.addEventListener('refresh', restore)

        return () =>
        {
            window.removeEventListener('scroll', save)
            window.removeEventListener('resize', restore)
            ScrollTrigger.removeEventListener('refresh', restore)
            trigger?.kill()
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

            <SceneWindow />
            <Sections />
            <TextureDropdown />
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
