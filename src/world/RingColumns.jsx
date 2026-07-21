import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'

import useDuckColumn from './useDuckColumn.jsx'
import { createAssetMaterial, updateAssetMaterial } from './materials/assetMaterial.js'
import { prepareMapTexture } from './textureLibrary.js'
import { params } from '../scroll/choreography.js'

/**
 * Step 03 — the test scene: sibling assemblies pop in around the shrunken
 * hero to sanity-check palette balance in context.
 */
const CLONES = [
    { position: [ - 2.35, 0.42, - 1.3 ], scale: 0.5, rotationY: 0.5 },
    { position: [ 2.35, 0.58, - 1.5 ], scale: 0.55, rotationY: - 0.6 },
    { position: [ - 1.78, - 0.5, 0.55 ], scale: 0.4, rotationY: 0.25 },
    { position: [ 1.85, - 0.42, 0.5 ], scale: 0.44, rotationY: - 0.3 },
]

const easeOutBack = (t) =>
{
    const c1 = 1.70158
    const c3 = c1 + 1
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}

export default function RingColumns()
{
    const group = useRef()
    const clones = useRef([])

    const { duckGeometry, columnGeometry } = useDuckColumn()
    const gradientTexture = useTexture('./textures/gradientPalette.png')

    const material = useMemo(() =>
    {
        prepareMapTexture(gradientTexture)
        return createAssetMaterial({ mapBase: gradientTexture, whiteMix: 0 })
    }, [gradientTexture])

    useFrame((state) =>
    {
        const elapsed = state.clock.elapsedTime
        const fadeOut = 1 - params.ringOut

        group.current.visible = params.ringIn > 0.005 && params.ringOut < 0.995
        updateAssetMaterial(material, { opacity: Math.min(params.ringIn * 2, 1) * fadeOut })

        clones.current.forEach((clone, index) =>
        {
            if(!clone)
                return

            const config = CLONES[index]
            const raw = Math.min(Math.max((params.ringIn - index * 0.12) / 0.6, 0), 1)
            const pop = easeOutBack(raw)

            clone.scale.setScalar(Math.max(config.scale * pop * fadeOut, 0.0001))
            clone.position.y = config.position[1] + Math.sin(elapsed * 1.1 + index * 1.9) * 0.05
        })
    })

    return (
        <group ref={ group }>
            { CLONES.map((config, index) =>
                <group
                    key={ index }
                    ref={ (instance) => { clones.current[index] = instance } }
                    position={ config.position }
                    rotation-y={ config.rotationY }
                >
                    <mesh geometry={ columnGeometry } material={ material } />
                    <mesh geometry={ duckGeometry } material={ material } />
                </group>
            ) }
        </group>
    )
}
