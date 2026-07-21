import * as THREE from 'three'
import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'

import DuckColumnAssembly from './DuckColumnAssembly.jsx'
import PalettePlane from './PalettePlane.jsx'
import RingColumns from './RingColumns.jsx'
import BakeRig from './BakeRig.jsx'
import AtlasCombine from './AtlasCombine.jsx'
import BatchedZoo from './BatchedZoo.jsx'
import { pointerParallax, startPointerParallax, updatePointerParallax } from './pointerParallax.js'
import { perfProbe } from './perfProbe.js'

export default function Experience()
{
    const stage = useRef()

    const gl = useThree((state) => state.gl)
    const camera = useThree((state) => state.camera)
    const scene = useThree((state) => state.scene)

    useEffect(() =>
    {
        perfProbe.renderer = gl
        startPointerParallax()

        // Dev-only hook for automated checks
        if(import.meta.env.DEV)
            window.__three = { gl, camera, scene, stage: stage.current }
    }, [gl, camera, scene])

    useFrame((state, delta) =>
    {
        /**
         * Parallax
         */
        updatePointerParallax(delta)
        stage.current.rotation.x = - pointerParallax.currentY * 0.05
        stage.current.rotation.y = pointerParallax.currentX * 0.085

        /**
         * Fit
         */
        const fit = THREE.MathUtils.clamp(state.viewport.aspect / 1.72, 0.6, 1)
        stage.current.scale.setScalar(fit)
    })

    return (
        <>
            <hemisphereLight args={ [ '#ffffff', '#b3afa9', 1.9 ] } />
            <directionalLight position={ [ 3, 5, 2.5 ] } intensity={ 0.5 } />

            <group ref={ stage }>
                <DuckColumnAssembly />
                <PalettePlane />
                <RingColumns />
                <BakeRig />
                <AtlasCombine />
                <BatchedZoo />
            </group>
        </>
    )
}
