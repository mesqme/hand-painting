import * as THREE from 'three'

/**
 * UV islands — act 02
 *
 * Renders the island-model outlines in palette-sheet space: every island
 * starts "at full scale" (its packed layout pose) and shrinks onto the tiny
 * gradient strip its real UVs occupy, staggered island-by-island with the
 * same order and window the shader uses for the live model coloring.
 */
const WINDOW_SIZE = 0.4

export function buildUvLineData(islandModel, size)
{
    const segments = islandModel.outlineSegments

    const pointCount = segments.length * 2
    const startArray = new Float32Array(pointCount * 3)
    const endArray = new Float32Array(pointCount * 3)
    const orderOfPoint = new Float32Array(pointCount)

    segments.forEach((segment, segmentIndex) =>
    {
        for(let p = 0; p < 2; p++)
        {
            const i = segmentIndex * 2 + p
            const i3 = i * 3
            startArray[i3 + 0] = (segment.layout[p * 2 + 0] - 0.5) * size
            startArray[i3 + 1] = (segment.layout[p * 2 + 1] - 0.5) * size
            endArray[i3 + 0] = (segment.strip[p * 2 + 0] - 0.5) * size
            endArray[i3 + 1] = (segment.strip[p * 2 + 1] - 0.5) * size
            orderOfPoint[i] = segment.order
        }
    })

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(startArray.slice(), 3))

    // Static copy of the packed-layout pose — the bake act shows the
    // "wireframed parts on the texture" with it
    const layoutGeometry = new THREE.BufferGeometry()
    layoutGeometry.setAttribute('position', new THREE.BufferAttribute(startArray.slice(), 3))

    let lastProgress = - 1

    const update = (progress) =>
    {
        if(Math.abs(progress - lastProgress) < 0.0005)
            return
        lastProgress = progress

        const positions = geometry.attributes.position.array
        for(let i = 0; i < pointCount; i++)
        {
            const offset = orderOfPoint[i] * (1 - WINDOW_SIZE)
            let p = (progress - offset) / WINDOW_SIZE
            p = p < 0 ? 0 : p > 1 ? 1 : p
            p = p * p * (3 - 2 * p)

            const i3 = i * 3
            positions[i3 + 0] = startArray[i3 + 0] + (endArray[i3 + 0] - startArray[i3 + 0]) * p
            positions[i3 + 1] = startArray[i3 + 1] + (endArray[i3 + 1] - startArray[i3 + 1]) * p
        }
        geometry.attributes.position.needsUpdate = true
    }

    update(0)

    return { geometry, layoutGeometry, update }
}
