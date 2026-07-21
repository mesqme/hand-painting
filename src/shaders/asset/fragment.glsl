uniform sampler2D uMapBase;
uniform sampler2D uMapPaintA;
uniform sampler2D uMapPaintB;
uniform float uSwapWipe;
uniform float uReveal;
uniform float uWhiteMix;
uniform float uOpacity;
uniform float uSurfaceWipe;
uniform float uFlatShade;
uniform vec3 uInkColor;
uniform vec2 uBoundsY;
uniform vec3 uLightDirection;

varying vec2 vSampleUv;
varying vec3 vWorldNormal;
varying vec3 vLocalPosition;

void main()
{
    // Height 0-1 along the asset — drives the top-down paint wipes
    float heightRatio = clamp((vLocalPosition.y - uBoundsY.x) / (uBoundsY.y - uBoundsY.x), 0.0, 1.0);

    // Live swap wipe between two painted maps
    float swapEdge = mix(1.12, - 0.12, uSwapWipe);
    float swapMask = smoothstep(swapEdge - 0.07, swapEdge + 0.07, heightRatio);
    vec3 paintColor = mix(texture2D(uMapPaintA, vSampleUv).rgb, texture2D(uMapPaintB, vSampleUv).rgb, swapMask);

    // Baked → painted reveal
    float revealEdge = mix(1.12, - 0.12, uReveal);
    float revealMask = smoothstep(revealEdge - 0.07, revealEdge + 0.07, heightRatio);
    vec3 albedo = mix(texture2D(uMapBase, vSampleUv).rgb, paintColor, revealMask);

    // White clay state
    albedo = mix(albedo, vec3(0.955, 0.945, 0.925), uWhiteMix);

    // Stylised soft lighting
    vec3 normal = normalize(vWorldNormal);
    float sky = normal.y * 0.5 + 0.5;
    float diffuse = clamp(dot(normal, uLightDirection), 0.0, 1.0);
    float light = 0.58 + 0.2 * sky + 0.26 * diffuse;
    vec3 color = albedo * light;

    // Flat-ink variant (wireframe overlay) skips shading entirely
    color = mix(color, uInkColor, uFlatShade);

    // Surface presence — the bake act dissolves the skin and wipes it back
    // top-down with the sweep (uSurfaceWipe 1 = full surface)
    float surfaceEdge = mix(1.12, - 0.12, uSurfaceWipe);
    float surfaceMask = smoothstep(surfaceEdge - 0.06, surfaceEdge + 0.06, heightRatio);

    // Final color
    gl_FragColor = vec4(color, uOpacity * surfaceMask);
    #include <colorspace_fragment>
}
