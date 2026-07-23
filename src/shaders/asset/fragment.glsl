uniform sampler2D uMapBase;
uniform sampler2D uMapPaintA;
uniform sampler2D uMapPaintB;
uniform float uSwapWipe;
uniform float uReveal;
uniform float uWhiteMix;
uniform float uClayWipe;
uniform float uOpacity;
uniform float uSurfaceWipe;
uniform float uFlatShade;
uniform vec3 uInkColor;
uniform vec2 uBoundsY;
uniform vec3 uLightDirection;

varying vec2 vSampleUv;
varying vec3 vWorldNormal;
varying vec3 vLocalPosition;

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

float wipeMask(float progress, float coordinate)
{
    if(progress <= 0.001) return 0.0;
    if(progress >= 0.999) return 1.0;
    float edge = mix(1.12, - 0.12, progress);
    return smoothstep(edge - 0.018, edge + 0.018, coordinate);
}

void main()
{
    // Height 0-1 along the asset — drives the top-down paint wipes
    float heightRatio = clamp((vLocalPosition.y - uBoundsY.x) / (uBoundsY.y - uBoundsY.x), 0.0, 1.0);

    // A broad, low-frequency noise field gives the transition a sharp
    // brush-loaded edge instead of a clean digital fade.
    float paintNoise = valueNoise(vSampleUv * 3.6)
        + valueNoise(vSampleUv * 7.4 + 12.7) * 0.35;
    paintNoise /= 1.35;
    float paintedHeight = heightRatio + (paintNoise - 0.5) * 0.34;

    // Live swap wipe between two painted maps
    float swapMask = wipeMask(uSwapWipe, paintedHeight);
    vec3 paintColor = mix(texture2D(uMapPaintA, vSampleUv).rgb, texture2D(uMapPaintB, vSampleUv).rgb, swapMask);

    // Baked → painted reveal
    float revealMask = wipeMask(uReveal, paintedHeight);
    vec3 albedo = mix(texture2D(uMapBase, vSampleUv).rgb, paintColor, revealMask);

    // White clay state. During baking, uClayWipe reveals the baked map below
    // with the same sharp painterly edge while the solid surface stays opaque.
    float clayReveal = wipeMask(uClayWipe, paintedHeight);
    float clayAmount = uWhiteMix * (1.0 - clayReveal);
    albedo = mix(albedo, vec3(0.955, 0.945, 0.925), clayAmount);

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
    float surfaceMask = wipeMask(uSurfaceWipe, paintedHeight);

    // Final color
    gl_FragColor = vec4(color, uOpacity * surfaceMask);
    #include <colorspace_fragment>
}
