uniform float uUnwrap;
uniform float uUnwrapSize;

attribute vec2 aUnwrapUv;

varying vec2 vUv;
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

    // Varyings
    vUv = uv;
    vWorldNormal = normalize(mat3(modelMatrix) * morphedNormal);
    vLocalPosition = position;
}
