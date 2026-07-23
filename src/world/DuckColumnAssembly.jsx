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
import { clampFrameX } from '../ui/frameFit.js'
import { COLORS, HERO_SLOT, ISO } from '../config.js'
import { finalDuckOffset, finalSlotTransform } from './finalLayout.js'
import { duckQuackAnchor } from './duckQuackAnchor.js'

const PAINT_IDS = [ 'base', 'pastel', 'red', 'aberration' ]
const FINAL_ORDER = [ HERO_SLOT, 0, 2, 3 ]
const clamp = (value, min, max) => Math.min(Math.max(value, min), max)
const lerp = (a, b, t) => a + (b - a) * t
const smooth = (value) =>
{
    const t = clamp(value, 0, 1)
    return t * t * (3 - 2 * t)
}
const lerpAngle = (from, to, t) =>
{
    const delta = Math.atan2(Math.sin(to - from), Math.cos(to - from))
    return from + delta * t
}
// Align the authored duck with its travel direction in the finale.
const directionBetween = (from, to) =>
    Math.atan2(to.x - from.x, to.z - from.z)

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
    const drag = useRef({ active: false, x: 0, y: 0, pointerId: null })
    const dragRotation = useRef({ x: 0, y: 0 })
    const finalStart = useRef(null)
    const lastLanding = useRef(- 1)
    const projectedDuck = useRef(new THREE.Vector3())

    const { duckGeometry, columnGeometry, duckSeams, columnSeams } = usePairs()
    const maps = useTexture({
        gradient: './textures/gradientPalette.png',
        baked: './textures/duck_baked.png',
        base: './textures/duck_base.png',
        pastel: './textures/duck_pastel.png',
        red: './textures/duck_red.png',
        aberration: './textures/duck_base_abberation.png',
    })
    const duckCenter = useMemo(() =>
    {
        duckGeometry.computeBoundingBox()
        return duckGeometry.boundingBox.getCenter(new THREE.Vector3())
    }, [duckGeometry])

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
        const final = smooth(params.finalVisible)
        const frameX = clampFrameX(params.frameX)
        const finalTransform = finalSlotTransform(HERO_SLOT, frameX, final)
        const idle = Math.sin(elapsed * 0.6) * 0.03 * (1 - params.heroStanding) * (1 - final)

        group.current.position.x = lerp(params.heroX, finalTransform.x, final)
        group.current.position.y = lerp(params.heroY + idle, finalTransform.y, final)
        group.current.position.z = lerp(params.heroZ, finalTransform.z, final)
        group.current.scale.setScalar(lerp(params.heroScale, finalTransform.scale, final))
        group.current.visible = params.heroOpacity > 0.002

        group.current.rotation.x = lerp(params.heroRotX, ISO.pitch, final)
            + dragRotation.current.x * (1 - final)
        group.current.rotation.y = lerp(
            params.heroRotY
                + params.heroSpinY
                + Math.sin(elapsed * 0.35) * 0.12 * (1 - params.heroStanding),
            ISO.yaw,
            final
        ) + dragRotation.current.y * (1 - final)

        let duckX = 0
        let duckY = Math.sin(elapsed * 1.3) * 0.06 * (1 - final)
        let duckZ = 0
        let duckYaw = 0
        let duckRoll = Math.sin(elapsed * 0.8 + 1) * 0.02 * (1 - final)
        let duckScaleX = 1
        let duckScaleY = 1
        let duckScaleZ = 1

        if(final > 0.98)
        {
            if(finalStart.current === null)
            {
                finalStart.current = elapsed
                lastLanding.current = - 1
            }

            const legDuration = 2.65
            const legClock = (elapsed - finalStart.current) / legDuration
            const serial = Math.floor(legClock)
            const phase = legClock - serial
            const pathIndex = serial % FINAL_ORDER.length
            const fromSlot = FINAL_ORDER[pathIndex]
            const toSlot = FINAL_ORDER[(pathIndex + 1) % FINAL_ORDER.length]
            const previousSlot = FINAL_ORDER[(pathIndex + FINAL_ORDER.length - 1) % FINAL_ORDER.length]
            const from = finalDuckOffset(fromSlot, 1)
            const to = finalDuckOffset(toSlot, 1)
            const previous = finalDuckOffset(previousSlot, 1)
            const targetYaw = directionBetween(from, to)
            const previousYaw = directionBetween(previous, from)

            if(phase < 0.28)
            {
                const turn = phase / 0.28
                const turnEase = smooth(turn)
                const turnHop = Math.sin(Math.PI * turn) * 0.24 / finalTransform.scale
                const crouch = smooth(clamp((turn - 0.72) / 0.28, 0, 1))

                duckX = from.x
                duckY = turnHop
                duckZ = from.z
                duckYaw = lerpAngle(previousYaw, targetYaw, turnEase)
                duckScaleX = 1 + crouch * 0.11
                duckScaleY = 1 - crouch * 0.18
                duckScaleZ = 1 + crouch * 0.11
            }
            else if(phase < 0.8)
            {
                const travel = (phase - 0.28) / 0.52
                const gravityArc = 4 * travel * (1 - travel) * 1.08 / finalTransform.scale
                const launchStretch = Math.exp(- travel * 8)

                duckX = lerp(from.x, to.x, travel)
                duckY = gravityArc
                duckZ = lerp(from.z, to.z, travel)
                duckYaw = targetYaw
                duckScaleX = 1 - launchStretch * 0.08
                duckScaleY = 1 + launchStretch * 0.17 + Math.sin(Math.PI * travel) * 0.04
                duckScaleZ = 1 - launchStretch * 0.08
            }
            else
            {
                const landing = (phase - 0.8) / 0.2
                const rebound = Math.exp(- landing * 5) * Math.cos(landing * Math.PI * 2)

                duckX = to.x
                duckY = Math.sin(Math.PI * landing) * Math.exp(- landing * 4) * 0.08
                    / finalTransform.scale
                duckZ = to.z
                duckYaw = targetYaw
                duckScaleX = 1 + rebound * 0.13
                duckScaleY = 1 - rebound * 0.22
                duckScaleZ = 1 + rebound * 0.13

                if(serial !== lastLanding.current)
                {
                    lastLanding.current = serial
                    if(serial % 2 === 1)
                        useStage.getState().requestQuack()
                }
            }
        }
        else
        {
            finalStart.current = null
            lastLanding.current = - 1
        }

        duck.current.position.set(duckX, duckY, duckZ)
        duck.current.rotation.set(0, duckYaw, duckRoll)
        duck.current.scale.set(duckScaleX, duckScaleY, duckScaleZ)

        // DOM speech follows the real projected duck position in every act.
        duck.current.updateWorldMatrix(true, false)
        projectedDuck.current.copy(duckCenter)
        duck.current.localToWorld(projectedDuck.current)
        projectedDuck.current.project(state.camera)
        duckQuackAnchor.x = (projectedDuck.current.x * 0.5 + 0.5) * state.size.width
        duckQuackAnchor.y = (- projectedDuck.current.y * 0.5 + 0.5) * state.size.height
        duckQuackAnchor.visible = params.heroOpacity > 0.002

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

        const batchColor = smooth(params.batchColor)
        const batchActive = params.batchNeutral > 0.001

        updateAssetMaterial(material, {
            whiteMix: batchActive ? params.batchNeutral : params.whiteMix,
            clayWipe: batchActive ? batchColor : params.clayWipe,
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
            <mesh ref={ wireColumn } geometry={ columnGeometry } material={ wireMaterial } renderOrder={ 4 } />

            <group
                ref={ duck }
                onClick={ (event) =>
                {
                    event.stopPropagation()
                    if((event.delta ?? 0) < 6)
                        useStage.getState().requestQuack()
                } }
            >
                <mesh geometry={ duckGeometry } material={ material } renderOrder={ 0 } />
                <mesh ref={ wireDuck } geometry={ duckGeometry } material={ wireMaterial } renderOrder={ 4 } />
                <primitive object={ duckSeamLine } scale={ 1.008 } />
            </group>

            <primitive object={ columnSeamLine } scale={ 1.008 } />
        </group>
    )
}
