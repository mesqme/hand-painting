import * as THREE from 'three'

import assetVertexShader from '../../shaders/asset/vertex.glsl'
import assetFragmentShader from '../../shaders/asset/fragment.glsl'
import { COLORS, WORLD } from '../../config.js'

/**
 * One material for every state of the asset: white clay, gradient lookup,
 * baked texture, live paint swaps and the unwrap morph. Components own an
 * instance each and drive it per frame through updateAssetMaterial.
 */
export function createAssetMaterial(options = {})
{
    const material = new THREE.ShaderMaterial({
        vertexShader: assetVertexShader,
        fragmentShader: assetFragmentShader,
        transparent: true,
        wireframe: options.wireframe === true,
        side: options.side ?? THREE.FrontSide,
        uniforms: {
            uMapBase: new THREE.Uniform(options.mapBase ?? null),
            uMapPaintA: new THREE.Uniform(options.mapPaintA ?? options.mapBase ?? null),
            uMapPaintB: new THREE.Uniform(options.mapPaintB ?? options.mapBase ?? null),
            uSwapWipe: new THREE.Uniform(0),
            uReveal: new THREE.Uniform(0),
            uWhiteMix: new THREE.Uniform(options.whiteMix ?? 0),
            uOpacity: new THREE.Uniform(options.opacity ?? 1),
            uUnwrap: new THREE.Uniform(0),
            uUnwrapSize: new THREE.Uniform(options.unwrapSize ?? WORLD.paletteSize),
            uFlatShade: new THREE.Uniform(options.flatShade ? 1 : 0),
            uInkColor: new THREE.Uniform(new THREE.Color(options.inkColor ?? COLORS.wire)),
            uBoundsY: new THREE.Uniform(new THREE.Vector2(- WORLD.assemblyHeight * 0.5, WORLD.assemblyHeight * 0.5)),
            uLightDirection: new THREE.Uniform(new THREE.Vector3(0.5, 0.8, 0.6).normalize()),
        },
    })

    // Solid surfaces sit behind the wireframe overlay without z-fighting
    if(options.wireframe !== true)
    {
        material.polygonOffset = true
        material.polygonOffsetFactor = 1
        material.polygonOffsetUnits = 1
    }

    return material
}

export function updateAssetMaterial(material, options)
{
    const uniforms = material.uniforms

    if(options.whiteMix !== undefined) uniforms.uWhiteMix.value = options.whiteMix
    if(options.opacity !== undefined) uniforms.uOpacity.value = options.opacity
    if(options.reveal !== undefined) uniforms.uReveal.value = options.reveal
    if(options.unwrap !== undefined) uniforms.uUnwrap.value = options.unwrap
    if(options.swapWipe !== undefined) uniforms.uSwapWipe.value = options.swapWipe
}
