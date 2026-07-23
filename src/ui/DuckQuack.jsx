import { useEffect, useRef } from 'react'
import gsap from 'gsap'

import useStage from '../stores/useStage.jsx'
import { duckQuackAnchor } from '../world/duckQuackAnchor.js'

export default function DuckQuack()
{
    const bubble = useRef()

    useEffect(() =>
    {
        const element = bubble.current
        gsap.set(element, { autoAlpha: 0, scale: 0.84, y: 8 })

        const play = () =>
        {
            if(!duckQuackAnchor.visible)
                return

            gsap.killTweensOf(element)
            gsap.timeline()
                .set(element, { y: 8 })
                .to(element, {
                    autoAlpha: 1,
                    scale: 1,
                    y: 0,
                    duration: 0.3,
                    ease: 'back.out(1.8)',
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
        const updatePosition = () =>
        {
            element.style.left = `${ duckQuackAnchor.x + 18 }px`
            element.style.top = `${ duckQuackAnchor.y - 54 }px`
        }

        gsap.ticker.add(updatePosition)
        return () =>
        {
            initialQuack.kill()
            unsubscribe()
            gsap.ticker.remove(updatePosition)
            gsap.killTweensOf(element)
        }
    }, [])

    return <div ref={ bubble } className="quack-bubble">Quack!</div>
}
