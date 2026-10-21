import { mulberry32, TAU, wrapAngle } from '../random.ts'
import type { FieldMode } from '../types.ts'

const MAX_BRACKETS = 9
const DEG = Math.PI / 180

export const bracket: FieldMode = {
  id: 'bracket',
  name: 'Turkey Tail',
  latin: 'Trametes versicolor',
  blurb:
    'Fan-shaped brackets overlap like roof tiles. Each one is banded in zones that follow its wavy margin, and the growing edge is the brightest part.',
  outline: true,
  params: [
    { key: 'brackets', label: 'Brackets', min: 1, max: MAX_BRACKETS, step: 1, value: 5 },
    { key: 'size', label: 'Size', min: 0.5, max: 1.4, step: 0.01, value: 1 },
    { key: 'zones', label: 'Zones', min: 0.5, max: 3, step: 0.01, value: 1.6 },
    { key: 'fan', label: 'Fan', min: 90, max: 220, step: 1, value: 170, unit: '°' },
    { key: 'lobes', label: 'Lobes', min: 0, max: 1, step: 0.01, value: 0.5 },
    { key: 'rosette', label: 'Rosette', min: 0, max: 1, step: 0.01, value: 0 },
    { key: 'tilt', label: 'Substrate', min: 0, max: 360, step: 1, value: 0, dial: true, unit: '°' },
  ],
  build(p, { seed, halfWidth }) {
    const rand = mulberry32(seed ^ 0xb7ac)
    const count = Math.round(p.brackets)
    const half = (p.fan * DEG) / 2
    const tilt = p.tilt * DEG
    const cosTilt = Math.cos(tilt)
    const sinTilt = Math.sin(tilt)

    const items: {
      x: number
      y: number
      dir: number
      radius: number
      k1: number
      p1: number
      k2: number
      p2: number
    }[] = []

    for (let i = 0; i < MAX_BRACKETS; i++) {
      const r = Array.from({ length: 8 }, rand)
      if (i >= count) continue
      // Stacked up a trunk from the bottom edge, facing up; or around a centre, facing out.
      const t = count === 1 ? 0.5 : i / (count - 1)
      const lineX = (t * 2 - 1) * halfWidth * 0.75 + (r[0] - 0.5) * 0.25
      const lineY = 1 - r[1] * 0.8
      const lineDir = -Math.PI / 2 + (r[2] - 0.5) * 0.8
      const ringDir = (i / count) * TAU + (r[2] - 0.5) * 0.5
      const x = lineX + (Math.cos(ringDir) * 0.12 - lineX) * p.rosette
      const y = lineY + (Math.sin(ringDir) * 0.12 - lineY) * p.rosette
      items.push({
        x: x * cosTilt - y * sinTilt,
        y: x * sinTilt + y * cosTilt,
        dir: lineDir + wrapAngle(ringDir - lineDir) * p.rosette + tilt,
        radius: p.size * (0.55 + r[3] * 0.6),
        k1: 3 + Math.floor(r[4] * 4),
        p1: r[5] * TAU,
        k2: 7 + Math.floor(r[6] * 5),
        p2: r[7] * TAU,
      })
    }
    // Imbricate: each bracket overlaps the one above it, like scales.
    items.sort((a, b) => a.y - b.y)

    return {
      sample(x, y, out) {
        for (let i = items.length - 1; i >= 0; i--) {
          const b = items[i]
          const dx = x - b.x
          const dy = y - b.y
          const r = Math.hypot(dx, dy)
          if (r > b.radius * 1.3) continue
          const phi = wrapAngle(Math.atan2(dy, dx) - b.dir)
          const t = Math.abs(phi) / half
          if (t >= 1) continue
          const lobe = 1 + p.lobes * (0.12 * Math.sin(b.k1 * phi + b.p1) + 0.06 * Math.sin(b.k2 * phi + b.p2))
          const margin = b.radius * Math.sqrt(1 - t ** 4) * lobe
          if (r >= margin) continue
          out.v = (r / margin) * b.radius * p.zones
          out.region = i + 1
          return
        }
        out.v = NaN
      },
    }
  },
}
