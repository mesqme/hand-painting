// Headless verification of the island model against the real GLB
import * as THREE from 'three'
import fs from 'node:fs'
import { buildIslandModel } from '../src/world/unwrapLayout.js'
import { buildUvLineData } from '../src/world/uvIslands.js'

const buf = fs.readFileSync('C:/Users/user/Documents/projects/lecturew/hand-painting/public/models/duckColumn.glb')
const jsonLen = buf.readUInt32LE(12)
const json = JSON.parse(buf.slice(20, 20 + jsonLen).toString('utf8'))
const binStart = 20 + jsonLen + 8

function readAccessor(idx)
{
    const acc = json.accessors[idx]
    const bv = json.bufferViews[acc.bufferView]
    const start = binStart + (bv.byteOffset ?? 0) + (acc.byteOffset ?? 0)
    const compCount = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[acc.type]
    if(acc.componentType === 5126)
        return { array: new Float32Array(buf.buffer.slice(buf.byteOffset + start, buf.byteOffset + start + acc.count * compCount * 4)), itemSize: compCount }
    if(acc.componentType === 5123)
        return { array: new Uint16Array(buf.buffer.slice(buf.byteOffset + start, buf.byteOffset + start + acc.count * compCount * 2)), itemSize: compCount }
    if(acc.componentType === 5125)
        return { array: new Uint32Array(buf.buffer.slice(buf.byteOffset + start, buf.byteOffset + start + acc.count * compCount * 4)), itemSize: compCount }
}

function geometryFor(meshIndex)
{
    const prim = json.meshes[meshIndex].primitives[0]
    const geometry = new THREE.BufferGeometry()
    for(const [name, attr] of [ [ 'position', 'POSITION' ], [ 'normal', 'NORMAL' ], [ 'uv', 'TEXCOORD_0' ] ])
    {
        const { array, itemSize } = readAccessor(prim.attributes[attr])
        geometry.setAttribute(name, new THREE.BufferAttribute(array, itemSize))
    }
    const idx = readAccessor(prim.indices)
    geometry.setIndex(new THREE.BufferAttribute(idx.array, 1))
    return geometry.toNonIndexed()
}

// Map by node name (mesh order is not guaranteed across GLB re-exports)
const meshOf = (name) => json.nodes.find((n) => n.name === name).mesh
const duck = geometryFor(meshOf('duck'))
const column = geometryFor(meshOf('column'))

const problems = []
const ok = (label) => console.log('  ok —', label)

const islandModel = buildIslandModel([ duck, column ])
console.log(`islands: ${ islandModel.islands.length }, outline segments: ${ islandModel.outlineSegments.length }`)

// Island count sanity — clusters, not per-face fragments
if(islandModel.islands.length < 8 || islandModel.islands.length > 120)
    problems.push(`island count ${ islandModel.islands.length } outside the plausible 8..120 range`)
else
    ok(`island count plausible (${ islandModel.islands.length })`)

// Seams exist for both parts
for(const geometry of [ duck, column ])
{
    const name = geometry === duck ? 'duck' : 'column'
    const seams = islandModel.seamsByGeometry.get(geometry)
    if(!seams || seams.length < 12)
        problems.push(`${ name }: too few seam points (${ seams ? seams.length : 0 })`)
    else
        ok(`${ name }: ${ seams.length / 6 } seam segments`)

    let nan = 0
    for(const v of seams)
        if(Number.isNaN(v)) nan++
    if(nan) problems.push(`${ name }: ${ nan } NaN seam values`)
}

// Attributes: present, in 0-1, NaN-free
for(const geometry of [ duck, column ])
{
    const name = geometry === duck ? 'duck' : 'column'
    const unwrap = geometry.getAttribute('aUnwrapUv')
    const order = geometry.getAttribute('aPackOrder')

    if(!unwrap || !order) { problems.push(`${ name }: missing attribute`); continue }

    let min = Infinity, max = - Infinity, nan = 0, orderBad = 0
    for(let i = 0; i < unwrap.count; i++)
    {
        const u = unwrap.getX(i), v = unwrap.getY(i)
        if(Number.isNaN(u) || Number.isNaN(v)) nan++
        min = Math.min(min, u, v); max = Math.max(max, u, v)
        const o = order.getX(i)
        if(Number.isNaN(o) || o < 0 || o > 1) orderBad++
    }
    if(nan) problems.push(`${ name }: ${ nan } NaN unwrap uvs`)
    else ok(`${ name }: no NaNs`)
    if(min < - 0.001 || max > 1.001) problems.push(`${ name }: unwrap outside 0-1: ${ min.toFixed(3) }..${ max.toFixed(3) }`)
    else ok(`${ name }: unwrap within 0-1 (${ min.toFixed(3) }..${ max.toFixed(3) })`)
    if(orderBad) problems.push(`${ name }: ${ orderBad } bad aPackOrder values`)
    else ok(`${ name }: aPackOrder in 0-1`)
}

// Line data builds and animates NaN-free
const lineData = buildUvLineData(islandModel, 1.7)
ok(`line data built: ${ lineData.geometry.getAttribute('position').count } points`)

for(const progress of [ 0, 0.25, 0.5, 0.75, 1 ])
{
    lineData.update(progress)
    const positions = lineData.geometry.getAttribute('position').array
    let nan = 0
    for(let i = 0; i < positions.length; i++)
        if(Number.isNaN(positions[i])) nan++
    if(nan) problems.push(`line data NaNs at progress ${ progress }: ${ nan }`)
}
ok('line animation NaN-free across progress 0..1')

console.log()
if(problems.length)
{
    console.log('PROBLEMS:')
    problems.forEach((p) => console.log('  ✗', p))
    process.exit(1)
}
console.log('ALL CHECKS PASSED')
