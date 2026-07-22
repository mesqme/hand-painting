import * as THREE from 'three'

/**
 * Island model — from the REAL second UV layer (TEXCOORD_1 → uv1)
 *
 * The optimised GLB carries a proper seam-cut unwrap in uv1 (the baked-texture
 * layout). This derives everything the presentation needs straight from it:
 *   - islands   = connected charts in uv1 (vertices welded by uv1; a seam is
 *                 exactly where two charts split, so welding reunites a chart
 *                 and separates across seams);
 *   - seams     = uv1 chart-boundary edges, drawn in 3D on the model (act 04);
 *   - outlines  = the SAME boundary edges in uv1-layout space, animated onto
 *                 the gradient-palette strips (uv0) for act 02;
 *   - aUnwrapUv = uv1 itself (the flatten-morph target + the act-02 sample
 *                 start pose), aPackOrder = per-island stagger order.
 *
 * uv0 (TEXCOORD_0) stays the gradient-palette strip lookup — islands land on
 * their uv0 strip at the end of the act-02 animation.
 *
 * Expects NON-INDEXED geometries carrying `uv` (uv0) and `uv1`.
 */
export function buildIslandModel(geometries)
{
    const allIslands = []
    const seamsByGeometry = new Map()
    const perGeometry = []

    /**
     * Pass 1 — per geometry: uv1 islands, boundary edges, 3D seams
     */
    for(const geometry of geometries)
    {
        const position = geometry.attributes.position
        const uv0 = geometry.attributes.uv
        const uv1 = geometry.attributes.uv1
        const cornerCount = position.count
        const triCount = cornerCount / 3

        // Weld corners by uv1 coordinate (identity within a chart, split at seams)
        const uvKey = (c) => `${ Math.round(uv1.getX(c) * 1e4) }_${ Math.round(uv1.getY(c) * 1e4) }`
        const weldId = new Map()
        const weldOf = new Int32Array(cornerCount)
        for(let c = 0; c < cornerCount; c++)
        {
            const key = uvKey(c)
            let id = weldId.get(key)
            if(id === undefined)
            {
                id = weldId.size
                weldId.set(key, id)
            }
            weldOf[c] = id
        }

        // Union-find over welded uv1 vertices → island per connected chart
        const parent = new Int32Array(weldId.size)
        for(let i = 0; i < weldId.size; i++)
            parent[i] = i

        const find = (i) =>
        {
            while(parent[i] !== i)
            {
                parent[i] = parent[parent[i]]
                i = parent[i]
            }
            return i
        }

        for(let t = 0; t < triCount; t++)
        {
            const a = find(weldOf[t * 3 + 0])
            const b = find(weldOf[t * 3 + 1])
            const c = find(weldOf[t * 3 + 2])
            if(b !== a) parent[b] = a
            if(c !== a) parent[c] = a
        }

        // Island records, accumulated globally
        const islandOfRoot = new Map()
        const ensureIsland = (root) =>
        {
            let island = islandOfRoot.get(root)
            if(!island)
            {
                island = {
                    geometry,
                    corners: [],
                    minU1: Infinity, maxU1: - Infinity, minV1: Infinity, maxV1: - Infinity,
                    sumU0: 0, sumV0: 0, sumU1: 0, sumV1: 0, count: 0,
                }
                islandOfRoot.set(root, island)
                allIslands.push(island)
            }
            return island
        }

        for(let c = 0; c < cornerCount; c++)
        {
            const island = ensureIsland(find(weldOf[c]))
            island.corners.push(c)
            const u1 = uv1.getX(c)
            const v1 = uv1.getY(c)
            island.minU1 = Math.min(island.minU1, u1)
            island.maxU1 = Math.max(island.maxU1, u1)
            island.minV1 = Math.min(island.minV1, v1)
            island.maxV1 = Math.max(island.maxV1, v1)
            island.sumU0 += uv0.getX(c)
            island.sumV0 += uv0.getY(c)
            island.sumU1 += u1
            island.sumV1 += v1
            island.count++
        }

        // uv1 chart-boundary edges (welded uv1 edge used by exactly one triangle)
        const edgeKey = (a, b) => a < b ? a * 1000003 + b : b * 1000003 + a
        const edgeUse = new Map()
        for(let t = 0; t < triCount; t++)
        {
            for(let e = 0; e < 3; e++)
            {
                const a = weldOf[t * 3 + e]
                const b = weldOf[t * 3 + (e + 1) % 3]
                if(a === b)
                    continue
                const key = edgeKey(a, b)
                edgeUse.set(key, (edgeUse.get(key) ?? 0) + 1)
            }
        }

        const seamPositions = []
        const boundaryEdges = []
        for(let t = 0; t < triCount; t++)
        {
            for(let e = 0; e < 3; e++)
            {
                const ci = t * 3 + e
                const cj = t * 3 + (e + 1) % 3
                const a = weldOf[ci]
                const b = weldOf[cj]
                if(a === b || edgeUse.get(edgeKey(a, b)) !== 1)
                    continue

                seamPositions.push(
                    position.getX(ci), position.getY(ci), position.getZ(ci),
                    position.getX(cj), position.getY(cj), position.getZ(cj)
                )
                boundaryEdges.push({ ci, cj, island: islandOfRoot.get(find(a)) })
            }
        }

        seamsByGeometry.set(geometry, new Float32Array(seamPositions))
        perGeometry.push({ geometry, boundaryEdges })
    }

    /**
     * The layout is uv1 AS AUTHORED — duck and column were unwrapped TOGETHER
     * into one shared texture that fills the whole 0-1 space, so the sheet
     * shows the real islands exactly where the baked/painted texture has them.
     * No re-packing, no per-mesh rescaling.
     */

    /**
     * Finalize island metrics (in uv1 space) + one global order (act-02 lockstep)
     */
    for(const island of allIslands)
    {
        island.uv0c = [ island.sumU0 / island.count, island.sumV0 / island.count ]
        island.uv1c = [ island.sumU1 / island.count, island.sumV1 / island.count ]
        island.pc = island.uv1c
        const extent = Math.max(island.maxU1 - island.minU1, island.maxV1 - island.minV1, 0.0001)
        island.endScale = Math.min(0.035 / extent, 1)
    }

    const sorted = [...allIslands].sort((a, b) => (a.pc[0] - b.pc[0]) || (b.pc[1] - a.pc[1]))
    sorted.forEach((island, index) =>
    {
        island.order = allIslands.length > 1 ? index / (allIslands.length - 1) : 0
    })

    /**
     * Pass 2 — attributes (aUnwrapUv = raw uv1, aPackOrder) + outlines
     */
    for(const geometry of geometries)
    {
        const uv1 = geometry.attributes.uv1
        const cornerCount = geometry.attributes.position.count
        const unwrapArray = new Float32Array(cornerCount * 2)
        const orderArray = new Float32Array(cornerCount)

        for(let c = 0; c < cornerCount; c++)
        {
            unwrapArray[c * 2 + 0] = uv1.getX(c)
            unwrapArray[c * 2 + 1] = uv1.getY(c)
        }

        geometry.setAttribute('aUnwrapUv', new THREE.BufferAttribute(unwrapArray, 2))
        geometry.setAttribute('aPackOrder', new THREE.BufferAttribute(orderArray, 1))
    }

    for(const island of allIslands)
    {
        const orderArray = island.geometry.attributes.aPackOrder.array
        for(const corner of island.corners)
            orderArray[corner] = island.order
    }

    const outlineSegments = []
    for(const { geometry, boundaryEdges } of perGeometry)
    {
        const uv1 = geometry.attributes.uv1
        for(const { ci, cj, island } of boundaryEdges)
        {
            const pi = [ uv1.getX(ci), uv1.getY(ci) ]
            const pj = [ uv1.getX(cj), uv1.getY(cj) ]
            outlineSegments.push({
                // Real uv1 pose, and the shrink onto the uv0 gradient strip
                layout: [ pi[0], pi[1], pj[0], pj[1] ],
                strip: [
                    island.uv0c[0] + (pi[0] - island.pc[0]) * island.endScale,
                    island.uv0c[1] + (pi[1] - island.pc[1]) * island.endScale,
                    island.uv0c[0] + (pj[0] - island.pc[0]) * island.endScale,
                    island.uv0c[1] + (pj[1] - island.pc[1]) * island.endScale,
                ],
                order: island.order,
            })
        }
    }

    return { islands: allIslands, outlineSegments, seamsByGeometry }
}
