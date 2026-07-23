import * as THREE from 'three'

import { COLORS, WORLD } from '../../config.js'

/**
 * Textured assets use a real MeshBasicMaterial as their foundation. The small
 * onBeforeCompile patch only adds the authored UV selection and presentation
 * wipes; it does not add lighting, so gradient and painted colors remain
 * unlit and match the source images.
 *
 * Neutral clay is a separate MeshStandardMaterial owned by the scene
 * components. Wire overlays use an ordinary wireframe MeshBasicMaterial.
 */
export function createAssetMaterial(options = {})
{
    if(options.wireframe === true)
    {
        const wire = new THREE.MeshBasicMaterial({
            color: options.inkColor ?? COLORS.wire,
            transparent: true,
            opacity: options.opacity ?? 0,
            wireframe: true,
            side: options.side ?? THREE.FrontSide,
            depthWrite: false,
        })
        wire.userData.assetWire = true
        return wire
    }

    const uniforms = {
        uMapBase: new THREE.Uniform(options.mapBase ?? null),
        uMapPaintA: new THREE.Uniform(options.mapPaintA ?? options.mapBase ?? null),
        uMapPaintB: new THREE.Uniform(options.mapPaintB ?? options.mapBase ?? null),
        uSwapWipe: new THREE.Uniform(0),
        uReveal: new THREE.Uniform(0),
        uWhiteMix: new THREE.Uniform(options.whiteMix ?? 0),
        uClayWipe: new THREE.Uniform(0),
        uOpacity: new THREE.Uniform(options.opacity ?? 1),
        uSurfaceWipe: new THREE.Uniform(1),
        uUnwrap: new THREE.Uniform(0),
        uUnwrapSize: new THREE.Uniform(options.unwrapSize ?? WORLD.paletteSize),
        uUvPack: new THREE.Uniform(options.uvPack ?? 1),
        uBoundsY: new THREE.Uniform(new THREE.Vector2(- WORLD.assemblyHeight * 0.5, WORLD.assemblyHeight * 0.5)),
    }

    const material = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        map: options.mapBase,
        transparent: true,
        opacity: 1,
        side: options.side ?? THREE.FrontSide,
    })
    material.toneMapped = false

    // Existing scene code updates these uniforms directly between renders.
    material.uniforms = uniforms
    material.polygonOffset = true
    material.polygonOffsetFactor = 1
    material.polygonOffsetUnits = 1

    material.onBeforeCompile = (shader) =>
    {
        Object.assign(shader.uniforms, uniforms)

        shader.vertexShader = shader.vertexShader
            .replace(
                '#include <uv_pars_vertex>',
                `#include <uv_pars_vertex>
                uniform float uUnwrap;
                uniform float uUnwrapSize;
                uniform float uUvPack;
                attribute vec2 aUnwrapUv;
                attribute float aPackOrder;
                varying vec2 vAssetUv;
                varying vec3 vAssetLocalPosition;`
            )
            .replace(
                '#include <uv_vertex>',
                `#include <uv_vertex>
                float assetPackWindow = 0.4;
                float assetPackOffset = aPackOrder * (1.0 - assetPackWindow);
                float assetPackProgress = clamp((uUvPack - assetPackOffset) / assetPackWindow, 0.0, 1.0);
                assetPackProgress = assetPackProgress * assetPackProgress * (3.0 - 2.0 * assetPackProgress);
                vAssetUv = mix(aUnwrapUv, uv, assetPackProgress);
                vAssetLocalPosition = position;`
            )
            .replace(
                '#include <begin_vertex>',
                `vec3 assetFlatPosition = vec3((aUnwrapUv - 0.5) * uUnwrapSize, 0.0);
                vec3 transformed = mix(position, assetFlatPosition, uUnwrap);`
            )

        shader.fragmentShader = shader.fragmentShader
            .replace(
                '#include <map_pars_fragment>',
                `#include <map_pars_fragment>
                uniform sampler2D uMapBase;
                uniform sampler2D uMapPaintA;
                uniform sampler2D uMapPaintB;
                uniform float uSwapWipe;
                uniform float uReveal;
                uniform float uWhiteMix;
                uniform float uClayWipe;
                uniform float uOpacity;
                uniform float uSurfaceWipe;
                uniform vec2 uBoundsY;
                varying vec2 vAssetUv;
                varying vec3 vAssetLocalPosition;

                float assetHash21(vec2 point)
                {
                    point = fract(point * vec2(123.34, 456.21));
                    point += dot(point, point + 45.32);
                    return fract(point.x * point.y);
                }

                float assetValueNoise(vec2 point)
                {
                    vec2 cell = floor(point);
                    vec2 local = fract(point);
                    local = local * local * (3.0 - 2.0 * local);
                    float a = assetHash21(cell);
                    float b = assetHash21(cell + vec2(1.0, 0.0));
                    float c = assetHash21(cell + vec2(0.0, 1.0));
                    float d = assetHash21(cell + vec2(1.0, 1.0));
                    return mix(mix(a, b, local.x), mix(c, d, local.x), local.y);
                }

                float assetWipe(float progress, float coordinate)
                {
                    // Exact endpoints are essential. Without these guards the
                    // noise can leave tiny fragments missing even at 100%.
                    if(progress <= 0.001) return 0.0;
                    if(progress >= 0.999) return 1.0;
                    float edge = mix(1.12, -0.12, progress);
                    return smoothstep(edge - 0.018, edge + 0.018, coordinate);
                }`
            )
            .replace(
                '#include <map_fragment>',
                `float assetHeight = clamp(
                    (vAssetLocalPosition.y - uBoundsY.x) / (uBoundsY.y - uBoundsY.x),
                    0.0,
                    1.0
                );
                float assetNoise = assetValueNoise(vAssetUv * 3.6)
                    + assetValueNoise(vAssetUv * 7.4 + 12.7) * 0.35;
                assetNoise /= 1.35;
                float assetPaintCoordinate = assetHeight + (assetNoise - 0.5) * 0.34;

                float assetSwapMask = assetWipe(uSwapWipe, assetPaintCoordinate);
                vec3 assetPaint = mix(
                    texture2D(uMapPaintA, vAssetUv).rgb,
                    texture2D(uMapPaintB, vAssetUv).rgb,
                    assetSwapMask
                );

                float assetRevealMask = assetWipe(uReveal, assetPaintCoordinate);
                vec3 assetAlbedo = mix(
                    texture2D(uMapBase, vAssetUv).rgb,
                    assetPaint,
                    assetRevealMask
                );

                float assetClayReveal = assetWipe(uClayWipe, assetPaintCoordinate);
                float assetClayAmount = uWhiteMix * (1.0 - assetClayReveal);
                assetAlbedo = mix(assetAlbedo, vec3(0.955, 0.945, 0.925), assetClayAmount);

                float assetSurfaceMask = assetWipe(uSurfaceWipe, assetPaintCoordinate);
                float assetFinalAlpha = uOpacity * assetSurfaceMask;
                if(assetFinalAlpha <= 0.001) discard;
                diffuseColor = vec4(assetAlbedo, assetFinalAlpha);`
            )
    }

    material.customProgramCacheKey = () => 'asset-basic-material-v3'
    return material
}

export function updateAssetMaterial(material, options)
{
    if(material.userData.assetWire)
    {
        if(options.opacity !== undefined)
            material.opacity = options.opacity
        return
    }

    const uniforms = material.uniforms
    if(options.whiteMix !== undefined) uniforms.uWhiteMix.value = options.whiteMix
    if(options.clayWipe !== undefined) uniforms.uClayWipe.value = options.clayWipe
    if(options.opacity !== undefined) uniforms.uOpacity.value = options.opacity
    if(options.reveal !== undefined) uniforms.uReveal.value = options.reveal
    if(options.unwrap !== undefined) uniforms.uUnwrap.value = options.unwrap
    if(options.swapWipe !== undefined) uniforms.uSwapWipe.value = options.swapWipe
    if(options.uvPack !== undefined) uniforms.uUvPack.value = options.uvPack
    if(options.surfaceWipe !== undefined) uniforms.uSurfaceWipe.value = options.surfaceWipe
}
