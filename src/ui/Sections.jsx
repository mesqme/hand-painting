import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

import { STEPS } from '../config.js'
import useStage from '../stores/useStage.jsx'

/**
 * The scrolling copy deck. Each step is one full section; its card is sticky
 * and fades in/out at the section edges. A separate trigger tracks the active
 * step for the fixed UI (texture tray, perf monitor).
 */
export default function Sections()
{
    const page = useRef()

    const setStep = useStage((state) => state.setStep)

    useEffect(() =>
    {
        gsap.registerPlugin(ScrollTrigger)

        const context = gsap.context(() =>
        {
            const sections = gsap.utils.toArray('.step')

            sections.forEach((section, index) =>
            {
                const card = section.querySelector('.card')

                ScrollTrigger.create({
                    trigger: section,
                    start: 'top 30%',
                    end: 'bottom 70%',
                    onToggle: (self) => { if(self.isActive) setStep(index) },
                })

                const timeline = gsap.timeline({
                    scrollTrigger: {
                        trigger: section,
                        start: 'top 92%',
                        end: 'bottom 8%',
                        scrub: true,
                    },
                })

                if(index > 0)
                    timeline.fromTo(card, { autoAlpha: 0, y: 44 }, { autoAlpha: 1, y: 0, duration: 0.15, ease: 'power2.out' }, 0.18)

                timeline.to(card, { autoAlpha: 0, y: - 32, duration: 0.15, ease: 'power1.in' }, 0.78)
                timeline.to(card, { y: - 32, duration: 0.001 }, 0.999)
            })
        }, page)

        return () => context.revert()
    }, [setStep])

    return (
        <main ref={ page } className="page">
            { STEPS.map((step, index) =>
                <section key={ step.id } className={ `step step--${ step.side } step--${ step.id }` }>
                    <div className="card">
                        { step.hero === true &&
                            <header className="hero">
                                <h1 className="hero-title">Flat<br />Palette</h1>
                                <p className="hero-tagline">A hand-painting pipeline for production assets</p>
                            </header>
                        }

                        <p className="kicker">{ step.kicker }</p>
                        <h2 className="title">{ step.title }</h2>
                        <p className="body">{ step.body }</p>

                        { step.hint && <p className="hint">{ step.hint }</p> }

                        { step.terminal &&
                            <pre className="terminal">{ step.terminal.join('\n') }</pre>
                        }
                    </div>

                    { step.hero === true &&
                        <div className="scroll-cue">scroll<span>↓</span></div>
                    }
                </section>
            ) }
        </main>
    )
}
