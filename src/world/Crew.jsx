import * as THREE from 'three'
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'

import useDuckColumn from './useDuckColumn.jsx'
import { createAssetMaterial, updateAssetMaterial } from './materials/assetMaterial.js'
import { createShadowMaterial } from './materials/softShadow.js'
import { ensureLibrary, textureLibrary } from './textureLibrary.js'
import { clampFrameX } from '../ui/frameFit.js'
import { params } from '../scroll/choreography.js'
import { COLORS, ISO, ISO_SLOTS, isoSlotOffset, ROW_X, ROW_Y, ROW_SCALE } from '../config.js'

/**
 * The crew — the three non-hero members of the four-piece cast (the hero owns
 * slot 1) plus the level-view floor grid and every contact shadow. One
 * component serves four acts:
 *   03  standing on the grid in gradient look
 *   06  same scene, painted — the artist's context
 *   07  the whole crew glides into the frontal line-up for the atlas
 *   09  back on the grid as wireframes, then the combined texture applies
 *       and every creature comes alive
 */
// row = final line-up slot; arc = depth bulge during the glide so members that
// cross the hero's x-path pass at a different z instead of clipping through it
const MEMBERS = [
    { slot: 0, row: 2, entry: 1, animal: 'duck', rowYaw: 0.3, arc: 0.55 },
    { slot: 2, row: 0, entry: 2, animal: 'knot', rowYaw: - 0.2, arc: 0 },
    { slot: 3, row: 3, entry: 3, animal: 'torus', rowYaw: 0.2, arc: - 0.55 },
]

const easeOutBack = (t) =>
{
    const c1 = 1.70158
    const c3 = c1 + 1
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}

const smooth = (t) => t * t * (3 - 2 * t)
const clamp01 = (value) => Math.min(Math.max(value, 0), 1)
const lerp = (a, b, t) => a + (b - a) * t

export default function Crew()
{
    const group = useRef()
    const stageGroup = useRef()
    const bodies = useRef([])
    const animals = useRef([])
    const shadows = useRef([])

    const { duckGeometry, columnGeometry } = useDuckColumn()
    const gradientTexture = useTexture('./textures/gradientPalette.png')

    const { materials, wireMaterial, shadowMaterial, gridMaterial, gridGeometry, knotGeometry, torusGeometry } = useMemo(() =>
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

        // Level-view floor grid on the iso XZ plane. The front corner (max +z,
        // min -x) projects below the window, so segments are chamfered along
        // the screen-horizontal line z - x = clip to keep the grid contained.
        const gridMaterial = new THREE.LineBasicMaterial({ color: COLORS.ink, transparent: true, opacity: 0 })
        const points = []
        const extent = 1.9
        const step = 0.475
        const clip = 1.7
        for(let x = - extent; x <= extent + 0.001; x += step)
        {
            const zEnd = Math.min(extent, x + clip)
            if(zEnd > - extent + 0.001)
                points.push(x, 0, - extent, x, 0, zEnd)
        }
        for(let z = - extent; z <= extent + 0.001; z += step)
        {
            const xStart = Math.max(- extent, z - clip)
            if(xStart < extent - 0.001)
                points.push(xStart, 0, z, extent, 0, z)
        }
        const gridGeometry = new THREE.BufferGeometry()
        gridGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(points), 3))

        return {
            materials,
            wireMaterial,
            shadowMaterial,
            gridMaterial,
            gridGeometry,
            knotGeometry: new THREE.TorusKnotGeometry(0.3, 0.1, 96, 14),
            torusGeometry: new THREE.TorusGeometry(0.32, 0.13, 14, 28),
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

        // Single ease from the tween drives the glide (matches the hero's tween)
        const rowT = clamp01(params.crewRow)
        const crewOpacity = clamp01(params.crewVisible * 1.5)
        const wireOpacity = params.crewWire * crewOpacity
        wireMaterial.uniforms.uOpacity.value = wireOpacity

        MEMBERS.forEach((member, index) =>
        {
            const body = bodies.current[index]
            if(!body)
                return

            /**
             * Transform: level-view slot ↔ frontal row
             */
            const iso = isoSlotOffset(member.slot)
            const pop = easeOutBack(clamp01(params.crewVisible * 1.3 - index * 0.12))

            const rowBob = Math.sin(elapsed * 1.1 + index * 1.9) * 0.045 * rowT
            body.position.x = lerp(frameX + iso.x, ROW_X[member.row], rowT)
            body.position.y = lerp(iso.y, ROW_Y + rowBob, rowT)
            // Depth arc so crossing members pass the hero at a different z
            body.position.z = lerp(iso.z, 0, rowT) + member.arc * Math.sin(Math.PI * rowT)
            body.rotation.x = ISO.pitch * (1 - rowT)
            body.rotation.y = lerp(ISO.yaw, member.rowYaw, rowT)
            body.scale.setScalar(Math.max(lerp(ISO.scale, ROW_SCALE, rowT) * pop, 0.0001))

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
             * Creature life — mild by default, full personality once the
             * combined texture lands in act 09
             */
            const animal = animals.current[index]
            if(animal)
            {
                const amp = smooth(clamp01(params.batchTexApply * 1.6 - index * 0.2))

                if(member.animal === 'duck')
                {
                    const phase = (elapsed / 2.6 + 0.2) % 1
                    const inHop = clamp01((phase - 0.3) / 0.32)
                    const hop = Math.sin(Math.PI * inHop) * amp
                    animal.position.y = Math.sin(elapsed * 1.3 + 0.7) * 0.06 + hop * 0.42
                    animal.scale.y = 1 + 0.14 * hop - 0.12 * amp * Math.exp(- Math.pow((phase - 0.66) * 22, 2))
                    animal.rotation.z = hop * 0.12
                }
                else if(member.animal === 'knot')
                {
                    animal.rotation.y = elapsed * (0.4 + 0.6 * amp)
                    animal.rotation.z = Math.sin(elapsed * 0.7) * 0.15 * amp
                    animal.position.y = 0.95 + Math.sin(elapsed * 1.1 + 1.6) * 0.06
                }
                else
                {
                    animal.rotation.x = 0.5 + elapsed * (0.25 + 0.95 * amp)
                    animal.position.y = 0.95 + Math.sin(elapsed * 0.9 + 4) * 0.05
                    animal.position.z = Math.sin(elapsed * 0.9) * 0.08 * amp
                }
            }

            /**
             * Shadow under this member's slot — fades away in row formation
             */
            const shadow = shadows.current[index]
            if(shadow)
                shadow.scale.setScalar(Math.max(pop * (1 - rowT), 0.0001))
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
                    <mesh geometry={ columnGeometry } material={ materials[index] } />
                    <mesh geometry={ columnGeometry } material={ wireMaterial } />

                    <group ref={ (instance) => { animals.current[index] = instance } }>
                        { member.animal === 'duck' && <>
                            <mesh geometry={ duckGeometry } material={ materials[index] } />
                            <mesh geometry={ duckGeometry } material={ wireMaterial } />
                        </> }
                        { member.animal === 'knot' && <>
                            <mesh geometry={ knotGeometry } material={ materials[index] } />
                            <mesh geometry={ knotGeometry } material={ wireMaterial } />
                        </> }
                        { member.animal === 'torus' && <>
                            <mesh geometry={ torusGeometry } material={ materials[index] } />
                            <mesh geometry={ torusGeometry } material={ wireMaterial } />
                        </> }
                    </group>
                </group>
            ) }
        </group>
    )
}
