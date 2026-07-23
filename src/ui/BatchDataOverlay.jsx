import { useEffect, useRef } from 'react'
import gsap from 'gsap'

import { frameFit, clampFrameX } from './frameFit.js'
import { params } from '../scroll/choreography.js'
import { isoSlotOffset, WORLD } from '../config.js'

const INSTANCES = [
    { slot: 0, name: 'barrel', red: 0, green: 0 },
    { slot: 1, name: 'duck', red: 1, green: 3 },
    { slot: 2, name: 'book', red: 2, green: 1 },
    { slot: 3, name: 'meat', red: 3, green: 2 },
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
 * 2. R values arrive from the matching atlas quadrants;
 * 3. large G texture IDs appear on the geometry and fill the second channel.
 */
export default function BatchDataOverlay()
{
    const root = useRef()
    const tokens = useRef([])
    const redValues = useRef([])
    const redEmpty = useRef([])
    const greenValues = useRef([])
    const greenEmpty = useRef([])
    const geometryTags = useRef([])

    useEffect(() =>
    {
        const update = () =>
        {
            const show = smooth(params.batchData)
            const red = smooth(params.batchRed)
            const green = smooth(params.batchGreen)
            const element = root.current
            if(!element)
                return

            element.style.opacity = Math.max(show, red, green)
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

                if(token)
                {
                    const stagger = smooth(show * 1.35 - index * 0.09)
                    token.style.transform = `translate(${ x }px, ${ y }px) translate(-50%, -50%) scale(${ 0.82 + stagger * 0.18 })`
                    token.style.opacity = stagger
                }

                if(redValues.current[index])
                {
                    redValues.current[index].style.opacity = red
                    redEmpty.current[index].style.opacity = 1 - red
                }

                if(greenValues.current[index])
                {
                    greenValues.current[index].style.opacity = green
                    greenEmpty.current[index].style.opacity = 1 - green
                }

                if(tag)
                {
                    tag.style.transform = `translate(${ x }px, ${ window.innerHeight / 2 - offset.y * pxPerUnit }px) translate(-50%, -50%) scale(${ 0.72 + green * 0.28 })`
                    tag.style.opacity = green
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

                    <span className="rgba-value rgba-value--g">
                        G
                        <i ref={ (element) => { greenEmpty.current[index] = element } }>–</i>
                        <b ref={ (element) => { greenValues.current[index] = element } }>{ instance.green }</b>
                    </span>

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
                    G{ instance.green }
                </div>
            ) }
        </div>
    )
}
