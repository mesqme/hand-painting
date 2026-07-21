import * as THREE from 'three'

/**
 * Soft contact shadow — a camera-facing squashed radial-gradient sprite under
 * standing objects. The camera looks head-on, so a real floor-plane shadow
 * would be edge-on and invisible; the billboard ellipse is the classic fake.
 */
let sharedTexture = null

function getShadowTexture()
{
    if(sharedTexture)
        return sharedTexture

    const canvas = document.createElement('canvas')
    canvas.width = 128
    canvas.height = 64
    const context = canvas.getContext('2d')

    const gradient = context.createRadialGradient(64, 32, 4, 64, 32, 60)
    gradient.addColorStop(0, 'rgba(40, 38, 35, 0.55)')
    gradient.addColorStop(0.55, 'rgba(40, 38, 35, 0.22)')
    gradient.addColorStop(1, 'rgba(40, 38, 35, 0)')
    context.save()
    context.scale(1, 0.5)
    context.translate(0, 32)
    context.fillStyle = gradient
    context.fillRect(0, - 32, 128, 128)
    context.restore()

    sharedTexture = new THREE.CanvasTexture(canvas)
    return sharedTexture
}

export function createShadowMaterial()
{
    return new THREE.MeshBasicMaterial({
        map: getShadowTexture(),
        transparent: true,
        depthWrite: false,
        opacity: 0,
    })
}
