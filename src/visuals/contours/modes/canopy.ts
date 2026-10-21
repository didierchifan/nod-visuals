import { bucketGrid, createNoise, mulberry32 } from '../random.ts'
import type { FieldMode } from '../types.ts'

export const canopy: FieldMode = {
  id: 'canopy',
  name: 'Canopy',
  latin: 'crown shyness',
  blurb:
    'A forest seen from above as a LiDAR canopy height model. Crowns keep a gap between each other. With no trees you get the bare forest floor.',
  params: [
    { key: 'trees', label: 'Trees', min: 0, max: 200, step: 1, value: 46 },
    { key: 'shyness', label: 'Shyness', min: 0, max: 1, step: 0.01, value: 0.35 },
    { key: 'variance', label: 'Variance', min: 0, max: 1, step: 0.01, value: 0.5 },
    { key: 'conifer', label: 'Conifer', min: 0, max: 1, step: 0.01, value: 0.3 },
    { key: 'height', label: 'Height', min: 0.3, max: 2, step: 0.01, value: 1 },
    { key: 'terrain', label: 'Terrain', min: 0, max: 1, step: 0.01, value: 0.35 },
  ],
  build(p, { seed, halfWidth }) {
    const rand = mulberry32(seed ^ 0xca70)
    const ground = createNoise(mulberry32(seed ^ 0x6e0d))
    const count = Math.round(p.trees)
    const extentX = halfWidth + 0.15
    const extentY = 1.15
    const pitch = Math.sqrt((4 * extentX * extentY) / Math.max(count, 1))

    // Trees are placed at a fixed spread and only then sized, so variance,
    // shyness and height grow and shrink crowns without moving any tree.
    const trees: { x: number; y: number; r: number; h: number }[] = []
    const room: number[] = []
    for (let attempt = 0; attempt < count * 40 && trees.length < count; attempt++) {
      const x = (rand() * 2 - 1) * extentX
      const y = (rand() * 2 - 1) * extentY
      const size = rand()
      const place = pitch * 0.62 * (1 - 0.35 * size)
      const crowded = trees.some((t, i) => Math.hypot(t.x - x, t.y - y) < (room[i] + place) * 0.8)
      if (crowded) continue
      const r = pitch * 0.62 * (1 - p.variance * 0.7 * size)
      room.push(place)
      trees.push({ x, y, r: r * (1 - p.shyness * 0.4), h: r * p.height * (2 + rand()) })
    }

    const crowns = bucketGrid(Math.max(pitch * 0.62, 0.02), extentX + 0.5, extentY + 0.5)
    trees.forEach((t, i) => crowns.insert(i, t.x - t.r, t.y - t.r, t.x + t.r, t.y + t.r))

    let px = 0
    let py = 0
    let top = 0
    const measure = (i: number) => {
      const t = trees[i]
      const q = Math.hypot(px - t.x, py - t.y) / t.r
      if (q >= 1) return
      const profile = (1 - p.conifer) * Math.sqrt(1 - q * q) + p.conifer * (1 - q)
      if (t.h * profile > top) top = t.h * profile
    }

    return {
      sample(x, y, out) {
        px = x
        py = y
        top = 0
        crowns.visit(x, y, measure)
        out.v = p.terrain * 1.2 * ground.fbm(x * 0.8, y * 0.8, 4) + top
      },
    }
  },
}
