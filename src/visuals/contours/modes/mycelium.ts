import { bucketGrid, mulberry32, TAU, wrapAngle } from '../random.ts'
import type { FieldMode } from '../types.ts'

const MAX_INOCULA = 6
const STEP = 0.016
const SENSE = 0.07
const MAX_SEGMENTS = 3000
const LIFE = 200
const ROUNDS = LIFE * 2
/** Growth steps merged into one segment for the distance field. */
const RUN = 4

interface Tip {
  x: number
  y: number
  angle: number
  order: number
  life: number
  age: number
  id: number
  parent: number
  originX: number
  originY: number
  runX: number
  runY: number
  run: number
  runFrom: number
}

class Segments {
  ax: number[] = []
  ay: number[] = []
  bx: number[] = []
  by: number[] = []
  /** Relative thickness: thinner for later branch orders and younger growth. */
  girth: number[] = []
  owner: number[] = []
  /** Growth rounds over which the segment was laid down. */
  from: number[] = []
  to: number[] = []

  add(x0: number, y0: number, x1: number, y1: number, girth: number, owner: number, from: number, to: number) {
    this.ax.push(x0)
    this.ay.push(y0)
    this.bx.push(x1)
    this.by.push(y1)
    this.girth.push(girth)
    this.owner.push(owner)
    this.from.push(from)
    this.to.push(to)
    return this.ax.length - 1
  }

  /** Where along segment s the closest point to (x, y) is, from 0 to 1. */
  project(s: number, x: number, y: number) {
    const dx = this.bx[s] - this.ax[s]
    const dy = this.by[s] - this.ay[s]
    const len2 = dx * dx + dy * dy
    return len2 > 0 ? Math.max(0, Math.min(1, ((x - this.ax[s]) * dx + (y - this.ay[s]) * dy) / len2)) : 0
  }

  distance(s: number, x: number, y: number, t: number) {
    return Math.hypot(x - this.ax[s] - (this.bx[s] - this.ax[s]) * t, y - this.ay[s] - (this.by[s] - this.ay[s]) * t)
  }
}

interface Growth {
  network: Segments
  boundX: number
  boundY: number
}

const grown = new Map<string, Growth>()

/**
 * Grows the whole colony once. Reach and cord only reveal and thicken it, so
 * turning them plays the growth back instead of growing a different colony.
 */
function grow(seed: number, halfWidth: number, cell: number, p: Record<string, number>): Growth {
  const key = JSON.stringify([seed, halfWidth, cell, p.inocula, p.branching, p.wander, p.fusion])
  const cached = grown.get(key)
  if (cached) return cached

  const rand = mulberry32(seed ^ 0x3c3e)
  const boundX = halfWidth + 0.15
  const boundY = 1.15
  const fine = new Segments()
  const network = new Segments()
  const growing = bucketGrid(SENSE, boundX, boundY)
  const parentOf: number[] = []
  let round = 0

  const girthOf = (tip: Tip) => 0.6 ** tip.order * (0.45 + (0.55 * tip.life) / LIFE)
  const settle = (tip: Tip, x: number, y: number) => {
    if (tip.run === 0) return
    network.add(tip.runX, tip.runY, x, y, girthOf(tip), tip.id, tip.runFrom, round + 1)
    tip.runX = x
    tip.runY = y
    tip.run = 0
    tip.runFrom = round + 1
  }
  const extend = (tip: Tip, x: number, y: number) => {
    const s = fine.add(tip.x, tip.y, x, y, 0, tip.id, round, round + 1)
    growing.insert(s, (tip.x + x) / 2, (tip.y + y) / 2, (tip.x + x) / 2, (tip.y + y) / 2)
    tip.run++
    if (tip.run >= RUN) settle(tip, x, y)
  }

  let tips: Tip[] = []
  const count = Math.round(p.inocula)
  for (let i = 0; i < MAX_INOCULA; i++) {
    const r = [rand(), rand(), rand(), rand()]
    if (i >= count) continue
    const originX = (r[0] * 2 - 1) * halfWidth * 0.65
    const originY = (r[1] * 2 - 1) * 0.65
    const arms = 3 + Math.floor(r[2] * 3)
    for (let k = 0; k < arms; k++) {
      parentOf.push(-1)
      tips.push({
        x: originX,
        y: originY,
        angle: r[3] * TAU + (k * TAU) / arms,
        order: 0,
        life: LIFE,
        age: 0,
        id: parentOf.length - 1,
        parent: -1,
        originX,
        originY,
        runX: originX,
        runY: originY,
        run: 0,
        runFrom: 0,
      })
    }
  }

  // The closest point on a hypha from another lineage, if the tip can sense one.
  const sense = (tip: Tip) => {
    let best = SENSE
    let hitX = NaN
    let hitY = NaN
    growing.visit(tip.x, tip.y, (s) => {
      const o = fine.owner[s]
      if (o === tip.id || parentOf[o] === tip.id || (o === tip.parent && tip.age < 12)) return
      const t = fine.project(s, tip.x, tip.y)
      const d = fine.distance(s, tip.x, tip.y, t)
      if (d < best) {
        best = d
        hitX = fine.ax[s] + (fine.bx[s] - fine.ax[s]) * t
        hitY = fine.ay[s] + (fine.by[s] - fine.ay[s]) * t
      }
    })
    return Number.isNaN(hitX) ? null : { x: hitX, y: hitY, d: best }
  }

  for (; tips.length && fine.ax.length < MAX_SEGMENTS && round < ROUNDS; round++) {
    const next: Tip[] = []
    for (const tip of tips) {
      // Tips wander, and lean away from their own colony.
      const fromOrigin = Math.atan2(tip.y - tip.originY, tip.x - tip.originX)
      const pull = tip.age > 2 ? wrapAngle(fromOrigin - tip.angle) * 0.03 : 0
      tip.angle += (rand() - 0.5) * p.wander * 0.9 + pull
      // Low fusion: tips turn away from hyphae they sense. High fusion: they join on contact.
      const near = tip.age > 4 ? sense(tip) : null
      if (near && near.d < cell && rand() < p.fusion) {
        extend(tip, near.x, near.y)
        settle(tip, near.x, near.y)
        continue
      }
      if (near) {
        const away = Math.atan2(tip.y - near.y, tip.x - near.x)
        tip.angle += wrapAngle(away - tip.angle) * (1 - near.d / SENSE) * 0.4 * (1 - p.fusion * 0.7)
      }
      const nx = tip.x + Math.cos(tip.angle) * STEP
      const ny = tip.y + Math.sin(tip.angle) * STEP
      if (Math.abs(nx) > boundX || Math.abs(ny) > boundY) {
        settle(tip, tip.x, tip.y)
        continue
      }

      extend(tip, nx, ny)
      tip.x = nx
      tip.y = ny
      tip.life--
      tip.age++
      if (tip.life <= 0) {
        settle(tip, nx, ny)
        continue
      }

      if (tip.order < 6 && rand() < p.branching * 0.03) {
        const side = rand() < 0.5 ? -1 : 1
        parentOf.push(tip.id)
        next.push({
          ...tip,
          angle: tip.angle + side * (0.4 + rand() * 0.5),
          order: tip.order + 1,
          life: Math.floor(tip.life * 0.75),
          age: 0,
          id: parentOf.length - 1,
          parent: tip.id,
          runX: nx,
          runY: ny,
          run: 0,
          runFrom: round + 1,
        })
      }
      next.push(tip)
    }
    tips = next
  }
  for (const tip of tips) settle(tip, tip.x, tip.y)

  const growth = { network, boundX, boundY }
  grown.set(key, growth)
  if (grown.size > 8) grown.delete(grown.keys().next().value!)
  return growth
}

