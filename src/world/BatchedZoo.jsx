import * as THREE from 'three'
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'

import useDuckColumn from './useDuckColumn.jsx'
import { prepareMapTexture } from './textureLibrary.js'
import { params } from '../scroll/choreography.js'

/**
 * Step 08 — the finale shelf. Four columns and four different floaters,
 * different geometry each, all merged into ONE BatchedMesh with one shared
 * atlas material: the perf monitor reads a single draw call.
 */
const COLUMNS_X = [ - 2.75, - 0.95, 0.95, 2.75 ]

const easeOutBack = (t) =>
{
    const c1 = 1.70158
    const c3 = c1 + 1
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}

const clamp01 = (value) => Math.min(Math.max(value, 0), 1)

export default function BatchedZoo()
{
    const group = useRef()
    const dummy = useMemo(() => new THREE.Object3D(), [])

    const { duckGeometry, columnGeometry } = useDuckColumn()
    const gradientTexture = useTexture('./textures/gradientPalette.png')

    const zoo = useMemo(() =>
    {
        prepareMapTexture(gradientTexture)

        // Geometry
        const knotGeometry = new THREE.TorusKnotGeometry(0.28, 0.095, 96, 14)
        const torusGeometry = new THREE.TorusGeometry(0.3, 0.125, 14, 28)

        // Material
        const material = new THREE.MeshLambertMaterial({ map: gradientTexture })

        // Batched mesh — the first geometry defines the batch attribute layout,
        // so the duck/column go in stripped of the presentation-only aUnwrapUv
        // (the primitives don't have it and BatchedMesh validates against it)
        const batchColumnGeometry = columnGeometry.clone()
        batchColumnGeometry.deleteAttribute('aUnwrapUv')
        const batchDuckGeometry = duckGeometry.clone()
        batchDuckGeometry.deleteAttribute('aUnwrapUv')

        const batched = new THREE.BatchedMesh(8, 8000, 48000, material)
        const columnId = batched.addGeometry(batchColumnGeometry)
        const duckId = batched.addGeometry(batchDuckGeometry)
        const knotId = batched.addGeometry(knotGeometry)
        const torusId = batched.addGeometry(torusGeometry)
        batched.sortObjects = false
        batched.perObjectFrustumCulled = false

        const instances = [
            // Columns
            { geometryId: columnId, x: COLUMNS_X[0], y: 0, baseScale: 0.96, bob: 0, phase: 0, spin: 0 },
            { geometryId: columnId, x: COLUMNS_X[1], y: 0, baseScale: 1.04, bob: 0, phase: 0, spin: 0, rotationY: 0.7 },
            { geometryId: columnId, x: COLUMNS_X[2], y: 0, baseScale: 0.9, bob: 0, phase: 0, spin: 0, rotationY: - 0.5 },
            { geometryId: columnId, x: COLUMNS_X[3], y: 0, baseScale: 1, bob: 0, phase: 0, spin: 0, rotationY: 0.3 },

            // Floaters — the duck geometry already carries its floating height
            { geometryId: duckId, x: COLUMNS_X[0], y: 0, baseScale: 0.96, bob: 0.07, phase: 0.3, spin: 0 },
            { geometryId: knotId, x: COLUMNS_X[1], y: 0.98, baseScale: 1, bob: 0.08, phase: 1.6, spin: 0.45 },
            { geometryId: duckId, x: COLUMNS_X[2], y: 0.02, baseScale: 0.78, bob: 0.07, phase: 2.9, spin: 0, rotationY: 2.7 },
            { geometryId: torusId, x: COLUMNS_X[3], y: 0.98, baseScale: 1, bob: 0.08, phase: 4.1, spin: 0.4, rotationX: 0.55 },
        ]

        for(const instance of instances)
            instance.instanceId = batched.addInstance(instance.geometryId)

        return { batched, instances }
    }, [gradientTexture, duckGeometry, columnGeometry])

    useFrame((state) =>
    {
        const elapsed = state.clock.elapsedTime
        const visible = params.batchIn > 0.005

        group.current.visible = visible
        if(!visible)
            return

        group.current.rotation.y = Math.sin(elapsed * 0.12) * 0.07

        zoo.instances.forEach((instance, index) =>
        {
            const pop = easeOutBack(clamp01(params.batchIn * 1.35 - index * 0.06))

            dummy.position.set(
                instance.x,
                instance.y + Math.sin(elapsed * 1.1 + instance.phase) * instance.bob,
                0
            )
            dummy.rotation.set(
                instance.rotationX ?? 0,
                (instance.rotationY ?? 0) + instance.spin * elapsed,
                0
            )
            dummy.scale.setScalar(Math.max(instance.baseScale * pop, 0.0001))
            dummy.updateMatrix()

            zoo.batched.setMatrixAt(instance.instanceId, dummy.matrix)
        })
    })

    return (
        <group ref={ group } position={ [ 0.75, - 0.15, 0 ] } scale={ 0.85 }>
            <primitive object={ zoo.batched } />
        </group>
    )
}
