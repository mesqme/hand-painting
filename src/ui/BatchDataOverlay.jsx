import { useEffect, useRef } from 'react'
import gsap from 'gsap'

import { frameFit, clampFrameX } from './frameFit.js'
import { params } from '../scroll/choreography.js'
import { isoSlotOffset } from '../config.js'

const INSTANCES = [
    { slot: 0, name: 'barrel', red: 0 },
    { slot: 1, name: 'duck', red: 1 },
    { slot: 2, name: 'book', red: 2 },
    { slot: 3, name: 'meat', red: 3 },
]

const clamp01 = (value) => Math.min(Math.max(value, 0), 1)
const smooth = (value) =>
{
    const t = clamp01(value)
    return t * t * (3 - 2 * t)
}

/**
 * Short batchColor demonstration:
 * 1. empty RGBA signs appear over the four instances;
 * 2. each geometry receives its R ID;
 * 3. the matching R value appears on the atlas and fills the instance token.
 */
export default function BatchDataOverlay()
{
    const root = useRef()
    const tokens = useRef([])
    const redValues = useRef([])
    const redEmpty = useRef([])
    const geometryTags = useRef([])

    useEffect(() =>
    {
        const update = () =>
        {
            const show = smooth(params.batchData)
            const lookup = params.batchLookup
            const element = root.current
            if(!element)
                return

            element.style.opacity = show
            element.style.visibility = show > 0.002 ? 'visible' : 'hidden'

            const { pxPerUnit } = frameFit()
            const frameX = clampFrameX(params.frameX)

            INSTANCES.forEach((instance, index) =>
            {
                const offset = isoSlotOffset(instance.slot)
                const x = window.innerWidth / 2 + (frameX + offset.x) * pxPerUnit
                const y = window.innerHeight / 2 - (offset.y + 0.92) * pxPerUnit
                const token = tokens.current[index]
                const tag = geometryTags.current[index]
                const local = clamp01(lookup - index)
                const tagIn = smooth(local / 0.2)
                const tagOut = 1 - smooth((local - 0.72) / 0.2)
                const tagOpacity = tagIn * tagOut
                const assigned = smooth((local - 0.4) / 0.2)

                if(token)
                {
                    const stagger = smooth(show * 1.35 - index * 0.09)
                    const selectedScale = 1 + tagOpacity * 0.18
                    token.style.transform = `translate(${ x }px, ${ y }px) translate(-50%, -50%) scale(${ (0.82 + stagger * 0.18) * selectedScale })`
                    token.style.opacity = stagger
                    token.classList.toggle('is-attached', tagOpacity > 0.08)
                }

                if(redValues.current[index])
                {
                    redValues.current[index].style.opacity = assigned
                    redEmpty.current[index].style.opacity = 1 - assigned
                }

                if(tag)
                {
                    tag.style.transform = `translate(${ x }px, ${ window.innerHeight / 2 - offset.y * pxPerUnit }px) translate(-50%, -50%) scale(${ 0.8 + tagOpacity * 0.28 })`
                    tag.style.opacity = tagOpacity
                }
            })
        }

        gsap.ticker.add(update)
        return () => gsap.ticker.remove(update)
    }, [])

    return (
        <div ref={ root } className="batch-overlay batch-overlay--compact">
            { INSTANCES.map((instance, index) =>
                <div
                    key={ instance.name }
                    ref={ (element) => { tokens.current[index] = element } }
                    className="instance-token"
                >
                    <span className="instance-token-name">{ instance.name }</span>

                    <span className="rgba-value rgba-value--r">
                        R
                        <i ref={ (element) => { redEmpty.current[index] = element } }>–</i>
                        <b ref={ (element) => { redValues.current[index] = element } }>{ instance.red }</b>
                    </span>

                    <span className="rgba-value rgba-value--g">G–</span>
                    <span className="rgba-value rgba-value--b">B–</span>
                    <span className="rgba-value rgba-value--a">A–</span>
                </div>
            ) }

            { INSTANCES.map((instance, index) =>
                <div
                    key={ `geometry-${ instance.name }` }
                    ref={ (element) => { geometryTags.current[index] = element } }
                    className="geometry-id-tag"
                >
                    R{ instance.red }
                </div>
            ) }
        </div>
    )
}