export const mycelium: FieldMode = {
  id: 'mycelium',
  name: 'Mycelium',
  latin: 'hyphal network',
  blurb:
    'Hyphae grow at their tips and branch at sharp angles. They either steer away from each other or fuse where they touch. Older cords thicken into rhizomorphs, and the contours echo around the network.',
  params: [
    { key: 'inocula', label: 'Inocula', min: 1, max: MAX_INOCULA, step: 1, value: 2 },
    { key: 'reach', label: 'Reach', min: 0.2, max: 1, step: 0.01, value: 0.7 },
    { key: 'branching', label: 'Branching', min: 0, max: 1, step: 0.01, value: 0.45, still: true },
    { key: 'wander', label: 'Wander', min: 0, max: 1, step: 0.01, value: 0.4, still: true },
    { key: 'fusion', label: 'Fusion', min: 0, max: 1, step: 0.01, value: 0.6, still: true },
    { key: 'cord', label: 'Cord', min: 0, max: 1, step: 0.01, value: 0.5 },
    { key: 'halo', label: 'Halo', min: 0, max: 8, step: 1, value: 2 },
  ],
  build(p, { seed, halfWidth, spacing, cell }) {
    const { network, boundX, boundY } = grow(seed, halfWidth, cell, p)
    // Reach is how many growth rounds have played out.
    const until = 20 + p.reach * (ROUNDS - 20)
    const cord = p.cord * 0.035
    // Even the finest hypha covers the cell it passes through.
    const hair = cell * 0.55
    const reach = Math.round(p.halo) * spacing

    const shown = new Segments()
    for (let s = 0; s < network.ax.length; s++) {
      const from = network.from[s]
      const to = network.to[s]
      if (from >= until) continue
      const t = Math.min(1, (until - from) / (to - from))
      shown.add(
        network.ax[s],
        network.ay[s],
        network.ax[s] + (network.bx[s] - network.ax[s]) * t,
        network.ay[s] + (network.by[s] - network.ay[s]) * t,
        network.girth[s] * cord,
        0,
        from,
        to,
      )
    }

    const near = bucketGrid(Math.max(cell * 1.5, (reach + cord + hair) / 6), boundX + 0.3, boundY + 0.3)
    for (let s = 0; s < shown.ax.length; s++) {
      near.insert(
        s,
        Math.min(shown.ax[s], shown.bx[s]),
        Math.min(shown.ay[s], shown.by[s]),
        Math.max(shown.ax[s], shown.bx[s]),
        Math.max(shown.ay[s], shown.by[s]),
      )
    }

    let px = 0
    let py = 0
    let closest = 0
    const measure = (s: number) => {
      const d = shown.distance(s, px, py, shown.project(s, px, py)) - shown.girth[s] - hair
      if (d < closest) closest = d
    }
    // Nothing further than d can beat the current closest, even the thickest cord.
    const settled = (d: number) => closest <= d - cord - hair

    return {
      ink: true,
      sample(x, y, out) {
        px = x
        py = y
        closest = reach
        near.spiral(x, y, reach + cord + hair, measure, settled)
        out.ink = closest < 0 ? 1 : 0
        // Half a level off the cord surface, so the first halo line sits clear of
        // the hypha. Flat inside the cords and once the halo runs out.
        out.v = -Math.max(0, closest) - spacing / 2
      },
    }
  },
}
