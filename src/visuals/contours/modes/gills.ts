import { mulberry32, TAU } from '../random.ts'
import type { FieldMode } from '../types.ts'

const DEG = Math.PI / 180

export const gills: FieldMode = {
  id: 'gills',
  name: 'Gills',
  latin: 'lamellae',
  blurb:
    'The underside of a cap. Full gills run from stem to margin, and shorter lamellulae start partway out in tiers to fill the widening gaps.',
  outline: true,
  ignores: ['interval'],
  params: [
    { key: 'gills', label: 'Gills', min: 6, max: 96, step: 1, value: 18 },
    { key: 'tiers', label: 'Lamellulae', min: 0, max: 3, step: 1, value: 2 },
    { key: 'cap', label: 'Cap', min: 0.4, max: 1.6, step: 0.01, value: 0.92 },
    { key: 'stipe', label: 'Stipe', min: 0.04, max: 0.4, step: 0.01, value: 0.13 },
    { key: 'swirl', label: 'Swirl', min: -1, max: 1, step: 0.01, value: 0 },
    { key: 'wave', label: 'Wave', min: 0, max: 1, step: 0.01, value: 0.2 },
    { key: 'squash', label: 'Tilt', min: 0, max: 0.6, step: 0.01, value: 0.1 },
    { key: 'spin', label: 'Rotate', min: 0, max: 360, step: 1, value: 0, dial: true, unit: '°' },
  ],
  build(p, { seed, spacing, cell }) {
    const rand = mulberry32(seed ^ 0x9111)
    const cx = (rand() - 0.5) * 0.5
    const cy = (rand() - 0.5) * 0.3
    const m1 = rand() * TAU
    const m2 = rand() * TAU
    const wavePhase = rand() * TAU
    const spin = p.spin * DEG
    const cosSpin = Math.cos(spin)
    const sinSpin = Math.sin(spin)
    const squash = 1 - p.squash
    const count = Math.round(p.gills)
    const stipe = Math.min(p.stipe, p.cap * 0.5)
    const scale = (count * spacing) / TAU
    // A tier of lamellulae starts once the gaps it splits are wide enough to hold
    // it, here 2.5 cells between neighbouring lines. Finer grids grow them sooner.
    const tierStarts = Array.from(
      { length: Math.round(p.tiers) },
      (_, k) => (2.5 * cell * count * 2 ** (k + 1)) / TAU,
    )

    return {
      period: count * spacing,
      sample(x, y, out) {
        const dx = x - cx
        const dy = y - cy
        const u = dx * cosSpin + dy * sinSpin
        const v = (-dx * sinSpin + dy * cosSpin) / squash
        const r = Math.hypot(u, v)
        let theta = Math.atan2(v, u)
        const rim = p.cap * (1 + 0.035 * Math.sin(3 * theta + m1) + 0.02 * Math.sin(7 * theta + m2))
        if (r > rim || r < stipe) {
          out.v = NaN
          return
        }
        const t = (r - stipe) / (rim - stipe)
        theta += p.swirl * t * 1.4 + p.wave * 0.04 * Math.sin(r * 34 + wavePhase)
        out.v = theta * scale
        let detail = 1
        for (const start of tierStarts) if (r > start) detail *= 2
        out.detail = detail
      },
    }
  },
}
