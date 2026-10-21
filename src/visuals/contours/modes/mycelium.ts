import { bucketGrid, mulberry32, TAU, wrapAngle } from '../random.ts'
import type { FieldMode } from '../types.ts'

const MAX_INOCULA = 6
const STEP = 0.016
const SENSE = 0.07
const MAX_SEGMENTS = 3000
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
}

class Segments {
  ax: number[] = []
  ay: number[] = []
  bx: number[] = []
  by: number[] = []
  thick: number[] = []
  owner: number[] = []

  add(x0: number, y0: number, x1: number, y1: number, thick: number, owner: number) {
    this.ax.push(x0)
    this.ay.push(y0)
    this.bx.push(x1)
    this.by.push(y1)
    this.thick.push(thick)
    this.owner.push(owner)
    return this.ax.length - 1
  }

  /** Distance from (x, y) to segment s, and where along it the closest point is. */
  project(s: number, x: number, y: number) {
    const dx = this.bx[s] - this.ax[s]
    const dy = this.by[s] - this.ay[s]
    const len2 = dx * dx + dy * dy
    const t = len2 > 0 ? Math.max(0, Math.min(1, ((x - this.ax[s]) * dx + (y - this.ay[s]) * dy) / len2)) : 0
    return t
  }

  distance(s: number, x: number, y: number, t: number) {
    return Math.hypot(x - this.ax[s] - (this.bx[s] - this.ax[s]) * t, y - this.ay[s] - (this.by[s] - this.ay[s]) * t)
  }
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
    { key: 'branching', label: 'Branching', min: 0, max: 1, step: 0.01, value: 0.45 },
    { key: 'wander', label: 'Wander', min: 0, max: 1, step: 0.01, value: 0.4 },
    { key: 'fusion', label: 'Fusion', min: 0, max: 1, step: 0.01, value: 0.6 },
    { key: 'cord', label: 'Cord', min: 0, max: 1, step: 0.01, value: 0.5 },
    { key: 'halo', label: 'Halo', min: 0, max: 8, step: 1, value: 2 },
  ],
  build(p, { seed, halfWidth, spacing, cell }) {
    const rand = mulberry32(seed ^ 0x3c3e)
    const maxSteps = Math.round(40 + p.reach * 160)
    const cord = p.cord * 0.035
    // Even the finest hypha covers the cell it passes through.
    const hair = cell * 0.55

    const boundX = halfWidth + 0.15
    const boundY = 1.15
    const fine = new Segments()
    const coarse = new Segments()
    const growing = bucketGrid(SENSE, boundX, boundY)
    const parentOf: number[] = []

    const grow = (tip: Tip, x: number, y: number, w: number) => {
      const s = fine.add(tip.x, tip.y, x, y, w, tip.id)
      growing.insert(s, (tip.x + x) / 2, (tip.y + y) / 2, (tip.x + x) / 2, (tip.y + y) / 2)
      tip.run++
      if (tip.run >= RUN) settle(tip, x, y, w)
    }
    const settle = (tip: Tip, x: number, y: number, w: number) => {
      if (tip.run === 0) return
      coarse.add(tip.runX, tip.runY, x, y, w, tip.id)
      tip.runX = x
      tip.runY = y
      tip.run = 0
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
          life: maxSteps,
          age: 0,
          id: parentOf.length - 1,
          parent: -1,
          originX,
          originY,
          runX: originX,
          runY: originY,
          run: 0,
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

    for (let round = 0; tips.length && fine.ax.length < MAX_SEGMENTS && round < maxSteps * 2; round++) {
      const next: Tip[] = []
      for (const tip of tips) {
        const w = cord * 0.6 ** tip.order * (0.45 + (0.55 * tip.life) / maxSteps)
        // Tips wander, and lean away from their own colony.
        const fromOrigin = Math.atan2(tip.y - tip.originY, tip.x - tip.originX)
        const pull = tip.age > 2 ? wrapAngle(fromOrigin - tip.angle) * 0.03 : 0
        tip.angle += (rand() - 0.5) * p.wander * 0.9 + pull
        // Low fusion: tips turn away from hyphae they sense. High fusion: they join on contact.
        const near = tip.age > 4 ? sense(tip) : null
        if (near && near.d < cell && rand() < p.fusion) {
          grow(tip, near.x, near.y, w)
          settle(tip, near.x, near.y, w)
          continue
        }
        if (near) {
          const away = Math.atan2(tip.y - near.y, tip.x - near.x)
          tip.angle += wrapAngle(away - tip.angle) * (1 - near.d / SENSE) * 0.4 * (1 - p.fusion * 0.7)
        }
        const nx = tip.x + Math.cos(tip.angle) * STEP
        const ny = tip.y + Math.sin(tip.angle) * STEP
        if (Math.abs(nx) > boundX || Math.abs(ny) > boundY) {
          settle(tip, tip.x, tip.y, w)
          continue
        }

        grow(tip, nx, ny, w)
        tip.x = nx
        tip.y = ny
        tip.life--
        tip.age++
        if (tip.life <= 0) {
          settle(tip, nx, ny, w)
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
          })
        }
        next.push(tip)
      }
      tips = next
    }
    for (const tip of tips) settle(tip, tip.x, tip.y, cord * 0.6 ** tip.order * 0.45)

    const reach = Math.round(p.halo) * spacing
    const near = bucketGrid(Math.max(cell * 1.5, (reach + cord + hair) / 6), boundX + 0.3, boundY + 0.3)
    for (let s = 0; s < coarse.ax.length; s++) {
      near.insert(
        s,
        Math.min(coarse.ax[s], coarse.bx[s]),
        Math.min(coarse.ay[s], coarse.by[s]),
        Math.max(coarse.ax[s], coarse.bx[s]),
        Math.max(coarse.ay[s], coarse.by[s]),
      )
    }

    let px = 0
    let py = 0
    let closest = 0
    const measure = (s: number) => {
      const d = coarse.distance(s, px, py, coarse.project(s, px, py)) - coarse.thick[s] - hair
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
