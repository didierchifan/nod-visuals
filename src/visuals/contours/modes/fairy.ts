import { createNoise, mulberry32, TAU, wrapAngle } from '../random.ts'
import type { FieldMode } from '../types.ts'

const MAX_COLONIES = 12

export const fairy: FieldMode = {
  id: 'fairy',
  name: 'Fairy Ring',
  latin: 'Marasmius oreades',
  blurb:
    'Mycelium spreads out from each spore. Where two fronts meet they cancel instead of crossing, and some colonies curl into rotors.',
  params: [
    { key: 'colonies', label: 'Colonies', min: 1, max: MAX_COLONIES, step: 1, value: 5 },
    { key: 'scatter', label: 'Scatter', min: 0, max: 1, step: 0.01, value: 0.75 },
    { key: 'age', label: 'Age spread', min: 0, max: 1, step: 0.01, value: 0.5 },
    { key: 'rotors', label: 'Rotors', min: 0, max: 1, step: 0.01, value: 0.25 },
    { key: 'arms', label: 'Arms', min: 1, max: 4, step: 1, value: 1 },
    { key: 'patchy', label: 'Dead soil', min: 0, max: 0.8, step: 0.01, value: 0.15 },
  ],
  build(p, { seed, halfWidth, spacing }) {
    const rand = mulberry32(seed ^ 0xfa1e)
    const soil = createNoise(mulberry32(seed ^ 0x5011))
    const count = Math.round(p.colonies)
    const xs: number[] = []
    const ys: number[] = []
    const ages: number[] = []
    const twists: number[] = []
    const turns: number[] = []

    // Every colony draws the same numbers whether it is used or not,
    // so adding one never moves the others.
    for (let i = 0; i < MAX_COLONIES; i++) {
      const r = [rand(), rand(), rand(), rand(), rand(), rand()]
      if (i >= count) continue
      xs.push((r[0] * 2 - 1) * halfWidth * 0.9 * p.scatter)
      ys.push((r[1] * 2 - 1) * 0.9 * p.scatter)
      ages.push(r[2] * p.age * 1.1)
      twists.push(r[3] < p.rotors ? ((r[4] < 0.5 ? 1 : -1) * p.arms * spacing) / TAU : 0)
      turns.push(r[5] * TAU)
    }

    const dead = p.patchy > 0 ? -0.5 + p.patchy * 0.8 : -Infinity
    const spirals = twists.some((t) => t !== 0)

    return {
      period: spirals ? Math.round(p.arms) * spacing : 0,
      sample(x, y, out) {
        if (soil.fbm(x * 1.3, y * 1.3, 3) < dead) {
          out.v = NaN
          return
        }
        let front = Infinity
        for (let i = 0; i < xs.length; i++) {
          const dx = x - xs[i]
          const dy = y - ys[i]
          let v = Math.hypot(dx, dy) - ages[i]
          if (twists[i] !== 0) v += twists[i] * wrapAngle(Math.atan2(dy, dx) + turns[i])
          if (v < front) front = v
        }
        out.v = front
      },
    }
  },
}
