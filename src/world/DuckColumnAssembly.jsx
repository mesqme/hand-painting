import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'

import usePairs from './usePairs.jsx'
import { createAssetMaterial, updateAssetMaterial } from './materials/assetMaterial.js'
import { ensureLibrary, getTextureById, getPaintedDefault, textureLibrary } from './textureLibrary.js'
import useStage from '../stores/useStage.jsx'
import { params } from '../scroll/choreography.js'
import { COLORS } from '../config.js'

/**
 * The hero duck + column. One assembly plays every act: clay model, gradient
 * lookup, seam-cut bake reference, and the hand-painted result with both
 * scripted (act 06) and user-driven live texture swaps.
 */
export default function DuckColumnAssembly()
{
    const group = useRef()
    const duck = useRef()
    const wireColumn = useRef()
    const wireDuck = useRef()
    const currentPaint = useRef(null)

    const { duckGeometry, columnGeometry, duckSeams, columnSeams } = usePairs()
    const maps = useTexture({
        gradient: './textures/gradientPalette.png',
        baked: './textures/duck_baked.png',
        base: './textures/duck_base.png',
        pastel: './textures/duck_pastel.png',
        red: './textures/duck_red.png',
        aberration: './textures/duck_base_abberation.png',
    })

    /**
     * Materials + texture library + seam lines
     */
    const { material, wireMaterial, seamMaterial, duckSeamLine, columnSeamLine } = useMemo(() =>
    {
        ensureLibrary(maps)

        const painted = getPaintedDefault()
        currentPaint.current = painted

        const material = createAssetMaterial({
            mapBase: maps.gradient,
            mapPaintA: painted,
            mapPaintB: painted,
            whiteMix: 1,
            uvPack: 0,
        })
        const wireMaterial = createAssetMaterial({ wireframe: true, flatShade: true, opacity: 0.28 })

        // Constant-width red lines — the color alone marks the seams (no
        // thickness animation)
        const seamMaterial = new LineMaterial({
            color: COLORS.seam,
            linewidth: 2,
            transparent: true,
            opacity: 0,
        })
        const duckSeamLine = new LineSegments2(
            new LineSegmentsGeometry().setPositions(duckSeams),
            seamMaterial
        )
        const columnSeamLine = new LineSegments2(
            new LineSegmentsGeometry().setPositions(columnSeams),
            seamMaterial
        )

        return { material, wireMaterial, seamMaterial, duckSeamLine, columnSeamLine }
    }, [maps, duckSeams, columnSeams])

    /**
     * Live texture selection is intentionally immediate. The presentation
     * demonstrates comparing options, not blending between them.
     */
    useEffect(() =>
    {
        const uniforms = material.uniforms

        const unsubscribeApply = useStage.subscribe(
            (state) => state.applySeq,
            () =>
            {
                const id = useStage.getState().applyId
                const texture = getTextureById(id)
                if(!texture || texture === currentPaint.current)
                    return

                currentPaint.current = texture
                uniforms.uMapPaintA.value = texture
                uniforms.uMapPaintB.value = texture
                uniforms.uSwapWipe.value = 0
            }
        )

        return () => unsubscribeApply()
    }, [material])

    const lastPaintTexture = useRef(3)

    useFrame((state) =>
    {
        const elapsed = state.clock.elapsedTime

        group.current.position.x = params.heroX
        // The idle bob fades out while standing on a scene-window floor
        group.current.position.y = params.heroY + Math.sin(elapsed * 0.6) * 0.03 * (1 - params.heroStanding)
        group.current.position.z = params.heroZ
        group.current.scale.setScalar(params.heroScale)
        group.current.visible = params.heroOpacity > 0.002

        // Scroll turns the model gently (pitch joins the level view); a slow
        // drift keeps it alive in between
        group.current.rotation.x = params.heroRotX
        group.current.rotation.y = params.heroRotY + Math.sin(elapsed * 0.35) * 0.12 * (1 - params.heroStanding)

        // Duck floats above its column
        duck.current.position.y = Math.sin(elapsed * 1.3) * 0.06
        duck.current.rotation.z = Math.sin(elapsed * 0.8 + 1) * 0.02

        const uniforms = material.uniforms
        const selection = Math.round(params.paintTexture)
        if(selection !== lastPaintTexture.current)
        {
            const ids = [ 'base', 'pastel', 'red', 'aberration' ]
            const id = ids[Math.min(Math.max(selection, 0), ids.length - 1)]
            const texture = getTextureById(id)
            if(texture)
            {
                currentPaint.current = texture
                uniforms.uMapPaintA.value = texture
                uniforms.uMapPaintB.value = texture
                uniforms.uSwapWipe.value = 0
                const stage = useStage.getState()
                if(stage.activeSwatch !== id)
                    useStage.setState({ activeSwatch: id })
            }
            lastPaintTexture.current = selection
        }

        // After the bake sweep, mapBase is the real baked texture and UVs
        // snap back to the uv1 unwrap (gradient acts sample uv0 strips)
        const baked = params.bakeSweep > 0.001
        uniforms.uMapBase.value = baked ? textureLibrary.baked : textureLibrary.gradient

        updateAssetMaterial(material, {
            whiteMix: params.whiteMix,
            opacity: params.heroOpacity,
            reveal: params.reveal,
            uvPack: baked ? 0 : params.uvProgress,
            surfaceWipe: params.heroSurface,
        })

        const wireOpacity = params.wireOpacity * params.heroOpacity
        updateAssetMaterial(wireMaterial, { opacity: wireOpacity })
        wireColumn.current.visible = wireOpacity > 0.002
        wireDuck.current.visible = wireOpacity > 0.002

        // Seams for the bake act — red lines, constant width
        seamMaterial.opacity = params.seamOpacity * params.heroOpacity
        seamMaterial.resolution.set(state.size.width, state.size.height)
        duckSeamLine.visible = seamMaterial.opacity > 0.002
        columnSeamLine.visible = seamMaterial.opacity > 0.002
    })

    return (
        <group ref={ group }>
            <mesh geometry={ columnGeometry } material={ material } />
            <mesh ref={ wireColumn } geometry={ columnGeometry } material={ wireMaterial } />

            <group ref={ duck }>
                <mesh geometry={ duckGeometry } material={ material } />
                <mesh ref={ wireDuck } geometry={ duckGeometry } material={ wireMaterial } />
                <primitive object={ duckSeamLine } />
            </group>

            <primitive object={ columnSeamLine } />
        </group>
    )
}
