import * as THREE from 'three'

/**
 * Island model
 *
 * The shipped GLB's TEXCOORD_0 is a gradient-palette lookup (tiny strips), so
 * real unwrap data doesn't exist in the file yet. This builds a plausible
 * stand-in from the mesh itself: faces are welded by position and region-grown
 * into clusters by normal similarity — giving big, unwrap-like islands with
 * honest SEAM LINES between them — then each cluster is planar-projected and
 * shelf-packed into the 0-1 square (the `aUnwrapUv` attribute).
 *
 * REPLACEMENT PATH: when the real seam-cut export lands as TEXCOORD_1, derive
 * islands from uv1 connectivity and seams from edges split in uv1 — everything
 * downstream (attributes, outlines, morph, seams rendering) keeps its shape.
 *
 * Expects NON-INDEXED geometries (each face owns its 3 corners).
 */
export function buildIslandModel(geometries)
{
    const allIslands = []
    const seamsByGeometry = new Map()
    const perGeometry = []

    /**
     * Pass 1 — weld, adjacency, clustering, seams
     */
    for(const geometry of geometries)
    {
        const positions = geometry.attributes.position
        const normals = geometry.attributes.normal
        const faceCount = positions.count / 3

        // Weld corners by position
        const weldOf = new Int32Array(positions.count)
        const weldIds = new Map()
        for(let i = 0; i < positions.count; i++)
        {
            const key = `${ Math.round(positions.getX(i) * 10000) }_${ Math.round(positions.getY(i) * 10000) }_${ Math.round(positions.getZ(i) * 10000) }`
            let id = weldIds.get(key)
            if(id === undefined)
            {
                id = weldIds.size
                weldIds.set(key, id)
            }
            weldOf[i] = id
        }

        // Face normals + welded-edge → faces
        const faceNormals = []
        const edgeFaces = new Map()
        const edgeKey = (a, b) => a < b ? a * 1000000 + b : b * 1000000 + a

        for(let face = 0; face < faceCount; face++)
        {
            const normal = new THREE.Vector3()
            for(let corner = 0; corner < 3; corner++)
            {
                const i = face * 3 + corner
                normal.x += normals.getX(i)
                normal.y += normals.getY(i)
                normal.z += normals.getZ(i)
            }
            normal.normalize()
            faceNormals.push(normal)

            for(let e = 0; e < 3; e++)
            {
                const wa = weldOf[face * 3 + e]
                const wb = weldOf[face * 3 + (e + 1) % 3]
                if(wa === wb)
                    continue
                const key = edgeKey(wa, wb)
                let list = edgeFaces.get(key)
                if(!list)
                {
                    list = []
                    edgeFaces.set(key, list)
                }
                list.push(face)
            }
        }

        // Region growing — clusters of similar-facing connected faces
        const clusterOf = new Int32Array(faceCount).fill(- 1)
        const clusters = []
        const capFaces = Math.max(48, Math.floor(faceCount / 7))
        const cosThreshold = 0.6

        for(let seed = 0; seed < faceCount; seed++)
        {
            if(clusterOf[seed] !== - 1)
                continue

            const clusterIndex = clusters.length
            const cluster = { faces: [], normal: faceNormals[seed].clone() }
            clusters.push(cluster)

            const queue = [ seed ]
            clusterOf[seed] = clusterIndex
            let claimed = 1

            while(queue.length > 0)
            {
                const face = queue.shift()
                cluster.faces.push(face)
                cluster.normal.add(faceNormals[face]).normalize()

                if(claimed >= capFaces)
                    continue

                for(let e = 0; e < 3; e++)
                {
                    const wa = weldOf[face * 3 + e]
                    const wb = weldOf[face * 3 + (e + 1) % 3]
                    if(wa === wb)
                        continue
                    for(const neighbour of edgeFaces.get(edgeKey(wa, wb)))
                    {
                        if(clusterOf[neighbour] !== - 1 || claimed >= capFaces)
                            continue
                        if(faceNormals[neighbour].dot(cluster.normal) < cosThreshold)
                            continue
                        clusterOf[neighbour] = clusterIndex
                        claimed++
                        queue.push(neighbour)
                    }
                }
            }
        }

        // Seams — welded edges whose faces sit in different clusters
        const seamPoints = []
        for(const [key, faces] of edgeFaces)
        {
            if(faces.length < 2)
                continue

            let mixed = false
            for(let i = 1; i < faces.length; i++)
                if(clusterOf[faces[i]] !== clusterOf[faces[0]]) { mixed = true; break }
            if(!mixed)
                continue

            const wa = Math.floor(key / 1000000)
            const wb = key % 1000000
            const face = faces[0]
            let cornerA = - 1
            let cornerB = - 1
            for(let corner = 0; corner < 3; corner++)
            {
                const i = face * 3 + corner
                if(weldOf[i] === wa) cornerA = i
                if(weldOf[i] === wb) cornerB = i
            }
            if(cornerA === - 1 || cornerB === - 1)
                continue

            seamPoints.push(
                positions.getX(cornerA), positions.getY(cornerA), positions.getZ(cornerA),
                positions.getX(cornerB), positions.getY(cornerB), positions.getZ(cornerB)
            )
        }
        seamsByGeometry.set(geometry, new Float32Array(seamPoints))

        // Cluster records → islands with planar projection
        for(const cluster of clusters)
        {
            const normal = cluster.normal.clone().normalize()
            if(normal.lengthSq() < 0.5)
                normal.set(0, 0, 1)
            const up = Math.abs(normal.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)
            const axisU = new THREE.Vector3().crossVectors(up, normal).normalize()
            const axisV = new THREE.Vector3().crossVectors(normal, axisU)

            const projected = new Map()
            let minU = Infinity, maxU = - Infinity, minV = Infinity, maxV = - Infinity
            const point = new THREE.Vector3()

            for(const face of cluster.faces)
            {
                for(let corner = 0; corner < 3; corner++)
                {
                    const i = face * 3 + corner
                    point.set(positions.getX(i), positions.getY(i), positions.getZ(i))
                    const u = point.dot(axisU)
                    const v = point.dot(axisV)
                    projected.set(i, [ u, v ])
                    if(u < minU) minU = u
                    if(u > maxU) maxU = u
                    if(v < minV) minV = v
                    if(v > maxV) maxV = v
                }
            }

            allIslands.push({
                geometry,
                faces: cluster.faces,
                projected,
                minU, minV,
                width: Math.max(maxU - minU, 0.0001),
                height: Math.max(maxV - minV, 0.0001),
            })
        }

        perGeometry.push({ geometry, clusterOf, edgeFaces, weldOf })
    }

    /**
     * Pass 2 — shelf-pack every island into the unit square
     */
    const padding = 0.014
    let totalArea = 0
    let maxDimension = 0
    for(const island of allIslands)
    {
        totalArea += island.width * island.height
        maxDimension = Math.max(maxDimension, island.width, island.height)
    }

    let scale = Math.min(Math.sqrt(0.52 / totalArea), 0.42 / maxDimension)

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
    const offsetY = Math.max((1 - used) * 0.5, 0)

    /**
     * Pass 3 — pack order (single source of truth for the act-02 lockstep)
     */
    for(const island of allIslands)
    {
        island.unwrapScale = scale
        island.centerX = island.originX + island.width * scale * 0.5
        island.centerY = island.originY + offsetY + island.height * scale * 0.5
    }

    const sorted = [...allIslands].sort((a, b) =>
    {
        return (a.centerX - b.centerX) || (b.centerY - a.centerY)
    })
    sorted.forEach((island, order) =>
    {
        island.orderNorm = sorted.length > 1 ? order / (sorted.length - 1) : 0
    })

    /**
     * Pass 4 — attributes + real-uv landing data
     */
    const unwrapArrays = new Map()
    const orderArrays = new Map()
    for(const geometry of geometries)
    {
        unwrapArrays.set(geometry, new Float32Array(geometry.attributes.position.count * 2))
        orderArrays.set(geometry, new Float32Array(geometry.attributes.position.count))
    }

    for(const island of allIslands)
    {
        const unwrapArray = unwrapArrays.get(island.geometry)
        const orderArray = orderArrays.get(island.geometry)
        const uv = island.geometry.attributes.uv

        let uvMinU = Infinity, uvMaxU = - Infinity, uvMinV = Infinity, uvMaxV = - Infinity
        let uvSumU = 0, uvSumV = 0

        for(const [ corner, [ u, v ] ] of island.projected)
        {
            unwrapArray[corner * 2 + 0] = island.originX + (u - island.minU) * scale
            unwrapArray[corner * 2 + 1] = island.originY + offsetY + (v - island.minV) * scale
            orderArray[corner] = island.orderNorm

            const ru = uv.getX(corner)
            const rv = uv.getY(corner)
            uvSumU += ru
            uvSumV += rv
            if(ru < uvMinU) uvMinU = ru
            if(ru > uvMaxU) uvMaxU = ru
            if(rv < uvMinV) uvMinV = rv
            if(rv > uvMaxV) uvMaxV = rv
        }

        island.stripU = uvSumU / island.projected.size
        island.stripV = uvSumV / island.projected.size

        // Landing pose keeps the recognisable layout shape at tick size
        const layoutExtent = Math.max(island.width * scale, island.height * scale, 0.0001)
        island.endScale = Math.min(0.035 / layoutExtent, 1)
    }

    for(const geometry of geometries)
    {
        geometry.setAttribute('aUnwrapUv', new THREE.BufferAttribute(unwrapArrays.get(geometry), 2))
        geometry.setAttribute('aPackOrder', new THREE.BufferAttribute(orderArrays.get(geometry), 1))
    }

    /**
     * Pass 5 — island outline segments for the act-02 line animation
     */
    const outlineSegments = []
    for(const { geometry, clusterOf, edgeFaces, weldOf } of perGeometry)
    {
        const unwrapArray = unwrapArrays.get(geometry)
        const islandsOfGeometry = allIslands.filter((island) => island.geometry === geometry)

        for(const island of islandsOfGeometry)
        {
            const layoutCenterX = island.centerX
            const layoutCenterY = island.centerY

            for(const face of island.faces)
            {
                for(let e = 0; e < 3; e++)
                {
                    const cornerA = face * 3 + e
                    const cornerB = face * 3 + (e + 1) % 3
                    const wa = weldOf[cornerA]
                    const wb = weldOf[cornerB]
                    if(wa === wb)
                        continue

                    const key = wa < wb ? wa * 1000000 + wb : wb * 1000000 + wa
                    const sharing = edgeFaces.get(key)
                    let boundary = sharing.length < 2
                    if(!boundary)
                        for(const other of sharing)
                            if(clusterOf[other] !== clusterOf[face]) { boundary = true; break }
                    if(!boundary)
                        continue

                    const layout = [
                        unwrapArray[cornerA * 2 + 0], unwrapArray[cornerA * 2 + 1],
                        unwrapArray[cornerB * 2 + 0], unwrapArray[cornerB * 2 + 1],
                    ]
                    const strip = [
                        island.stripU + (layout[0] - layoutCenterX) * island.endScale,
                        island.stripV + (layout[1] - layoutCenterY) * island.endScale,
                        island.stripU + (layout[2] - layoutCenterX) * island.endScale,
                        island.stripV + (layout[3] - layoutCenterY) * island.endScale,
                    ]
                    outlineSegments.push({ layout, strip, order: island.orderNorm })
                }
            }
        }
    }

    return { islands: allIslands, outlineSegments, seamsByGeometry }
}
