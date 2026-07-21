import * as THREE from 'three'

import { computeIslands } from './unwrapLayout.js'

/**
 * UV islands — act 02
 *
 * The animation the palette workflow deserves: every island starts laid out
 * "at full scale" (the synthetic aUnwrapUv layout spread over the sheet) and
 * shrinks onto the tiny gradient strip its real UVs actually occupy. Start
 * shapes come from aUnwrapUv, landing spots from the real `uv` centroids —
 * honest data on both ends, visible at both ends (the landing pose keeps a
 * minimum tick size, since the real strips are sub-pixel).
 */
export function buildUvLineData(geometries, size)
{
    const segments = []   // { start: [x,y], end: [x,y], island }
    const islands = []

    for(const geometry of geometries)
    {
        const { islands: rawIslands, find } = computeIslands(geometry)
        const index = geometry.index.array
        const uvAttribute = geometry.attributes.uv
        const unwrapAttribute = geometry.attributes.aUnwrapUv
        const vertexCount = uvAttribute.count

        // Island records: synthetic bounds + real-uv centroid
        const islandOfRoot = new Map()
        for(const raw of rawIslands)
        {
            const island = {
                minX: Infinity, maxX: - Infinity,
                minY: Infinity, maxY: - Infinity,
                centroidU: 0, centroidV: 0,
            }
            for(const vertex of raw.vertices)
            {
                const x = unwrapAttribute.getX(vertex)
                const y = unwrapAttribute.getY(vertex)
                if(x < island.minX) island.minX = x
                if(x > island.maxX) island.maxX = x
                if(y < island.minY) island.minY = y
                if(y > island.maxY) island.maxY = y
                island.centroidU += uvAttribute.getX(vertex)
                island.centroidV += uvAttribute.getY(vertex)
            }
            island.centroidU /= raw.vertices.size
            island.centroidV /= raw.vertices.size
            island.centerX = (island.minX + island.maxX) * 0.5
            island.centerY = (island.minY + island.maxY) * 0.5

            // Landing pose: shrink towards the strip, but stay a visible tick
            const extent = Math.max(island.maxX - island.minX, island.maxY - island.minY, 0.0001)
            island.endScale = Math.min(0.03 / extent, 1)

            islandOfRoot.set(raw, island)
            for(const vertex of raw.vertices)
                islandOfRoot.set(find(vertex), island)
            islands.push(island)
        }

        // Outline edges (used by exactly one triangle)
        const edgeUse = new Map()
        for(let t = 0; t < index.length; t += 3)
        {
            for(let e = 0; e < 3; e++)
            {
                const a = index[t + e]
                const b = index[t + (e + 1) % 3]
                const key = a < b ? a * vertexCount + b : b * vertexCount + a
                edgeUse.set(key, (edgeUse.get(key) ?? 0) + 1)
            }
        }

        for(const [key, count] of edgeUse)
        {
            if(count !== 1)
                continue

            const a = Math.floor(key / vertexCount)
            const b = key % vertexCount
            const island = islandOfRoot.get(find(a))

            for(const vertex of [ a, b ])
            {
                const x = unwrapAttribute.getX(vertex)
                const y = unwrapAttribute.getY(vertex)

                segments.push({
                    // Full-scale layout pose, sheet space
                    start: [ (x - 0.5) * size, (y - 0.5) * size ],
                    // Same shape shrunk onto the real palette strip
                    end: [
                        (island.centroidU - 0.5 + (x - island.centerX) * island.endScale) * size,
                        (island.centroidV - 0.5 + (y - island.centerY) * island.endScale) * size,
                    ],
                    island,
                })
            }
        }
    }

    // Stagger order — sweep the layout left to right, top to bottom
    const sorted = [...islands].sort((a, b) =>
    {
        return (a.centerX - b.centerX) || (b.centerY - a.centerY)
    })
    sorted.forEach((island, order) => { island.order = order })

    /**
     * Buffers
     */
    const pointCount = segments.length
    const startArray = new Float32Array(pointCount * 3)
    const endArray = new Float32Array(pointCount * 3)
    const islandOfPoint = new Array(pointCount)

    segments.forEach((segment, i) =>
    {
        const i3 = i * 3
        startArray[i3 + 0] = segment.start[0]
        startArray[i3 + 1] = segment.start[1]
        endArray[i3 + 0] = segment.end[0]
        endArray[i3 + 1] = segment.end[1]
        islandOfPoint[i] = segment.island
    })

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(startArray.slice(), 3))

    /**
     * Staggered lerp start → end, driven by scroll
     */
    const islandCount = islands.length
    const windowSize = 0.4
    let lastProgress = - 1

    const update = (progress) =>
    {
        if(Math.abs(progress - lastProgress) < 0.0005)
            return
        lastProgress = progress

        const positions = geometry.attributes.position.array
        for(let i = 0; i < pointCount; i++)
        {
            const island = islandOfPoint[i]
            const offset = islandCount > 1 ? (island.order / (islandCount - 1)) * (1 - windowSize) : 0
            let p = (progress - offset) / windowSize
            p = p < 0 ? 0 : p > 1 ? 1 : p
            p = p * p * (3 - 2 * p)

            const i3 = i * 3
            positions[i3 + 0] = startArray[i3 + 0] + (endArray[i3 + 0] - startArray[i3 + 0]) * p
            positions[i3 + 1] = startArray[i3 + 1] + (endArray[i3 + 1] - startArray[i3 + 1]) * p
        }
        geometry.attributes.position.needsUpdate = true
    }

    update(0)

    return { geometry, update }
}
