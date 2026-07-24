import * as THREE from 'three'
import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'

import { buildIslandModel } from './unwrapLayout.js'
import { WORLD } from '../config.js'

/**
 * Loads pairs.glb — four object+column pairs sharing one authoring spot:
 * duck/column_duck (the hero), barrel/column_barrel, book/column_book and
 * meat/column_meat (the crew). For every pair the authored Blender transforms
 * are baked into the geometries and the pair is normalised to one shared
 * local space: centered on origin, assemblyHeight tall, tilt preserved.
 *
 * The hero pair carries the real seam-cut unwrap (TEXCOORD_1), so its full
 * island model (islands, seams, aUnwrapUv/aPackOrder) is built for acts 02/04.
 * Crew pairs also expose their baked UV as aUnwrapUv when TEXCOORD_1 exists.
 * Older exports without it fall back to TEXCOORD_0 until they are re-exported.
 *
 * The build is cached per gltf at module level so the weld/cluster work runs
 * once and every consumer shares one geometry set (nobody mutates the result).
 */
const CREW_PAIRS = [ 'barrel', 'book', 'meat' ]

const buildCache = new WeakMap()

function bakeGeometry(gltf, name)
{
    const source = gltf.scene.getObjectByName(name)
    return source.geometry.clone().applyMatrix4(source.matrixWorld)
}

// Center the pair on the origin and normalise its height in place
function normalisePair(geometries)
{
    const bounds = new THREE.Box3()
    for(const geometry of geometries)
        bounds.union(new THREE.Box3().setFromBufferAttribute(geometry.attributes.position))

    const center = bounds.getCenter(new THREE.Vector3())
    const size = bounds.getSize(new THREE.Vector3())
    const scale = WORLD.assemblyHeight / size.y

    const normalise = new THREE.Matrix4()
        .makeScale(scale, scale, scale)
        .multiply(new THREE.Matrix4().makeTranslation(- center.x, - center.y, - center.z))

    for(const geometry of geometries)
        geometry.applyMatrix4(normalise)
}

function attachPaintUv(geometry)
{
    const bakedUv = geometry.attributes.uv1
    const fallbackUv = geometry.attributes.uv
    const paintUv = bakedUv ?? fallbackUv

    if(!paintUv)
        throw new Error('A crew geometry is missing both TEXCOORD_0 and TEXCOORD_1.')

    geometry.setAttribute('aUnwrapUv', paintUv.clone())
    geometry.setAttribute(
        'aPackOrder',
        new THREE.BufferAttribute(new Float32Array(geometry.attributes.position.count), 1)
    )
    geometry.userData.hasBakedUv = Boolean(bakedUv)
}

export default function usePairs()
{
    const gltf = useGLTF('./models/pairs.glb')

    return useMemo(() =>
    {
        const cached = buildCache.get(gltf)
        if(cached)
            return cached

        gltf.scene.updateMatrixWorld(true)

        /**
         * Hero pair — de-indexed (face-owned corners so every corner carries
         * its own uv1; seams are split corners), then islands + seams
         */
        let duckGeometry = bakeGeometry(gltf, 'duck')
        let columnGeometry = bakeGeometry(gltf, 'column_duck')
        normalisePair([ duckGeometry, columnGeometry ])

        duckGeometry = duckGeometry.toNonIndexed()
        columnGeometry = columnGeometry.toNonIndexed()

        const islandModel = buildIslandModel([ duckGeometry, columnGeometry ])
        const duckSeams = islandModel.seamsByGeometry.get(duckGeometry)
        const columnSeams = islandModel.seamsByGeometry.get(columnGeometry)

        /**
         * Crew pairs stay indexed. Painted maps prefer the authored second UV;
         * the explicit uv0 fallback keeps unfinished placeholder assets usable.
         */
        const crewPairs = CREW_PAIRS.map((name) =>
        {
            const objectGeometry = bakeGeometry(gltf, name)
            const pairColumnGeometry = bakeGeometry(gltf, `column_${ name }`)
            normalisePair([ objectGeometry, pairColumnGeometry ])
            attachPaintUv(objectGeometry)
            attachPaintUv(pairColumnGeometry)
            return { name, objectGeometry, columnGeometry: pairColumnGeometry }
        })

        const result = { duckGeometry, columnGeometry, islandModel, duckSeams, columnSeams, crewPairs }
        buildCache.set(gltf, result)
        return result
    }, [gltf])
}

useGLTF.preload('./models/pairs.glb')
