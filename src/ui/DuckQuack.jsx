import { useEffect, useRef } from 'react'
import gsap from 'gsap'

import useStage from '../stores/useStage.jsx'
import { duckQuackAnchor } from '../world/duckQuackAnchor.js'

export default function DuckQuack()
{
    const anchor = useRef()
    const bubble = useRef()

    useEffect(() =>
    {
        const element = bubble.current
        duckQuackAnchor.element = anchor.current
        gsap.set(element, { autoAlpha: 0, scale: 0.92, y: 8 })

        const play = () =>
        {
            if(!duckQuackAnchor.visible)
                return

            gsap.killTweensOf(element)
            gsap.timeline()
                .set(element, { autoAlpha: 0, scale: 0.92, y: 8 })
                .to(element, {
                    autoAlpha: 1,
                    scale: 1,
                    y: 0,
                    duration: 0.34,
                    ease: 'power2.out',
                })
                .to(element, { autoAlpha: 1, duration: 0.68 })
                .to(element, {
                    autoAlpha: 0,
                    scale: 0.9,
                    y: - 10,
                    duration: 0.28,
                    ease: 'power2.in',
                })
        }

        const initialQuack = gsap.delayedCall(3, play)
        const unsubscribe = useStage.subscribe((state) => state.quackSeq, play)

        return () =>
        {
            initialQuack.kill()
            unsubscribe()
            gsap.killTweensOf(element)
            if(duckQuackAnchor.element === anchor.current)
                duckQuackAnchor.element = null
        }
    }, [])

    return (
        <div ref={ anchor } className="quack-anchor">
            <div ref={ bubble } className="quack-bubble">Quack!</div>
        </div>
    )
}
