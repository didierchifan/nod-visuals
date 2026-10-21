export type Rand = () => number

export function mulberry32(seed: number): Rand {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Stable value in [0, 1) per cell, so LED unevenness never flickers between frames. */
export function hash2(x: number, y: number, seed: number) {
  let h = (Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1) ^ Math.imul(seed, 0x9e3779b1)) >>> 0
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

const GX = [1, -1, 0, 0, Math.SQRT1_2, -Math.SQRT1_2, Math.SQRT1_2, -Math.SQRT1_2]
const GY = [0, 0, 1, -1, Math.SQRT1_2, Math.SQRT1_2, -Math.SQRT1_2, -Math.SQRT1_2]

export interface Noise {
  /** Gradient noise, roughly in [-1, 1]. */
  noise(x: number, y: number): number
  fbm(x: number, y: number, octaves?: number): number
}

export function createNoise(rand: Rand): Noise {
  const order = Array.from({ length: 256 }, (_, i) => i)
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  const p = new Uint8Array(512)
  for (let i = 0; i < 512; i++) p[i] = order[i & 255]

  const dot = (h: number, x: number, y: number) => GX[h & 7] * x + GY[h & 7] * y

  function noise(x: number, y: number) {
    const xi = Math.floor(x)
    const yi = Math.floor(y)
    const xf = x - xi
    const yf = y - yi
    const X = xi & 255
    const Y = yi & 255
    const u = xf * xf * xf * (xf * (xf * 6 - 15) + 10)
    const v = yf * yf * yf * (yf * (yf * 6 - 15) + 10)
    const n00 = dot(p[p[X] + Y], xf, yf)
    const n10 = dot(p[p[X + 1] + Y], xf - 1, yf)
    const n01 = dot(p[p[X] + Y + 1], xf, yf - 1)
    const n11 = dot(p[p[X + 1] + Y + 1], xf - 1, yf - 1)
    const top = n00 + u * (n10 - n00)
    const bottom = n01 + u * (n11 - n01)
    return (top + v * (bottom - top)) * 1.41
  }

  function fbm(x: number, y: number, octaves = 4) {
    let sum = 0
    let amp = 1
    let norm = 0
    let freq = 1
    for (let o = 0; o < octaves; o++) {
      sum += amp * noise(x * freq + o * 17.3, y * freq - o * 9.1)
      norm += amp
      amp *= 0.5
      freq *= 2.03
    }
    return sum / norm
  }

  return { noise, fbm }
}

/** Uniform buckets over [-extentX, extentX] x [-extentY, extentY] for "what is near this point". */
export function bucketGrid(size: number, extentX: number, extentY: number) {
  const nx = Math.ceil((2 * extentX) / size) + 1
  const ny = Math.ceil((2 * extentY) / size) + 1
  const cells: (number[] | undefined)[] = new Array(nx * ny)
  const col = (x: number) => Math.min(nx - 1, Math.max(0, Math.floor((x + extentX) / size)))
  const row = (y: number) => Math.min(ny - 1, Math.max(0, Math.floor((y + extentY) / size)))
  const each = (cx: number, cy: number, fn: (id: number) => void) => {
    if (cx < 0 || cy < 0 || cx >= nx || cy >= ny) return
    const list = cells[cy * nx + cx]
    if (list) for (let i = 0; i < list.length; i++) fn(list[i])
  }

  return {
    insert(id: number, x0: number, y0: number, x1: number, y1: number) {
      for (let cy = row(y0); cy <= row(y1); cy++) {
        for (let cx = col(x0); cx <= col(x1); cx++) {
          const k = cy * nx + cx
          const list = cells[k]
          if (list) list.push(id)
          else cells[k] = [id]
        }
      }
    },
    /** Visits everything inserted within one bucket of (x, y). Ids can repeat. */
    visit(x: number, y: number, fn: (id: number) => void) {
      const cx = col(x)
      const cy = row(y)
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) each(cx + dx, cy + dy, fn)
    },
    /**
     * Visits buckets ring by ring out to `radius`, stopping once `settled(d)` says
     * nothing at distance `d` or beyond can matter any more.
     */
    spiral(x: number, y: number, radius: number, fn: (id: number) => void, settled: (d: number) => boolean) {
      const cx = col(x)
      const cy = row(y)
      const rings = Math.ceil(radius / size) + 1
      for (let r = 0; r <= rings; r++) {
        if (r > 1 && settled((r - 1) * size)) return
        if (r === 0) {
          each(cx, cy, fn)
          continue
        }
        for (let d = -r; d <= r; d++) {
          each(cx + d, cy - r, fn)
          each(cx + d, cy + r, fn)
        }
        for (let d = 1 - r; d < r; d++) {
          each(cx - r, cy + d, fn)
          each(cx + r, cy + d, fn)
        }
      }
    },
  }
}

export const TAU = Math.PI * 2

/** Wraps an angle into [-PI, PI). */
export function wrapAngle(a: number) {
  return a - TAU * Math.floor((a + Math.PI) / TAU)
}
