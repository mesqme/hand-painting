import * as THREE from 'three'
import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'

import { buildUnwrapAttribute } from './unwrapLayout.js'
import { WORLD } from '../config.js'

/**
 * Loads the duck + column and bakes the authored Blender transforms into the
 * geometries, so every copy (hero, ring, bake rig, minis, batched shelf)
 * shares one normalised local space: centered on origin, assemblyHeight tall,
 * with the floating tilt preserved from the .blend file.
 */
export default function useDuckColumn()
{
    const gltf = useGLTF('./models/duckColumn.glb')

    return useMemo(() =>
    {
        gltf.scene.updateMatrixWorld(true)
        const duckSource = gltf.scene.getObjectByName('duck')
        const columnSource = gltf.scene.getObjectByName('column')

        const duckGeometry = duckSource.geometry.clone().applyMatrix4(duckSource.matrixWorld)
        const columnGeometry = columnSource.geometry.clone().applyMatrix4(columnSource.matrixWorld)

        // Center the pair and normalise the height
        const bounds = new THREE.Box3().setFromBufferAttribute(duckGeometry.attributes.position)
        bounds.union(new THREE.Box3().setFromBufferAttribute(columnGeometry.attributes.position))

        const center = bounds.getCenter(new THREE.Vector3())
        const size = bounds.getSize(new THREE.Vector3())
        const scale = WORLD.assemblyHeight / size.y

        const normalise = new THREE.Matrix4()
            .makeScale(scale, scale, scale)
            .multiply(new THREE.Matrix4().makeTranslation(- center.x, - center.y, - center.z))

        duckGeometry.applyMatrix4(normalise)
        columnGeometry.applyMatrix4(normalise)

        // Stand-in 0-1 unwrap for the bake morph + act-02 island animation
        buildUnwrapAttribute([ duckGeometry, columnGeometry ])

        return { duckGeometry, columnGeometry }
    }, [gltf])
}

useGLTF.preload('./models/duckColumn.glb')
