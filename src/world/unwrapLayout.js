import * as THREE from 'three'

/**
 * Synthetic unwrap layout
 *
 * The shipped GLB's TEXCOORD_0 is a gradient-palette lookup: every face parks
 * on a tiny strip (the duck's whole UV set spans ~0.6% of UV space), so it can
 * never serve as a bake layout. Until the real seam-cut export lands, this
 * builds a stand-in 0-1 unwrap at load time: union-find islands over triangle
 * connectivity, each island planar-projected onto its dominant plane, all
 * islands shelf-packed into the unit square. Stored as the `aUnwrapUv`
 * attribute — the shader's flatten morph and the act-02 island animation read
 * it, while color sampling keeps the palette lookup in `uv`.
 */

/**
 * Islands as vertex groups via union-find over the index
 */
export function computeIslands(geometry)
{
    const index = geometry.index.array
    const vertexCount = geometry.attributes.position.count

    const parent = new Int32Array(vertexCount)
    for(let i = 0; i < vertexCount; i++)
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

    for(let t = 0; t < index.length; t += 3)
    {
        const ra = find(index[t + 0])
        const rb = find(index[t + 1])
        const rc = find(index[t + 2])
        if(rb !== ra) parent[rb] = ra
        if(rc !== ra) parent[rc] = ra
    }

    const islands = new Map()
    for(let i = 0; i < index.length; i++)
    {
        const vertex = index[i]
        const root = find(vertex)
        let island = islands.get(root)
        if(!island)
        {
            island = { vertices: new Set() }
            islands.set(root, island)
        }
        island.vertices.add(vertex)
    }

    return { islands: [...islands.values()], find }
}

/**
 * Builds aUnwrapUv for a set of geometries sharing one packed sheet
 */
export function buildUnwrapAttribute(geometries)
{
    const allIslands = []

    for(const geometry of geometries)
    {
        const { islands } = computeIslands(geometry)
        const positions = geometry.attributes.position
        const normals = geometry.attributes.normal

        for(const island of islands)
        {
            const vertices = [...island.vertices]

            // Dominant plane basis from the average normal; closed islands whose
            // normals cancel out fall back to the first vertex normal
            const normal = new THREE.Vector3()
            for(const v of vertices)
                normal.add(new THREE.Vector3(normals.getX(v), normals.getY(v), normals.getZ(v)))
            if(normal.lengthSq() < 0.000001)
                normal.set(normals.getX(vertices[0]), normals.getY(vertices[0]), normals.getZ(vertices[0]))
            if(normal.lengthSq() < 0.000001)
                normal.set(0, 0, 1)
            normal.normalize()

            const up = Math.abs(normal.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)
            const axisU = new THREE.Vector3().crossVectors(up, normal).normalize()
            const axisV = new THREE.Vector3().crossVectors(normal, axisU)

            // Planar projection
            const projected = new Map()
            let minU = Infinity
            let maxU = - Infinity
            let minV = Infinity
            let maxV = - Infinity
            const point = new THREE.Vector3()

            for(const v of vertices)
            {
                point.set(positions.getX(v), positions.getY(v), positions.getZ(v))
                const u = point.dot(axisU)
                const vv = point.dot(axisV)
                projected.set(v, [ u, vv ])
                if(u < minU) minU = u
                if(u > maxU) maxU = u
                if(vv < minV) minV = vv
                if(vv > maxV) maxV = vv
            }

            allIslands.push({
                geometry,
                projected,
                minU,
                minV,
                width: Math.max(maxU - minU, 0.0001),
                height: Math.max(maxV - minV, 0.0001),
            })
        }
    }

    /**
     * Shelf packing into the unit square
     */
    const padding = 0.012
    let totalArea = 0
    let maxDimension = 0
    for(const island of allIslands)
    {
        totalArea += island.width * island.height
        maxDimension = Math.max(maxDimension, island.width, island.height)
    }

    let scale = Math.min(Math.sqrt(0.52 / totalArea), 0.34 / maxDimension)

    const pack = (s) =>
    {
        const sorted = [...allIslands].sort((a, b) => b.height * s - a.height * s)
        let cursorX = padding
        let cursorY = padding
        let rowHeight = 0

        for(const island of sorted)
        {
            const w = island.width * s
            const h = island.height * s

            if(cursorX + w + padding > 1)
            {
                cursorX = padding
                cursorY += rowHeight + padding
                rowHeight = 0
            }

            island.originX = cursorX
            island.originY = cursorY
            rowHeight = Math.max(rowHeight, h)
            cursorX += w + padding
        }

        return cursorY + rowHeight + padding
    }

    let used = pack(scale)
    if(used > 1)
    {
        scale = scale / used * 0.96
        used = pack(scale)
    }

    // Center the packed block vertically
    const offsetY = Math.max((1 - used) * 0.5, 0)

    /**
     * Write attributes
     */
    const attributes = new Map()
    for(const geometry of geometries)
        attributes.set(geometry, new Float32Array(geometry.attributes.position.count * 2))

    for(const island of allIslands)
    {
        const array = attributes.get(island.geometry)
        island.unwrapScale = scale

        for(const [ vertex, [ u, v ] ] of island.projected)
        {
            array[vertex * 2 + 0] = island.originX + (u - island.minU) * scale
            array[vertex * 2 + 1] = island.originY + offsetY + (v - island.minV) * scale
        }
    }

    for(const geometry of geometries)
        geometry.setAttribute('aUnwrapUv', new THREE.BufferAttribute(attributes.get(geometry), 2))

    return { islands: allIslands }
}
