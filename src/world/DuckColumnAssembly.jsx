import * as THREE from 'three'
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import gsap from 'gsap'
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'

import usePairs from './usePairs.jsx'
import { createAssetMaterial, updateAssetMaterial } from './materials/assetMaterial.js'
import { ensureLibrary, getTextureById, getPaintedDefault, textureLibrary } from './textureLibrary.js'
import useStage from '../stores/useStage.jsx'
import { params } from '../scroll/choreography.js'
import { COLORS } from '../config.js'

const PAINT_IDS = [ 'base', 'pastel', 'red', 'aberration' ]
const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

/**
 * The hero duck + column. One assembly plays every act: clay model, gradient
 * lookup, seam-cut bake reference, and the hand-painted result with both
 * scripted (act 06) and user-driven live texture swaps.
 */
export default function DuckColumnAssembly()
{
    const group = useRef()
    const duck = useRef()
    const neutralColumn = useRef()
    const neutralDuck = useRef()
    const wireColumn = useRef()
    const wireDuck = useRef()
    const currentPaint = useRef(null)
    const drag = useRef({ active: false, x: 0, y: 0, pointerId: null })
    const dragRotation = useRef({ x: 0, y: 0 })

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
    const { material, neutralMaterial, wireMaterial, seamMaterial, duckSeamLine, columnSeamLine } = useMemo(() =>
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
        const neutralMaterial = new THREE.MeshStandardMaterial({
            color: 0xf1ede6,
            roughness: 0.86,
            metalness: 0,
            flatShading: true,
            transparent: true,
            opacity: 0,
            polygonOffset: true,
            polygonOffsetFactor: 1,
            polygonOffsetUnits: 1,
        })
        const wireMaterial = createAssetMaterial({ wireframe: true, flatShade: true, opacity: 0.28 })

        // Constant-width red lines — the color alone marks the seams (no
        // thickness animation)
        const seamMaterial = new LineMaterial({
            color: COLORS.seam,
            linewidth: 2,
            transparent: true,
            opacity: 0,
            depthWrite: false,
        })
        const duckSeamLine = new LineSegments2(
            new LineSegmentsGeometry().setPositions(duckSeams),
            seamMaterial
        )
        const columnSeamLine = new LineSegments2(
            new LineSegmentsGeometry().setPositions(columnSeams),
            seamMaterial
        )
        duckSeamLine.renderOrder = 8
        columnSeamLine.renderOrder = 8

        return { material, neutralMaterial, wireMaterial, seamMaterial, duckSeamLine, columnSeamLine }
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

    useEffect(() =>
    {
        return () =>
        {
            gsap.killTweensOf(dragRotation.current)
            document.documentElement.style.cursor = ''
        }
    }, [])

    const beginRotate = (event) =>
    {
        if(params.heroOpacity <= 0.002)
            return

        event.stopPropagation()
        event.target.setPointerCapture(event.pointerId)
        drag.current = {
            active: true,
            x: event.clientX,
            y: event.clientY,
            pointerId: event.pointerId,
        }
        gsap.killTweensOf(dragRotation.current)
        document.documentElement.style.cursor = 'grabbing'
    }

    const rotate = (event) =>
    {
        if(!drag.current.active)
            return

        const dx = event.clientX - drag.current.x
        const dy = event.clientY - drag.current.y
        dragRotation.current.y = dx / Math.max(window.innerWidth, 1) * Math.PI * 2.4
        dragRotation.current.x = dy / Math.max(window.innerHeight, 1) * Math.PI * 1.35
    }

    const endRotate = (event) =>
    {
        if(!drag.current.active)
            return

        event.stopPropagation()
        event.target.releasePointerCapture?.(drag.current.pointerId)
        drag.current.active = false
        document.documentElement.style.cursor = ''
        gsap.to(dragRotation.current, {
            x: 0,
            y: 0,
            duration: 0.9,
            ease: 'elastic.out(1, 0.34)',
        })
    }

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
        group.current.rotation.x = params.heroRotX + dragRotation.current.x
        group.current.rotation.y = params.heroRotY
            + params.heroSpinY
            + dragRotation.current.y
            + Math.sin(elapsed * 0.35) * 0.12 * (1 - params.heroStanding)

        // Duck floats above its column
        duck.current.position.y = Math.sin(elapsed * 1.3) * 0.06
        duck.current.rotation.z = Math.sin(elapsed * 0.8 + 1) * 0.02

        const uniforms = material.uniforms
        const sequence = clamp(params.paintTexture, 0, PAINT_IDS.length - 1)
        const scripted = params.dropdownOpen > 0.001

        if(scripted)
        {
            const fromIndex = Math.floor(sequence)
            const toIndex = Math.min(fromIndex + 1, PAINT_IDS.length - 1)
            const fromTexture = getTextureById(PAINT_IDS[fromIndex])
            const toTexture = getTextureById(PAINT_IDS[toIndex])
            const wipe = sequence - fromIndex

            if(fromTexture && toTexture)
            {
                uniforms.uMapPaintA.value = fromTexture
                uniforms.uMapPaintB.value = toTexture
                uniforms.uSwapWipe.value = wipe

                const selectedIndex = Math.round(sequence)
                const selectedId = PAINT_IDS[selectedIndex]
                currentPaint.current = getTextureById(selectedId)
                const stage = useStage.getState()
                if(stage.activeSwatch !== selectedId)
                    useStage.setState({ activeSwatch: selectedId })
            }
            lastPaintTexture.current = sequence
        }
        else if(sequence !== lastPaintTexture.current)
        {
            const selectedIndex = Math.round(sequence)
            const selectedId = PAINT_IDS[selectedIndex]
            const texture = getTextureById(selectedId)
            if(texture)
            {
                currentPaint.current = texture
                uniforms.uMapPaintA.value = texture
                uniforms.uMapPaintB.value = texture
                uniforms.uSwapWipe.value = 0
                useStage.setState({ activeSwatch: selectedId })
            }
            lastPaintTexture.current = sequence
        }

        // After the bake sweep, mapBase is the real baked texture and UVs
        // snap back to the uv1 unwrap (gradient acts sample uv0 strips)
        const baked = params.bakeSweep > 0.001
        uniforms.uMapBase.value = baked ? textureLibrary.baked : textureLibrary.gradient

        updateAssetMaterial(material, {
            whiteMix: params.whiteMix,
            clayWipe: params.clayWipe,
            opacity: params.heroOpacity,
            reveal: params.reveal,
            uvPack: baked ? 0 : params.uvProgress,
            surfaceWipe: params.heroSurface,
        })

        const neutralOpacity = params.neutralOpacity * params.heroOpacity
        neutralMaterial.opacity = neutralOpacity
        neutralMaterial.depthWrite = neutralOpacity > 0.98
        neutralColumn.current.visible = neutralOpacity > 0.002
        neutralDuck.current.visible = neutralOpacity > 0.002

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
        <group
            ref={ group }
            onPointerDown={ beginRotate }
            onPointerMove={ rotate }
            onPointerUp={ endRotate }
            onPointerCancel={ endRotate }
            onPointerOver={ () =>
            {
                if(params.heroOpacity > 0.002)
                    document.documentElement.style.cursor = 'grab'
            } }
            onPointerOut={ () =>
            {
                if(!drag.current.active)
                    document.documentElement.style.cursor = ''
            } }
        >
            <mesh geometry={ columnGeometry } material={ material } renderOrder={ 0 } />
            <mesh ref={ neutralColumn } geometry={ columnGeometry } material={ neutralMaterial } renderOrder={ 2 } />
            <mesh ref={ wireColumn } geometry={ columnGeometry } material={ wireMaterial } />

            <group ref={ duck }>
                <mesh geometry={ duckGeometry } material={ material } renderOrder={ 0 } />
                <mesh ref={ neutralDuck } geometry={ duckGeometry } material={ neutralMaterial } renderOrder={ 2 } />
                <mesh ref={ wireDuck } geometry={ duckGeometry } material={ wireMaterial } />
                <primitive object={ duckSeamLine } scale={ 1.008 } />
            </group>

            <primitive object={ columnSeamLine } scale={ 1.008 } />
        </group>
    )
}
