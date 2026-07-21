uniform float uUnwrap;
uniform float uUnwrapSize;
uniform float uUvPack;

attribute vec2 aUnwrapUv;
attribute float aPackOrder;

varying vec2 vSampleUv;
varying vec3 vWorldNormal;
varying vec3 vLocalPosition;

void main()
{
    // Unwrap morph — every vertex travels to its spot on the 0-1 bake layout
    // (aUnwrapUv, a real spread-out unwrap; `uv` stays the palette lookup)
    vec3 flatPosition = vec3((aUnwrapUv - 0.5) * uUnwrapSize, 0.0);
    vec3 morphedPosition = mix(position, flatPosition, uUnwrap);

    vec3 flatNormal = vec3(0.0, 0.0, 1.0);
    vec3 morphedNormal = normalize(mix(normal, flatNormal, uUnwrap));

    vec4 modelPosition = modelMatrix * vec4(morphedPosition, 1.0);
    vec4 viewPosition = viewMatrix * modelPosition;
    vec4 projectedPosition = projectionMatrix * viewPosition;

    // Final position
    gl_Position = projectedPosition;

    // Live palette packing — sample where this island currently SITS on the
    // sheet, staggered per island exactly like the uvIslands line animation,
    // so the model's colors resolve island-by-island as the layout packs
    float packWindow = 0.4;
    float packOffset = aPackOrder * (1.0 - packWindow);
    float packProgress = clamp((uUvPack - packOffset) / packWindow, 0.0, 1.0);
    packProgress = packProgress * packProgress * (3.0 - 2.0 * packProgress);

    // Varyings
    vSampleUv = mix(aUnwrapUv, uv, packProgress);
    vWorldNormal = normalize(mat3(modelMatrix) * morphedNormal);
    vLocalPosition = position;
}
