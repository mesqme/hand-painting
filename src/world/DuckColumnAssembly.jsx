import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import gsap from 'gsap'

import useDuckColumn from './useDuckColumn.jsx'
import { createAssetMaterial, updateAssetMaterial } from './materials/assetMaterial.js'
import { ensureLibrary, getTextureById, getPaintedDefault } from './textureLibrary.js'
import useStage from '../stores/useStage.jsx'
import { params } from '../scroll/choreography.js'

/**
 * The hero duck + column. One assembly plays every act: clay model, gradient
 * lookup, bake reference and the hand-painted result with live texture swaps.
 */
export default function DuckColumnAssembly()
{
    const group = useRef()
    const duck = useRef()
    const wireColumn = useRef()
    const wireDuck = useRef()
    const currentPaint = useRef(null)

    const { duckGeometry, columnGeometry } = useDuckColumn()
    const gradientTexture = useTexture('./textures/gradientPalette.png')

    /**
     * Materials + texture library
     */
    const { material, wireMaterial } = useMemo(() =>
    {
        ensureLibrary(gradientTexture)

        const painted = getPaintedDefault()
        currentPaint.current = painted

        const material = createAssetMaterial({
            mapBase: gradientTexture,
            mapPaintA: painted,
            mapPaintB: painted,
            whiteMix: 1,
        })
        const wireMaterial = createAssetMaterial({ wireframe: true, flatShade: true, opacity: 0.28 })

        return { material, wireMaterial }
    }, [gradientTexture])

    /**
     * Live texture swaps from the tray / dropped files
     */
    useEffect(() =>
    {
        const unsubscribeApply = useStage.subscribe(
            (state) => state.applySeq,
            () =>
            {
                const texture = getTextureById(useStage.getState().applyId)
                if(!texture || texture === currentPaint.current)
                    return

                const uniforms = material.uniforms
                uniforms.uMapPaintA.value = currentPaint.current
                uniforms.uMapPaintB.value = texture
                currentPaint.current = texture

                gsap.fromTo(uniforms.uSwapWipe,
                    { value: 0 },
                    {
                        value: 1,
                        duration: 0.9,
                        ease: 'power2.inOut',
                        overwrite: true,
                        onComplete: () =>
                        {
                            uniforms.uMapPaintA.value = texture
                            uniforms.uSwapWipe.value = 0
                        },
                    }
                )
            }
        )

        return () => unsubscribeApply()
    }, [material])

    useFrame((state) =>
    {
        const elapsed = state.clock.elapsedTime

        group.current.position.x = params.heroX
        group.current.position.y = params.heroY + Math.sin(elapsed * 0.6) * 0.03
        group.current.scale.setScalar(params.heroScale)
        group.current.visible = params.heroOpacity > 0.002

        // Duck floats above its column
        duck.current.position.y = Math.sin(elapsed * 1.3) * 0.06
        duck.current.rotation.z = Math.sin(elapsed * 0.8 + 1) * 0.02

        updateAssetMaterial(material, {
            whiteMix: params.whiteMix,
            opacity: params.heroOpacity,
            reveal: params.reveal,
        })

        const wireOpacity = params.wireOpacity * params.heroOpacity
        updateAssetMaterial(wireMaterial, { opacity: wireOpacity })
        wireColumn.current.visible = wireOpacity > 0.002
        wireDuck.current.visible = wireOpacity > 0.002
    })

    return (
        <group ref={ group }>
            <mesh geometry={ columnGeometry } material={ material } />
            <mesh ref={ wireColumn } geometry={ columnGeometry } material={ wireMaterial } />

            <group ref={ duck }>
                <mesh geometry={ duckGeometry } material={ material } />
                <mesh ref={ wireDuck } geometry={ duckGeometry } material={ wireMaterial } />
            </group>
        </group>
    )
}
