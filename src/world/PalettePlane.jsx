import * as THREE from 'three'
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'

import usePairs from './usePairs.jsx'
import { buildUvLineData } from './uvIslands.js'
import { ensureLibrary, getPaintedDefault, textureLibrary } from './textureLibrary.js'
import { params } from '../scroll/choreography.js'
import { COLORS, WORLD } from '../config.js'

/**
 * The texture sheet docked on the right. Acts 02/04: gradient palette with the
 * animated island outlines and the bake sweep. Act 05: the baked sheet wipes
 * to the hand-painted base in sync with the model.
 */
export default function PalettePlane()
{
    const group = useRef()
    const lines = useRef()
    const layoutLines = useRef()
    const sweep = useRef()
    const paintOverlay = useRef()

    const { islandModel } = usePairs()
    const maps = useTexture({
        gradient: './textures/gradientPalette.png',
        baked: './textures/duck_baked.png',
        base: './textures/duck_base.png',
        pastel: './textures/duck_pastel.png',
        red: './textures/duck_red.png',
        aberration: './textures/duck_base_abberation.png',
        barrel: './textures/barrel.png',
        meat: './textures/meat.png',
    })

    const size = WORLD.paletteSize

    const { sheetMaterial, backingMaterial, linesMaterial, layoutLinesMaterial, sweepMaterial, paintMaterial, lineData } = useMemo(() =>
    {
        ensureLibrary(maps)

        const sheetMaterial = new THREE.MeshBasicMaterial({ map: maps.gradient, transparent: true })
        const backingMaterial = new THREE.MeshBasicMaterial({ color: COLORS.card, transparent: true })
        const linesMaterial = new THREE.LineBasicMaterial({ color: COLORS.card, transparent: true })
        const layoutLinesMaterial = new THREE.LineBasicMaterial({ color: COLORS.ink, transparent: true, opacity: 0 })
        const sweepMaterial = new THREE.MeshBasicMaterial({ color: COLORS.accent, transparent: true, opacity: 0 })

        // Painted overlay — top-down wipe of duck_base over the baked sheet (act 05)
        const paintMaterial = new THREE.ShaderMaterial({
            transparent: true,
            uniforms: {
                uMap: new THREE.Uniform(getPaintedDefault()),
                uWipe: new THREE.Uniform(0),
                uOpacity: new THREE.Uniform(1),
            },
            vertexShader: /* glsl */ `
                varying vec2 vUv;

                void main()
                {
                    gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
                    vUv = uv;
                }
            `,
            fragmentShader: /* glsl */ `
                uniform sampler2D uMap;
                uniform float uWipe;
                uniform float uOpacity;

                varying vec2 vUv;

                float hash21(vec2 point)
                {
                    point = fract(point * vec2(123.34, 456.21));
                    point += dot(point, point + 45.32);
                    return fract(point.x * point.y);
                }

                float valueNoise(vec2 point)
                {
                    vec2 cell = floor(point);
                    vec2 local = fract(point);
                    local = local * local * (3.0 - 2.0 * local);

                    float a = hash21(cell);
                    float b = hash21(cell + vec2(1.0, 0.0));
                    float c = hash21(cell + vec2(0.0, 1.0));
                    float d = hash21(cell + vec2(1.0, 1.0));

                    return mix(mix(a, b, local.x), mix(c, d, local.x), local.y);
                }

                void main()
                {
                    float noise = valueNoise(vUv * 3.6)
                        + valueNoise(vUv * 7.4 + 12.7) * 0.35;
                    noise /= 1.35;
                    float paintedY = vUv.y + (noise - 0.5) * 0.34;
                    float edge = mix(1.1, - 0.1, uWipe);
                    float mask = smoothstep(edge - 0.018, edge + 0.018, paintedY);
                    if(uWipe <= 0.001) mask = 0.0;
                    if(uWipe >= 0.999) mask = 1.0;

                    // Final color
                    gl_FragColor = vec4(texture2D(uMap, vUv).rgb, mask * uOpacity);
                    #include <colorspace_fragment>
                }
            `,
        })

        const lineData = buildUvLineData(islandModel, size)

        return { sheetMaterial, backingMaterial, linesMaterial, layoutLinesMaterial, sweepMaterial, paintMaterial, lineData }
    }, [maps, islandModel, size])

    useFrame((state) =>
    {
        // Keep the sheet on-screen when the viewport is narrow: clamp its right
        // edge inside the visible half-width (stage-local units). Identity on
        // landscape, where sheetX already sits well clear of the model.
        const fit = THREE.MathUtils.clamp(state.viewport.aspect / 1.72, 0.6, 1)
        const halfVisible = (state.viewport.width / 2) / fit
        const maxX = halfVisible - size * 1.07 / 2 - 0.06
        const minX = - maxX
        group.current.position.x = Math.min(Math.max(params.paletteX, minX), maxX)
        group.current.position.y = params.paletteY
        group.current.scale.setScalar(params.paletteScale)
        group.current.visible = params.paletteOpacity > 0.002

        // Gradient during the palette act; after the bake sweep the sheet
        // carries the real baked texture (paint overlay wipes base on top)
        const showBaked = params.bakeSweep > 0.001 || params.sheetPaint > 0.001
        const sheetMap = showBaked ? textureLibrary.baked : textureLibrary.gradient
        if(sheetMaterial.map !== sheetMap)
        {
            sheetMaterial.map = sheetMap
            sheetMaterial.needsUpdate = true
        }

        sheetMaterial.opacity = params.paletteOpacity * (1 - params.bakeSheetClear)
        sheetMaterial.color.setScalar(1 - params.uvLines * 0.42)
        backingMaterial.opacity = params.paletteOpacity * 0.9

        // UV islands packing
        const linesOpacity = params.uvLines * params.paletteOpacity
        linesMaterial.opacity = linesOpacity
        lines.current.visible = linesOpacity > 0.002
        lineData.update(params.uvProgress)

        // Bake act: the unwrapped layout as wireframe on the cleared sheet
        const wireOpacity = params.sheetWire * params.paletteOpacity
        layoutLinesMaterial.opacity = wireOpacity
        layoutLines.current.visible = wireOpacity > 0.002

        // Bake sweep
        const sweepProgress = params.bakeSweep
        sweepMaterial.opacity = Math.sin(Math.min(Math.max(sweepProgress, 0), 1) * Math.PI) * 0.9
        sweep.current.position.y = (0.55 - sweepProgress * 1.1) * size
        sweep.current.visible = sweepMaterial.opacity > 0.002

        // Painted wipe (act 05) — baked → duck_base
        paintMaterial.uniforms.uMap.value = textureLibrary.base
        paintMaterial.uniforms.uWipe.value = params.sheetPaint
        paintMaterial.uniforms.uOpacity.value = params.paletteOpacity
        paintOverlay.current.visible = params.sheetPaint > 0.002 && params.paletteOpacity > 0.002
    })

    return (
        <group ref={ group }>
            <mesh material={ backingMaterial } position-z={ - 0.012 }>
                <planeGeometry args={ [ size * 1.07, size * 1.07 ] } />
            </mesh>

            <mesh material={ sheetMaterial }>
                <planeGeometry args={ [ size, size ] } />
            </mesh>

            <mesh ref={ paintOverlay } material={ paintMaterial } position-z={ 0.008 }>
                <planeGeometry args={ [ size, size ] } />
            </mesh>

            <lineSegments ref={ lines } geometry={ lineData.geometry } material={ linesMaterial } position-z={ 0.014 } />

            <lineSegments ref={ layoutLines } geometry={ lineData.layoutGeometry } material={ layoutLinesMaterial } position-z={ 0.012 } />

            <mesh ref={ sweep } material={ sweepMaterial } position-z={ 0.05 }>
                <planeGeometry args={ [ size * 1.07, 0.045 ] } />
            </mesh>
        </group>
    )
}
