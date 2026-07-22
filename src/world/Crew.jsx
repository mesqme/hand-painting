import * as THREE from 'three'
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'

import usePairs from './usePairs.jsx'
import { createAssetMaterial, updateAssetMaterial } from './materials/assetMaterial.js'
import { createShadowMaterial } from './materials/softShadow.js'
import { ensureLibrary, textureLibrary } from './textureLibrary.js'
import { clampFrameX } from '../ui/frameFit.js'
import { params } from '../scroll/choreography.js'
import { COLORS, ISO, ISO_SLOTS, ISO_GRID_EXTENT, ISO_GRID_STEP, isoSlotOffset } from '../config.js'

/**
 * The crew — the three non-hero members of the four-piece cast (the hero owns
 * slot 1) plus the level-view floor grid and every contact shadow. Each member
 * is a REAL object+column pair from pairs.glb (barrel, book, meat — the hero
 * keeps the duck pair). One component serves four acts:
 *   03  standing on the grid in gradient look
 *   06  same scene, painted — the artist's context
 *   07  everyone HOLDS their slot while the texture sheets fly off the models
 *   09  back on the grid as wireframes, then the combined texture applies
 *       and every object comes alive
 */
// pair indexes into usePairs().crewPairs — [ barrel, book, meat ]
const MEMBERS = [
    { slot: 0, entry: 1, pair: 'barrel' },
    { slot: 2, entry: 2, pair: 'book' },
    { slot: 3, entry: 3, pair: 'meat' },
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
    const stageGroup = useRef()
    const bodies = useRef([])
    const animals = useRef([])
    const shadows = useRef([])

    const { crewPairs } = usePairs()
    const gradientTexture = useTexture('./textures/gradientPalette.png')

    const { materials, wireMaterial, shadowMaterial, gridMaterial, gridGeometry } = useMemo(() =>
    {
        ensureLibrary(gradientTexture)

        const materials = MEMBERS.map((member) =>
        {
            const entry = textureLibrary.entries[member.entry]
            const painted = entry ? entry.texture : gradientTexture
            return createAssetMaterial({ mapBase: gradientTexture, mapPaintA: painted, mapPaintB: painted, whiteMix: 0 })
        })

        const wireMaterial = createAssetMaterial({ wireframe: true, flatShade: true, opacity: 0 })
        const shadowMaterial = createShadowMaterial()

        // Level-view floor grid on the iso XZ plane — a COMPLETE square (no
        // chamfered corner): the whole scene is sized so it projects inside
        // the window at every aspect (verify-geometry checks this).
        const gridMaterial = new THREE.LineBasicMaterial({ color: COLORS.ink, transparent: true, opacity: 0 })
        const points = []
        const extent = ISO_GRID_EXTENT
        const step = ISO_GRID_STEP
        for(let x = - extent; x <= extent + 0.001; x += step)
            points.push(x, 0, - extent, x, 0, extent)
        for(let z = - extent; z <= extent + 0.001; z += step)
            points.push(- extent, 0, z, extent, 0, z)
        const gridGeometry = new THREE.BufferGeometry()
        gridGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(points), 3))

        return {
            materials,
            wireMaterial,
            shadowMaterial,
            gridMaterial,
            gridGeometry,
        }
    }, [gradientTexture])

    useFrame((state) =>
    {
        const elapsed = state.clock.elapsedTime
        const visible = params.crewVisible > 0.005 || params.frameOpacity > 0.005

        group.current.visible = visible
        if(!visible)
            return

        /**
         * Stage: floor grid + shadows in the tilted level view. The frame shift
         * is clamped through the same helper the DOM window uses, so grid and
         * window stay concentric (identity on landscape).
         */
        const frameX = clampFrameX(params.frameX)
        stageGroup.current.position.x = frameX
        stageGroup.current.position.y = ISO.centerY
        gridMaterial.opacity = params.frameOpacity * 0.3
        shadowMaterial.opacity = params.frameOpacity * 0.75

        const crewOpacity = clamp01(params.crewVisible * 1.5)
        const wireOpacity = params.crewWire * crewOpacity
        wireMaterial.uniforms.uOpacity.value = wireOpacity

        MEMBERS.forEach((member, index) =>
        {
            const body = bodies.current[index]
            if(!body)
                return

            /**
             * Transform: every member holds its level-view slot
             */
            const iso = isoSlotOffset(member.slot)
            const pop = easeOutBack(clamp01(params.crewVisible * 1.3 - index * 0.12))

            body.position.x = frameX + iso.x
            body.position.y = iso.y
            body.position.z = iso.z
            body.rotation.x = ISO.pitch
            body.rotation.y = ISO.yaw
            body.scale.setScalar(Math.max(ISO.scale * pop, 0.0001))

            /**
             * Look: gradient → painted → (act 09) wireframe → applied. Solids
             * skip depth-write while invisible (surfaceWipe 0), so they can't
             * punch a silhouette hole into the floor grid behind them.
             */
            const surfaceWipe = clamp01(params.crewSurface * 1.4 - index * 0.12)
            materials[index].depthWrite = surfaceWipe > 0.001
            updateAssetMaterial(materials[index], {
                opacity: crewOpacity,
                reveal: params.crewPaint,
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
                const amp = smooth(clamp01(params.batchTexApply * 1.6 - index * 0.2))

                if(member.pair === 'barrel')
                {
                    animal.position.y = Math.sin(elapsed * 1.1 + 1.6) * 0.06
                    animal.rotation.y = elapsed * (0.35 + 0.65 * amp)
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
                    animal.scale.y = 1 + 0.14 * hop - 0.12 * amp * Math.exp(- Math.pow((phase - 0.66) * 22, 2))
                    animal.rotation.z = hop * 0.12
                }
            }

            /**
             * Shadow under this member's slot
             */
            const shadow = shadows.current[index]
            if(shadow)
                shadow.scale.setScalar(Math.max(pop, 0.0001))
        })

        // Hero slot shadow follows the hero's presence
        const heroShadow = shadows.current[MEMBERS.length]
        if(heroShadow)
            heroShadow.scale.setScalar(Math.max(params.heroOpacity * params.heroStanding, 0.0001))
    })

    return (
        <group ref={ group }>
            {/* Tilted stage: floor grid + flat contact shadows (all four slots) */}
            <group ref={ stageGroup } rotation={ [ ISO.pitch, ISO.yaw, 0 ] }>
                <lineSegments geometry={ gridGeometry } material={ gridMaterial } />

                { [ ...MEMBERS.map((member) => member.slot), 1 ].map((slot, index) =>
                    <mesh
                        key={ slot }
                        ref={ (instance) => { shadows.current[index] = instance } }
                        material={ shadowMaterial }
                        position={ [ ISO_SLOTS[slot][0], 0.015, ISO_SLOTS[slot][1] ] }
                        rotation-x={ - Math.PI / 2 }
                    >
                        <planeGeometry args={ [ 1.15, 0.62 ] } />
                    </mesh>
                ) }
            </group>

            { MEMBERS.map((member, index) =>
                <group
                    key={ member.slot }
                    ref={ (instance) => { bodies.current[index] = instance } }
                >
                    <mesh geometry={ crewPairs[index].columnGeometry } material={ materials[index] } />
                    <mesh geometry={ crewPairs[index].columnGeometry } material={ wireMaterial } />

                    <group ref={ (instance) => { animals.current[index] = instance } }>
                        <mesh geometry={ crewPairs[index].objectGeometry } material={ materials[index] } />
                        <mesh geometry={ crewPairs[index].objectGeometry } material={ wireMaterial } />
                    </group>
                </group>
            ) }
        </group>
    )
}
