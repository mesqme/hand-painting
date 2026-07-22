import * as THREE from 'three'
import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'

import { buildIslandModel } from './unwrapLayout.js'
import { WORLD } from '../config.js'

/**
 * Loads the duck + column and bakes the authored Blender transforms into the
 * geometries, so every copy shares one normalised local space: centered on
 * origin, assemblyHeight tall, with the floating tilt preserved. Geometries
 * are de-indexed so the island model can assign every face to exactly one
 * island, then get their aUnwrapUv/aPackOrder attributes plus seam lines.
 *
 * Seven components consume this hook; the build is cached per gltf at module
 * level so the weld/cluster/pack work runs once and every consumer shares one
 * geometry pair (nobody mutates the result).
 */
const buildCache = new WeakMap()

export default function useDuckColumn()
{
    const gltf = useGLTF('./models/duckColumn.glb')

    return useMemo(() =>
    {
        const cached = buildCache.get(gltf)
        if(cached)
            return cached
        gltf.scene.updateMatrixWorld(true)
        const duckSource = gltf.scene.getObjectByName('duck')
        const columnSource = gltf.scene.getObjectByName('column')

        let duckGeometry = duckSource.geometry.clone().applyMatrix4(duckSource.matrixWorld)
        let columnGeometry = columnSource.geometry.clone().applyMatrix4(columnSource.matrixWorld)

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

        // Face-owned corners so every corner carries its own uv1 (seams are
        // split corners) for clean island + seam derivation
        duckGeometry = duckGeometry.toNonIndexed()
        columnGeometry = columnGeometry.toNonIndexed()

        // Real islands + seams from the GLB's second UV layer (TEXCOORD_1)
        const islandModel = buildIslandModel([ duckGeometry, columnGeometry ])

        // Seam-line buffers per part, so the duck's seams ride its float
        const duckSeams = islandModel.seamsByGeometry.get(duckGeometry)
        const columnSeams = islandModel.seamsByGeometry.get(columnGeometry)

        const result = { duckGeometry, columnGeometry, islandModel, duckSeams, columnSeams }
        buildCache.set(gltf, result)
        return result
    }, [gltf])
}

useGLTF.preload('./models/duckColumn.glb')
