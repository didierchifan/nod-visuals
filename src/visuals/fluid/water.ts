import CameraControls from 'camera-controls'
import {
  Box3,
  Color,
  MathUtils,
  Matrix4,
  Mesh,
  NoToneMapping,
  PerspectiveCamera,
  PlaneGeometry,
  Quaternion,
  Raycaster,
  Scene,
  ShaderMaterial,
  Sphere,
  Spherical,
  Vector2,
  Vector3,
  Vector4,
  WebGLRenderer,
} from 'three'
import { ASPECTS } from '../contours/config.ts'
import type { Frame } from '../frame.ts'
import type { FluidConfig } from './config.ts'
import fragmentShader from './fragment.glsl?raw'
import vertexShader from './vertex.glsl?raw'

// The same subset drei's <CameraControls> installs.
CameraControls.install({
  THREE: { Box3, MathUtils: { clamp: MathUtils.clamp }, Matrix4, Quaternion, Raycaster, Sphere, Spherical, Vector2, Vector3, Vector4 },
})

export interface Water {
  apply(config: FluidConfig): void
  /** A copy of the picture on a 2D canvas, at the canvas's own resolution. */
  capture(): HTMLCanvasElement
  resetView(): void
  dispose(): void
}

/** The picture's box inside a `width` x `height` one: as large as fits, centred, on whole pixels. */
export function fitAspect(aspect: number, width: number, height: number): Frame {
  const w = Math.floor(Math.min(width, height * aspect))
  const h = Math.floor(Math.min(height, width / aspect))
  return { left: Math.floor((width - w) / 2), top: Math.floor((height - h) / 2), width: w, height: h }
}

/**
 * The raging sea from didierchifan/3d-portfolio, set up the way its React Three Fiber
 * <Canvas> sets it up, so the picture and the orbit match. Its <ToneMapping> sits outside
 * an EffectComposer and its ambient light never reaches a ShaderMaterial, so neither
 * changes a pixel; both are left out. The repo's canvas fills the window; this one
 * takes the config's aspect, letterboxed in `container`.
 */
export function createWater(container: HTMLElement): Water {
  const canvas = document.createElement('canvas')
  canvas.style.cssText = 'position: absolute; display: block'
  container.append(canvas)
  let aspect = 0
  let zoom: number | null = null

  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' })
  renderer.toneMapping = NoToneMapping
  // The repo's canvas is transparent over a black page.
  renderer.setClearColor(0x000000, 1)

  const camera = new PerspectiveCamera(45, 1, 0.1, 100)
  camera.position.set(0, 1, 0)
  camera.zoom = 0.25
  camera.lookAt(0, 0, 0)

  const material = new ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uBigWavesElevation: { value: 0 },
      uBigWavesFrequency: { value: new Vector2() },
      uBigWavesSpeed: { value: 0 },
      uSmallWavesElevation: { value: 0 },
      uSmallWavesFrequency: { value: 0 },
      uSmallWavesSpeed: { value: 0 },
      uSmallIterations: { value: 0 },
      uDepthColor: { value: new Color() },
      uSurfaceColor: { value: new Color() },
      uColorOffset: { value: 0 },
      uColorMultiplier: { value: 0 },
    },
  })
  const geometry = new PlaneGeometry(2, 2, 512, 512)
  const mesh = new Mesh(geometry, material)
  mesh.rotation.x = -Math.PI * 0.5
  const scene = new Scene().add(mesh)

  const controls = new CameraControls(camera, canvas)

  const fit = () => {
    if (!aspect) return
    const frame = fitAspect(aspect, container.clientWidth, container.clientHeight)
    const width = Math.max(1, frame.width)
    const height = Math.max(1, frame.height)
    canvas.style.left = `${frame.left}px`
    canvas.style.top = `${frame.top}px`
    renderer.setPixelRatio(Math.min(Math.max(1, window.devicePixelRatio), 2))
    renderer.setSize(width, height)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
  }
  const observer = new ResizeObserver(fit)
  observer.observe(container)

  // Controls first, then time, then the frame: the order the repo's useFrame hooks run in.
  let last = performance.now()
  renderer.setAnimationLoop(() => {
    const now = performance.now()
    const delta = (now - last) / 1000
    last = now
    controls.update(delta)
    material.uniforms.uTime.value += delta
    renderer.render(scene, camera)
  })

  return {
    apply(config) {
      const u = material.uniforms
      u.uBigWavesElevation.value = config.uBigWavesElevation
      u.uBigWavesFrequency.value.set(config.uBigWavesFrequencyX, config.uBigWavesFrequencyY)
      u.uBigWavesSpeed.value = config.uBigWavesSpeed
      u.uSmallWavesElevation.value = config.uSmallWavesElevation
      u.uSmallWavesFrequency.value = config.uSmallWavesFrequency
      u.uSmallWavesSpeed.value = config.uSmallWavesSpeed
      u.uSmallIterations.value = config.uSmallIterations
      // Hex strings are sRGB; Color.set brings them into linear, as R3F does with leva's.
      u.uDepthColor.value.set(config.color1)
      u.uSurfaceColor.value.set(config.color2)
      u.uColorOffset.value = config.uColorOffset
      u.uColorMultiplier.value = config.uColorMultiplier
      if (ASPECTS[config.aspect] !== aspect) {
        aspect = ASPECTS[config.aspect]
        fit()
      }
      if (config.zoom !== zoom) {
        // Eased, except the first time, so a stored zoom doesn't play in on load.
        controls.zoomTo(config.zoom, zoom !== null)
        zoom = config.zoom
      }
    },
    capture() {
      // Copied straight after drawing, while the drawing buffer still holds the frame.
      renderer.render(scene, camera)
      const copy = document.createElement('canvas')
      copy.width = canvas.width
      copy.height = canvas.height
      copy.getContext('2d')!.drawImage(canvas, 0, 0)
      return copy
    },
    resetView() {
      // Back to the repo's camera, but at the zoom the config asks for.
      controls.reset(true)
      if (zoom !== null) controls.zoomTo(zoom, true)
    },
    dispose() {
      renderer.setAnimationLoop(null)
      observer.disconnect()
      controls.dispose()
      geometry.dispose()
      material.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      canvas.remove()
    },
  }
}
