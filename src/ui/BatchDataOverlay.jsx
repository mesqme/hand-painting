import { useEffect, useRef } from 'react'
import gsap from 'gsap'

import { frameFit, clampFrameX } from './frameFit.js'
import { params } from '../scroll/choreography.js'
import { isoSlotOffset, WORLD } from '../config.js'

const INSTANCES = [
    { slot: 0, name: 'barrel', rgba: [ 0, 0, 1, 1 ] },
    { slot: 1, name: 'duck', rgba: [ 1, 3, 2, 1 ] },
    { slot: 2, name: 'book', rgba: [ 2, 1, 0, 1 ] },
    { slot: 3, name: 'meat', rgba: [ 3, 2, 3, 1 ] },
]

const clamp01 = (value) => Math.min(Math.max(value, 0), 1)
const smooth = (value) =>
{
    const t = clamp01(value)
    return t * t * (3 - 2 * t)
}
const lerp = (a, b, t) => a + (b - a) * t

export default function BatchDataOverlay()
{
    const root = useRef()
    const encodePanel = useRef()
    const decodePanel = useRef()
    const tokens = useRef([])
    const atlasCells = useRef([])

    useEffect(() =>
    {
        const update = () =>
        {
            const encode = smooth(params.batchData)
            const decode = smooth(params.batchDecode)
            const opacity = Math.max(encode, decode)
            const element = root.current
            if(!element)
                return

            element.style.opacity = opacity
            element.style.visibility = opacity > 0.002 ? 'visible' : 'hidden'
            encodePanel.current.style.opacity = 1 - decode
            encodePanel.current.style.transform = `translateY(${ - 14 * decode }px)`
            decodePanel.current.style.opacity = decode
            decodePanel.current.style.transform = `translateY(${ 16 * (1 - decode) }px)`

            const { pxPerUnit } = frameFit()
            const frameX = clampFrameX(WORLD.zooFrameX)
            const startX = window.innerWidth * 0.76
            const startY = window.innerHeight * 0.57

            INSTANCES.forEach((instance, index) =>
            {
                const token = tokens.current[index]
                if(!token)
                    return

                const progress = smooth(encode * 1.42 - index * 0.13)
                const offset = isoSlotOffset(instance.slot)
                const targetX = window.innerWidth / 2 + (frameX + offset.x) * pxPerUnit
                const targetY = window.innerHeight / 2 - (offset.y + 0.48) * pxPerUnit
                const spreadY = (index - 1.5) * 48

                token.style.transform = `translate(${ lerp(startX, targetX, progress) }px, ${ lerp(startY + spreadY, targetY, progress) }px) translate(-50%, -50%) scale(${ 0.88 + progress * 0.12 })`
                token.style.opacity = Math.min(encode * 2.5, 1)
                token.classList.toggle('is-attached', progress > 0.92)
            })

            const activeCell = Math.min(Math.floor(decode * 4.02), 3)
            atlasCells.current.forEach((cell, index) =>
            {
                cell && cell.classList.toggle('is-active', decode > 0.02 && index === activeCell)
                cell && cell.classList.toggle('is-complete', decode > (index + 1) / 4)
            })
        }

        gsap.ticker.add(update)
        return () => gsap.ticker.remove(update)
    }, [])

    return (
        <div ref={ root } className="batch-overlay">
            <section ref={ encodePanel } className="batch-panel batch-panel--encode">
                <p className="batch-panel-kicker">batchColor → custom data</p>
                <div className="channel-grid">
                    <span className="channel channel--r"><b>R</b>geometry ID</span>
                    <span className="channel channel--g"><b>G</b>texture variant</span>
                    <span className="channel channel--b"><b>B</b>animation</span>
                    <span className="channel channel--a"><b>A</b>object state</span>
                </div>
                <div className="batch-examples">
                    <code>R1 G0 → geometry 1 · variant 0</code>
                    <code>R1 G2 → geometry 1 · variant 2</code>
                </div>
                <code className="batch-code">batchedMesh.setColorAt(instanceId, encodedColor);</code>
            </section>

            <section ref={ decodePanel } className="batch-panel batch-panel--decode">
                <div>
                    <p className="batch-panel-kicker">shader lookup</p>
                    <code className="batch-formula">atlasUv = uv * uvScale + uvOffset;</code>
                    <p className="batch-panel-detail">R selects geometry transforms. G selects the texture variant.</p>
                    <p className="batch-panel-detail">Only the encoded color changes. The mesh and material stay untouched.</p>
                </div>
                <div className="atlas-diagram" aria-label="Texture atlas regions">
                    { INSTANCES.map((instance, index) =>
                        <span
                            key={ instance.name }
                            ref={ (element) => { atlasCells.current[index] = element } }
                            className="atlas-cell"
                        >
                            { instance.name }
                        </span>
                    ) }
                </div>
            </section>

            { INSTANCES.map((instance, index) =>
                <div
                    key={ instance.name }
                    ref={ (element) => { tokens.current[index] = element } }
                    className="instance-token"
                >
                    <span className="instance-token-name">{ instance.name }</span>
                    <span className="rgba-value rgba-value--r">R{ instance.rgba[0] }</span>
                    <span className="rgba-value rgba-value--g">G{ instance.rgba[1] }</span>
                    <span className="rgba-value rgba-value--b">B{ instance.rgba[2] }</span>
                    <span className="rgba-value rgba-value--a">A{ instance.rgba[3] }</span>
                </div>
            ) }
        </div>
    )
}
