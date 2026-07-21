import * as THREE from 'three'
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'

import useDuckColumn from './useDuckColumn.jsx'
import { buildUvLineData } from './uvIslands.js'
import { prepareMapTexture } from './textureLibrary.js'
import { params } from '../scroll/choreography.js'
import { COLORS, WORLD } from '../config.js'

/**
 * The palette card: gradient sheet, animated UV island outlines (step 02) and
 * the bake sweep bar (step 04). Doubles as the bake target the copy unwraps
 * onto — sharing flipY-false space with the model keeps the overlay exact.
 */
export default function PalettePlane()
{
    const group = useRef()
    const lines = useRef()
    const sweep = useRef()

    const { duckGeometry, columnGeometry } = useDuckColumn()
    const gradientTexture = useTexture('./textures/gradientPalette.png')

    const size = WORLD.paletteSize

    const { sheetMaterial, backingMaterial, linesMaterial, sweepMaterial, lineData } = useMemo(() =>
    {
        prepareMapTexture(gradientTexture)

        const sheetMaterial = new THREE.MeshBasicMaterial({ map: gradientTexture, transparent: true })
        const backingMaterial = new THREE.MeshBasicMaterial({ color: COLORS.card, transparent: true })
        const linesMaterial = new THREE.LineBasicMaterial({ color: COLORS.card, transparent: true })
        const sweepMaterial = new THREE.MeshBasicMaterial({ color: COLORS.accent, transparent: true, opacity: 0 })

        const lineData = buildUvLineData([duckGeometry, columnGeometry], size)

        return { sheetMaterial, backingMaterial, linesMaterial, sweepMaterial, lineData }
    }, [gradientTexture, duckGeometry, columnGeometry])

    useFrame((state) =>
    {
        const elapsed = state.clock.elapsedTime

        // Idle bob freezes while the bake copy must register exactly with the sheet
        const bobAmount = 0.02 * (1 - Math.min(params.bakeCopyOpacity * 3, 1))
        group.current.position.x = params.paletteX
        group.current.position.y = WORLD.paletteY + Math.sin(elapsed * 0.7 + 2) * bobAmount
        group.current.visible = params.paletteOpacity > 0.002

        // The gradient clears off the sheet when it becomes the bake target
        sheetMaterial.opacity = params.paletteOpacity * (1 - params.bakeSheetClear)
        backingMaterial.opacity = params.paletteOpacity * 0.9

        // UV islands packing — dim the sheet while outlines are on it
        sheetMaterial.color.setScalar(1 - params.uvLines * 0.42)
        const linesOpacity = params.uvLines * params.paletteOpacity
        linesMaterial.opacity = linesOpacity
        lines.current.visible = linesOpacity > 0.002
        lineData.update(params.uvProgress)

        // Bake sweep
        const sweepProgress = params.bakeSweep
        sweepMaterial.opacity = Math.sin(Math.min(Math.max(sweepProgress, 0), 1) * Math.PI) * 0.9
        sweep.current.position.y = (0.55 - sweepProgress * 1.1) * size
        sweep.current.visible = sweepMaterial.opacity > 0.002
    })

    return (
        <group ref={ group }>
            <mesh material={ backingMaterial } position-z={ - 0.012 }>
                <planeGeometry args={ [ size * 1.07, size * 1.07 ] } />
            </mesh>

            <mesh material={ sheetMaterial }>
                <planeGeometry args={ [ size, size ] } />
            </mesh>

            <lineSegments ref={ lines } geometry={ lineData.geometry } material={ linesMaterial } position-z={ 0.014 } />

            <mesh ref={ sweep } material={ sweepMaterial } position-z={ 0.05 }>
                <planeGeometry args={ [ size * 1.07, 0.045 ] } />
            </mesh>
        </group>
    )
}
