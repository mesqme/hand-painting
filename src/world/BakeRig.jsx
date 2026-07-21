import * as THREE from 'three'
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'

import useDuckColumn from './useDuckColumn.jsx'
import { createAssetMaterial, updateAssetMaterial } from './materials/assetMaterial.js'
import { prepareMapTexture } from './textureLibrary.js'
import { params } from '../scroll/choreography.js'
import { WORLD } from '../config.js'

/**
 * Step 04 — the bake copy. While the reference lifts away, this duplicate
 * morphs vertex-by-vertex onto the palette sheet: positions travel to their
 * UV coordinates, which IS the unwrap (seams come free with the uv data).
 */
export default function BakeRig()
{
    const group = useRef()

    const { duckGeometry, columnGeometry } = useDuckColumn()
    const gradientTexture = useTexture('./textures/gradientPalette.png')

    const material = useMemo(() =>
    {
        prepareMapTexture(gradientTexture)

        // DoubleSide: flattened faces keep whatever winding the projection gave them
        return createAssetMaterial({
            mapBase: gradientTexture,
            whiteMix: 0,
            unwrapSize: WORLD.paletteSize,
            side: THREE.DoubleSide,
        })
    }, [gradientTexture])

    useFrame((state) =>
    {
        const unwrap = params.bakeUnwrap
        const travel = unwrap * unwrap * (3 - 2 * unwrap)

        // Match the hero's idle bob at the split, settle to the sheet at landing
        const heroBob = Math.sin(state.clock.elapsedTime * 0.6) * 0.03

        group.current.visible = params.bakeCopyOpacity > 0.002
        group.current.position.x = params.heroX + (params.paletteX - params.heroX) * travel
        group.current.position.y = heroBob * (1 - travel) + WORLD.paletteY * travel
        group.current.position.z = 0.03 * travel

        updateAssetMaterial(material, { unwrap, opacity: params.bakeCopyOpacity })
    })

    return (
        <group ref={ group }>
            <mesh geometry={ columnGeometry } material={ material } />
            <mesh geometry={ duckGeometry } material={ material } />
        </group>
    )
}
