import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'

import usePairs from './usePairs.jsx'
import { createAssetMaterial, updateAssetMaterial } from './materials/assetMaterial.js'
import { ensureLibrary, textureLibrary } from './textureLibrary.js'
import { clampFrameX } from '../ui/frameFit.js'
import { params } from '../scroll/choreography.js'
import { ISO, isoSlotOffset } from '../config.js'
import { finalSlotTransform } from './finalLayout.js'

/**
 * The crew — the three non-hero members of the four-piece cast (the hero owns
 * slot 1). Each member
 * is a REAL object+column pair from pairs.glb (barrel, book, meat — the hero
 * keeps the duck pair). One component serves four acts:
 *   03  evenly spaced in the level-view scene
 *   06  same gradient scene — the artist changes only the hero texture
 *   07  everyone HOLDS their slot while the texture sheets fly off the models
 *   09  neutral wireframe objects receive sequential red-channel geometry IDs
 */
// pair indexes into usePairs().crewPairs — [ barrel, book, meat ]
// entry indexes into textureLibrary.crewPaints (uv0-friendly stand-ins)
const MEMBERS = [
    { slot: 0, entry: 0, pair: 'barrel', batchOrder: 0 },
    { slot: 2, entry: 1, pair: 'book', batchOrder: 2 },
    { slot: 3, entry: 2, pair: 'meat', batchOrder: 3 },
]

const easeOutBack = (t) =>
{
    const c1 = 1.70158
    const c3 = c1 + 1
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}

const smooth = (t) => t * t * (3 - 2 * t)
const clamp01 = (value) => Math.min(Math.max(value, 0), 1)

export default function Crew()
{
    const group = useRef()
    const bodies = useRef([])
    const animals = useRef([])
    const animalYaw = useRef([ 0, 0, 0 ])

    const { crewPairs } = usePairs()
    const maps = useTexture({
        gradient: './textures/gradientPalette.png',
        baked: './textures/duck_baked.png',
        base: './textures/duck_base.png',
        pastel: './textures/duck_pastel.png',
        red: './textures/duck_red.png',
        aberration: './textures/duck_base_abberation.png',
    })

    const { materials, wireMaterial } = useMemo(() =>
    {
        ensureLibrary(maps)

        const materials = MEMBERS.map((member) =>
        {
            const paint = textureLibrary.crewPaints[member.entry]?.texture ?? maps.gradient
            return createAssetMaterial({ mapBase: maps.gradient, mapPaintA: paint, mapPaintB: paint, whiteMix: 0 })
        })
        const wireMaterial = createAssetMaterial({ wireframe: true, flatShade: true, opacity: 0 })
        return { materials, wireMaterial }
    }, [maps])

    useFrame((state, delta) =>
    {
        const elapsed = state.clock.elapsedTime
        const visible = params.crewVisible > 0.005

        group.current.visible = visible
        if(!visible)
            return

        const frameX = clampFrameX(params.frameX)
        const final = smooth(clamp01(params.finalVisible))

        const crewOpacity = clamp01(params.crewVisible * 1.5)
        const wireOpacity = params.crewWire * crewOpacity
        updateAssetMaterial(wireMaterial, { opacity: wireOpacity })

        MEMBERS.forEach((member, index) =>
        {
            const body = bodies.current[index]
            if(!body)
                return

            /**
             * Transform: every member holds its level-view slot
             */
            const iso = isoSlotOffset(member.slot)
            const finalTransform = finalSlotTransform(member.slot, frameX, final)
            const pop = easeOutBack(clamp01(params.crewVisible * 1.3 - index * 0.12))

            body.position.x = final > 0 ? finalTransform.x : frameX + iso.x
            body.position.y = final > 0 ? finalTransform.y : iso.y
            body.position.z = final > 0 ? finalTransform.z : iso.z
            body.rotation.x = ISO.pitch
            body.rotation.y = ISO.yaw
            body.scale.setScalar(Math.max(finalTransform.scale * pop, 0.0001))

            /**
             * Look: gradient → painted → (act 09) wireframe → applied. Solids
             * skip depth-write while invisible (surfaceWipe 0).
             */
            const surfaceWipe = clamp01(params.crewSurface * 1.4 - index * 0.12)
            materials[index].depthWrite = surfaceWipe > 0.001
            const batchActive = params.batchNeutral > 0.001
            const batchReveal = smooth(clamp01(
                (params.batchLookup - member.batchOrder - 0.52) / 0.48
            ))

            updateAssetMaterial(materials[index], {
                opacity: crewOpacity,
                reveal: params.crewPaint,
                whiteMix: batchActive ? params.batchNeutral : 0,
                clayWipe: batchActive ? batchReveal : 0,
                surfaceWipe,
            })

            /**
             * Object life — mild float by default, full personality once the
             * combined texture lands in act 09. The pair geometries carry
             * their authored offsets (the object already floats above its
             * column), so everything here is ADDED on top: floats, yaw spins
             * around the column axis and the meat hop — no re-positioning.
             */
            const animal = animals.current[index]
            if(animal)
            {
                const amp = batchReveal
                const propScale = 1 - final
                animal.visible = propScale > 0.002
                animal.scale.setScalar(Math.max(propScale, 0.0001))

                if(member.pair === 'barrel')
                {
                    animal.position.y = Math.sin(elapsed * 1.1 + 1.6) * 0.06
                    // Integrate speed over frame time. Multiplying elapsed time
                    // by a scroll-driven speed causes a visible rotation jump
                    // whenever the batch-data reveal changes.
                    animalYaw.current[index] += Math.min(delta, 0.05) * (0.35 + 0.65 * amp)
                    animal.rotation.y = animalYaw.current[index]
                    animal.rotation.z = Math.sin(elapsed * 0.7) * 0.06 * amp
                }
                else if(member.pair === 'book')
                {
                    animal.position.y = Math.sin(elapsed * 0.9 + 4) * 0.06
                    animal.rotation.y = Math.sin(elapsed * 0.8) * (0.12 + 0.5 * amp)
                    animal.rotation.z = Math.sin(elapsed * 1.4 + 1) * 0.1 * amp
                }
                else // meat — the hopper
                {
                    const phase = (elapsed / 2.6 + 0.2) % 1
                    const inHop = clamp01((phase - 0.3) / 0.32)
                    const hop = Math.sin(Math.PI * inHop) * amp
                    animal.position.y = Math.sin(elapsed * 1.3 + 0.7) * 0.06 + hop * 0.42
                    animal.scale.y = propScale * (
                        1 + 0.14 * hop - 0.12 * amp * Math.exp(- Math.pow((phase - 0.66) * 22, 2))
                    )
                    animal.rotation.z = hop * 0.12
                }
            }

        })
    })

    return (
        <group ref={ group }>
            { MEMBERS.map((member, index) =>
                <group
                    key={ member.slot }
                    ref={ (instance) => { bodies.current[index] = instance } }
                >
                    <mesh geometry={ crewPairs[index].columnGeometry } material={ materials[index] } />
                    <mesh geometry={ crewPairs[index].columnGeometry } material={ wireMaterial } renderOrder={ 4 } />

                    <group ref={ (instance) => { animals.current[index] = instance } }>
                        <mesh geometry={ crewPairs[index].objectGeometry } material={ materials[index] } />
                        <mesh geometry={ crewPairs[index].objectGeometry } material={ wireMaterial } renderOrder={ 4 } />
                    </group>
                </group>
            ) }
        </group>
    )
}
