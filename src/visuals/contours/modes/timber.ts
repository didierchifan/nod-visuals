import { mulberry32, TAU } from '../random.ts'
import type { FieldMode } from '../types.ts'

const MAX_KNOTS = 8
const DEG = Math.PI / 180

export const timber: FieldMode = {
  id: 'timber',
  name: 'Timber',
  latin: 'cathedral figure',
  blurb:
    'Growth rings are nested cones. Cut across them for end grain, along them for cathedral arches. Dry years leave narrow rings and knots pull the grain around them.',
  params: [
    { key: 'cut', label: 'Cut', min: 0, max: 90, step: 1, value: 84, unit: '°' },
    { key: 'depth', label: 'Pith depth', min: 0, max: 1.5, step: 0.01, value: 0.3 },
    { key: 'taper', label: 'Taper', min: 0, max: 1.5, step: 0.01, value: 0.55 },
    { key: 'climate', label: 'Climate', min: 0, max: 1, step: 0.01, value: 0.55 },
    { key: 'lean', label: 'Lean', min: 0, max: 0.5, step: 0.01, value: 0.15 },
    { key: 'knots', label: 'Knots', min: 0, max: MAX_KNOTS, step: 1, value: 2 },
    { key: 'spin', label: 'Rotate', min: 0, max: 360, step: 1, value: 180, dial: true, unit: '°' },
  ],
  build(p, { seed, halfWidth, spacing }) {
    const rings = mulberry32(seed ^ 0x7177)
    const knotRand = mulberry32(seed ^ 0x4e07)
    const cut = p.cut * DEG
    const cosCut = Math.cos(cut)
    const sinCut = Math.sin(cut)
    const spin = p.spin * DEG
    const cosSpin = Math.cos(spin)
    const sinSpin = Math.sin(spin)
    const leanDir = rings() * TAU

    // One width per year, outward from the pith: wide juvenile rings, slow
    // suppression/release cycles, and the occasional drought year.
    const reach = (Math.hypot(halfWidth, 1) + p.depth) / (1 - p.lean) + p.taper * 1.5 + 1
    const starts: number[] = []
    const widths: number[] = []
    for (let r = 0, year = 0; r < reach && year < 6000; year++) {
      const juvenile = 1 + 0.7 * Math.exp(-year / 6)
      const cycle = 1 + 0.35 * p.climate * Math.sin(year * 0.21 + leanDir)
      const weather = (rings() + rings() + rings() - 1.5) * 1.15
      // Eases into a drought ring as climate rises, rather than snapping.
      const drought = 1 - 0.65 * Math.min(1, Math.max(0, (0.07 * p.climate - rings()) / 0.01))
      const w = spacing * Math.max(0.3, juvenile * cycle * (1 + p.climate * weather)) * drought
      starts.push(r)
      widths.push(w)
      r += w
    }

    const knots: { x: number; y: number; size: number; sign: number }[] = []
    for (let i = 0; i < MAX_KNOTS; i++) {
      const knot = {
        x: (knotRand() * 2 - 1) * halfWidth * 0.8,
        y: (knotRand() * 2 - 1) * 0.8,
        size: 0.035 + knotRand() * 0.09,
        sign: knotRand() < 0.5 ? -1 : 1,
      }
      if (i < p.knots) knots.push(knot)
    }

    const years = (R: number) => {
      if (R <= 0) return R / spacing
      let lo = 0
      let hi = starts.length - 1
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1
        if (starts[mid] <= R) lo = mid
        else hi = mid - 1
      }
      return lo + (R - starts[lo]) / widths[lo]
    }

    return {
      sample(x, y, out) {
        const u = x * cosSpin + y * sinSpin
        const v = -x * sinSpin + y * cosSpin
        // The cut plane through a log whose axis runs along z.
        const px = u
        const py = p.depth + v * cosCut
        const pz = v * sinCut
        let r = Math.hypot(px, py)
        if (p.lean > 0) r /= 1 + p.lean * Math.cos(Math.atan2(py, px) - leanDir)
        let R = r + p.taper * pz
        for (const k of knots) {
          const d2 = ((x - k.x) ** 2 + (y - k.y) ** 2) / (k.size * k.size)
          if (d2 < 9) R += k.sign * k.size * 2.4 * Math.exp(-d2)
        }
        out.v = years(R) * spacing
      },
    }
  },
}
