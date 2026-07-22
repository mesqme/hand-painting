import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import gsap from 'gsap'

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
    const gradientTexture = useTexture('./textures/gradientPalette.png')

    /**
     * Materials + texture library + fat-line seams (thickness animates)
     */
    const { material, wireMaterial, seamMaterial, duckSeamLine, columnSeamLine } = useMemo(() =>
    {
        ensureLibrary(gradientTexture)

        const painted = getPaintedDefault()
        currentPaint.current = painted

        const material = createAssetMaterial({
            mapBase: gradientTexture,
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
    }, [gradientTexture, duckSeams, columnSeams])

    /**
     * Live texture swaps from the tray / dropped files — serialized, so two
     * quick clicks queue a second wipe instead of hard-cutting the first
     */
    const activeTween = useRef(null)
    const pendingId = useRef(null)

    useEffect(() =>
    {
        const uniforms = material.uniforms

        const startWipe = (texture) =>
        {
            uniforms.uMapPaintA.value = currentPaint.current
            uniforms.uMapPaintB.value = texture
            currentPaint.current = texture

            activeTween.current = gsap.fromTo(uniforms.uSwapWipe,
                { value: 0 },
                {
                    value: 1,
                    duration: 0.9,
                    ease: 'power2.inOut',
                    onComplete: () =>
                    {
                        uniforms.uMapPaintA.value = texture
                        uniforms.uSwapWipe.value = 0
                        activeTween.current = null

                        const next = pendingId.current
                        pendingId.current = null
                        if(next)
                        {
                            const nextTexture = getTextureById(next)
                            if(nextTexture && nextTexture !== currentPaint.current)
                                startWipe(nextTexture)
                        }
                    },
                }
            )
        }

        const unsubscribeApply = useStage.subscribe(
            (state) => state.applySeq,
            () =>
            {
                const id = useStage.getState().applyId
                const texture = getTextureById(id)
                if(!texture || texture === currentPaint.current)
                    return

                if(activeTween.current)
                {
                    pendingId.current = id
                    return
                }

                startWipe(texture)
            }
        )

        return () => unsubscribeApply()
    }, [material])

    /**
     * Scripted artist swaps (act 06) — an ownership machine, not a blind
     * override: scroll movement through the wipe windows takes the uniforms,
     * a user apply (click/drag/drop) takes them back, and leaving the windows
     * in EITHER scrub direction always restores the user-owned state.
     */
    const scripted = useRef({ engaged: false, from: null, seq: - 1, lastA: 0, lastB: 0 })

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
        const script = scripted.current
        const stage = useStage.getState()
        const wipeA = params.artistWipeA
        const wipeB = params.artistWipeB
        const scriptMoving = Math.abs(wipeA - script.lastA) > 0.0005 || Math.abs(wipeB - script.lastB) > 0.0005
        script.lastA = wipeA
        script.lastB = wipeB

        if(wipeA > 0.001 || wipeB > 0.001)
        {
            if(scriptMoving)
            {
                // Scroll is actively scrubbing the demo — (re)take ownership
                script.seq = stage.applySeq
                if(!script.engaged)
                {
                    script.engaged = true
                    script.from = currentPaint.current
                }
            }

            if(script.engaged && stage.applySeq === script.seq)
            {
                const moss = textureLibrary.entries[2]?.texture ?? script.from
                const dusk = textureLibrary.entries[3]?.texture ?? script.from

                if(wipeB > 0.001)
                {
                    uniforms.uMapPaintA.value = moss
                    uniforms.uMapPaintB.value = dusk
                    uniforms.uSwapWipe.value = wipeB
                }
                else
                {
                    uniforms.uMapPaintA.value = script.from
                    uniforms.uMapPaintB.value = moss
                    uniforms.uSwapWipe.value = wipeA
                }

                // The tray highlight follows the story
                const wantSwatch = wipeB > 0.5
                    ? textureLibrary.entries[3]?.id
                    : wipeA > 0.5
                        ? textureLibrary.entries[2]?.id
                        : null
                if(wantSwatch && stage.activeSwatch !== wantSwatch)
                    useStage.setState({ activeSwatch: wantSwatch })
            }
        }
        else if(script.engaged)
        {
            // Left the wipe windows (scrub-back or forward) — hand back
            script.engaged = false
            if(!gsap.isTweening(uniforms.uSwapWipe))
            {
                uniforms.uSwapWipe.value = 0
                uniforms.uMapPaintA.value = currentPaint.current
                uniforms.uMapPaintB.value = currentPaint.current
            }
            const ownedId = textureLibrary.entries.find((entry) => entry.texture === currentPaint.current)?.id
            if(ownedId && stage.activeSwatch !== ownedId)
                useStage.setState({ activeSwatch: ownedId })
        }

        updateAssetMaterial(material, {
            whiteMix: params.whiteMix,
            opacity: params.heroOpacity,
            reveal: params.reveal,
            uvPack: params.uvProgress,
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
