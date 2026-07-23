import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

import { SCROLL_END, STEPS } from '../config.js'
import useStage from '../stores/useStage.jsx'

/**
 * The copy and 3D scene share the same scroll-time coordinate. Cards are fixed
 * presentation panels; the tall sections below only provide scroll distance.
 * This keeps every heading attached to the exact visual action it describes.
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
            const cards = gsap.utils.toArray('.card')
            const cue = page.current.querySelector('.scroll-cue')
            let activeStep = 0

            gsap.set(cards, { autoAlpha: 0, y: 34 })
            gsap.set(cards[0], { autoAlpha: 1, y: 0 })

            const timeline = gsap.timeline({
                scrollTrigger: {
                    trigger: page.current,
                    start: 'top top',
                    end: 'bottom bottom',
                    scrub: true,
                    onUpdate: (self) =>
                    {
                        const time = self.progress * SCROLL_END
                        let nextStep = 0
                        for(let index = 1; index < STEPS.length; index++)
                        {
                            if(time >= STEPS[index].at)
                                nextStep = index
                        }

                        if(nextStep !== activeStep)
                        {
                            activeStep = nextStep
                            setStep(nextStep)
                        }
                    },
                },
            })

            timeline.to(cue, { autoAlpha: 0, y: - 10, duration: 0.1 }, 0.02)

            STEPS.forEach((step, index) =>
            {
                const card = cards[index]
                const nextAt = STEPS[index + 1]?.at ?? SCROLL_END

                if(index > 0)
                {
                    timeline.fromTo(
                        card,
                        { autoAlpha: 0, y: 34 },
                        { autoAlpha: 1, y: 0, duration: 0.12, ease: 'power2.out' },
                        Math.max(step.at - 0.04, 0)
                    )
                }

                if(index < STEPS.length - 1)
                {
                    timeline.to(
                        card,
                        { autoAlpha: 0, y: - 28, duration: 0.12, ease: 'power1.in' },
                        Math.max(step.outAt ?? nextAt - 0.16, step.at + 0.2)
                    )
                }
            })

            // Preserve one complete scroll unit for the final act.
            timeline.to({}, { duration: 0.001 }, SCROLL_END - 0.001)
        }, page)

        return () => context.revert()
    }, [setStep])

    return (
        <main ref={ page } className="page">
            { STEPS.map((step, index) =>
                <section key={ step.id } className={ `step step--${ step.side } step--${ step.id }` }>
                    <div className="card">
                        { step.hero === true
                            ? <header className="hero">
                                <h1 className="hero-title">
                                    { step.title.split('\n').map((line, i) =>
                                        <span key={ i }>{ i > 0 && <br /> }{ line }</span>
                                    ) }
                                </h1>
                                <p className="hero-tagline">{ step.body }</p>
                            </header>
                            : <>
                                <h2 className="kicker">
                                    { step.id === 'final'
                                        ? <><span className="final-accent">edclub</span> was here</>
                                        : step.kicker }
                                </h2>
                                <p className="body">{ step.body }</p>

                                { step.hint && <p className="hint">{ step.hint }</p> }

                            </>
                        }
                    </div>

                    { step.hero === true &&
                        <>
                            <div className="scroll-cue">scroll<span>↓</span></div>
                        </>
                    }
                </section>
            ) }
        </main>
    )
}
