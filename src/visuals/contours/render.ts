import { fieldKey, gridSize } from './config.ts'
import { drifted } from './drift.ts'
import { MODES, modeDefaults } from './modes/index.ts'
import { colorsOf, css } from './palettes.ts'
import { createNoise, hash2, mulberry32 } from './random.ts'
import type { ContourConfig, Sample } from './types.ts'

export interface FieldGrid {
  cols: number
  rows: number
  /** (cols + 1) x (rows + 1) samples at cell corners. NaN is void. */
  values: Float32Array
  region: Uint8Array
  detail: Uint8Array
  /** cols x rows, sampled at cell centres. */
  ink: Float32Array | null
  period: number
  outline: boolean
  spacing: number
  lo: number
  hi: number
}

const fieldCache = new Map<string, FieldGrid>()

export function sampleField(config: ContourConfig): FieldGrid {
  const key = fieldKey(config)
  const cached = fieldCache.get(key)
  if (cached) return cached

  const { cols, rows } = gridSize(config)
  const cell = 2 / rows
  const halfWidth = (cols * cell) / 2
  const spacing = config.interval * cell
  const mode = MODES[config.mode]
  const field = mode.build(
    { ...modeDefaults(mode), ...config.modes[config.mode] },
    { seed: config.seed, halfWidth, spacing, cell },
  )
  const soil = createNoise(mulberry32(config.seed ^ 0x51a7))
  const warp = config.warp * 0.3
  const scale = config.warpScale

  const s: Sample = { v: 0, region: 0, detail: 1, ink: 0 }
  const at = (i: number, j: number) => {
    let x = (-halfWidth + i * cell) / config.zoom + config.panX
    let y = (-1 + j * cell) / config.zoom + config.panY
    if (warp > 0) {
      const wx = soil.fbm(x * scale + 3.1, y * scale - 1.7, 3)
      const wy = soil.fbm(x * scale - 6.3, y * scale + 4.9, 3)
      x += warp * wx
      y += warp * wy
    }
    s.v = NaN
    s.region = 0
    s.detail = 1
    s.ink = 0
    field.sample(x, y, s)
  }

  const stride = cols + 1
  const size = stride * (rows + 1)
  const values = new Float32Array(size)
  const region = new Uint8Array(size)
  const detail = new Uint8Array(size)
  let lo = Infinity
  let hi = -Infinity
  for (let j = 0; j <= rows; j++) {
    for (let i = 0; i <= cols; i++) {
      at(i, j)
      const k = j * stride + i
      values[k] = s.v
      region[k] = s.region
      detail[k] = s.detail
      if (s.v < lo) lo = s.v
      if (s.v > hi) hi = s.v
    }
  }

  let ink: Float32Array | null = null
  if (field.ink) {
    ink = new Float32Array(cols * rows)
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        at(i + 0.5, j + 0.5)
        ink[j * cols + i] = s.ink
      }
    }
  }

  const grid: FieldGrid = {
    cols,
    rows,
    values,
    region,
    detail,
    ink,
    period: field.period ?? 0,
    outline: mode.outline ?? false,
    spacing,
    lo: Number.isFinite(lo) ? lo : 0,
    hi: Number.isFinite(hi) ? hi : 0,
  }
  fieldCache.set(key, grid)
  if (fieldCache.size > 24) fieldCache.delete(fieldCache.keys().next().value!)
  return grid
}

export interface Shaded {
  cols: number
  rows: number
  /** Every cell as it should look, ghost and tint included. */
  cells: Uint8ClampedArray<ArrayBuffer>
  /** Only the light the lines give off, for the glow pass. */
  emit: Uint8ClampedArray<ArrayBuffer>
  bg: string
}

const cover = (distance: number, half: number, feather: number) =>
  distance <= half ? 1 : feather > 0 ? Math.max(0, 1 - (distance - half) / feather) : 0

/**
 * A cell lights when a contour passes within `weight / 2` cells of its centre.
 * Distance is the level offset divided by the local gradient, so lines stay
 * the same thickness however steep the field gets, and turn solid where
 * levels pack tighter than the grid, like cliffs on a survey map.
 */
export function shade(field: FieldGrid, config: ContourConfig, time = 0): Shaded {
  const { cols, rows, values, region, detail, ink, period, outline, spacing } = field
  const colors = colorsOf(config.palette, config.hue)
  const [bgR, bgG, bgB] = colors.bg
  const [lnR, lnG, lnB] = colors.line
  const [acR, acG, acB] = colors.accent

  const every = Math.max(1, Math.round(config.indexEvery))
  const phase = config.phase * every + config.flow * time
  // Lines never grow wide enough to swallow the gap to their neighbours.
  const half = Math.min(config.weight / 2, config.interval * 0.3)
  const halfIndex = Math.min((config.weight * config.indexWeight) / 2, config.interval * 0.4)
  const feather = Math.min(config.feather, Math.max(0, config.interval * 0.5 - half))
  const bandLo = Math.floor(field.lo / spacing - phase)
  const bandSpan = Math.max(1, Math.floor(field.hi / spacing - phase) - bandLo)
  const wrap = (d: number) => (period > 0 ? d - period * Math.round(d / period) : d)

  const cells = new Uint8ClampedArray(cols * rows * 4)
  const emit = new Uint8ClampedArray(cols * rows * 4)
  const stride = cols + 1

  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const k0 = j * stride + i
      const k1 = k0 + 1
      const k2 = k0 + stride
      const k3 = k2 + 1
      const a = values[k0]
      let b = values[k1]
      let c = values[k2]
      let d = values[k3]
      const voids = +Number.isNaN(a) + +Number.isNaN(b) + +Number.isNaN(c) + +Number.isNaN(d)

      let line = 0
      let accent = 0
      let fill = 0
      if (voids > 0) {
        if (voids < 4 && outline) accent = 1
      } else if (region[k0] !== region[k1] || region[k0] !== region[k2] || region[k0] !== region[k3]) {
        accent = 1
      } else {
        b = a + wrap(b - a)
        c = a + wrap(c - a)
        d = a + wrap(d - a)
        const levelsPerCell = Math.hypot((b + d - a - c) / 2, (c + d - a - b) / 2) / spacing
        const u = (a + b + c + d) / 4 / spacing - phase
        if (levelsPerCell > 1e-6) {
          const toIndex = Math.abs(u - every * Math.round(u / every))
          accent = cover(toIndex / levelsPerCell, halfIndex, feather)
          const m = Math.min(detail[k0], detail[k1], detail[k2], detail[k3])
          const um = u * m
          const nearest = Math.round(um)
          line = cover(Math.abs(um - nearest) / (levelsPerCell * m), half, feather)
          if (m > 1 && nearest % m !== 0) line *= 0.7
        }
        if (config.tint > 0) {
          const band = (Math.floor(u) - bandLo) / bandSpan
          const t = config.tintStyle === 'bands' ? (Math.floor(u) & 1) : config.tintStyle === 'fall' ? 1 - band : band
          fill = Math.min(1, Math.max(0, t)) * config.tint
        }
      }

      if (ink && ink[j * cols + i] > accent) accent = ink[j * cols + i]

      const even = 1 - config.grain * hash2(i, j, config.seed)
      const lit = Math.max(0, line - accent) * even
      const hot = accent * even
      const base = config.ghost + fill
      const o = (j * cols + i) * 4
      emit[o] = lnR * lit + acR * hot
      emit[o + 1] = lnG * lit + acG * hot
      emit[o + 2] = lnB * lit + acB * hot
      emit[o + 3] = 255
      cells[o] = bgR + lnR * base + emit[o]
      cells[o + 1] = bgG + lnG * base + emit[o + 1]
      cells[o + 2] = bgB + lnB * base + emit[o + 2]
      cells[o + 3] = 255
    }
  }

  return { cols, rows, cells, emit, bg: css(colors.bg) }
}

const scratch = new Map<string, CanvasRenderingContext2D>()

function scratchContext(name: string, width: number, height: number) {
  let ctx = scratch.get(name)
  if (!ctx) {
    ctx = document.createElement('canvas').getContext('2d')!
    scratch.set(name, ctx)
  }
  if (ctx.canvas.width !== width || ctx.canvas.height !== height) {
    ctx.canvas.width = width
    ctx.canvas.height = height
  }
  return ctx
}

/** Integer cell sizes only, so every LED and every gap is the same number of pixels. */
export function paint(ctx: CanvasRenderingContext2D, shaded: Shaded, config: ContourConfig, width: number, height: number) {
  const { cols, rows } = shaded
  const cellPx = Math.max(1, Math.floor(Math.min(width / cols, height / rows)))
  const gridW = cellPx * cols
  const gridH = cellPx * rows
  const ox = Math.floor((width - gridW) / 2)
  const oy = Math.floor((height - gridH) / 2)

  ctx.save()
  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = 1
  ctx.fillStyle = shaded.bg
  ctx.fillRect(0, 0, width, height)

  const cells = scratchContext('cells', cols, rows)
  cells.putImageData(new ImageData(shaded.cells, cols, rows), 0, 0)
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(cells.canvas, ox, oy, gridW, gridH)

  // Whole pixels of gap, plus one partly covered pixel, so the pitch can change smoothly.
  const gap = cellPx * config.gap
  const solid = Math.floor(gap)
  const soft = gap - solid
  const lead = Math.floor(solid / 2)
  if (solid > 0) {
    for (let i = 0; i <= cols; i++) ctx.fillRect(ox + i * cellPx - lead, oy, solid, gridH)
    for (let j = 0; j <= rows; j++) ctx.fillRect(ox, oy + j * cellPx - lead, gridW, solid)
  }
  if (soft > 0.02) {
    ctx.globalAlpha = soft
    for (let i = 0; i <= cols; i++) ctx.fillRect(ox + i * cellPx - lead + solid, oy, 1, gridH)
    for (let j = 0; j <= rows; j++) ctx.fillRect(ox, oy + j * cellPx - lead + solid, gridW, 1)
    ctx.globalAlpha = 1
  }

  if (config.glow > 0) {
    const emit = scratchContext('emit', cols, rows)
    emit.putImageData(new ImageData(shaded.emit, cols, rows), 0, 0)
    // Halve twice for a wide bloom; each halving averages, so nothing aliases.
    const w2 = Math.ceil(cols / 2)
    const h2 = Math.ceil(rows / 2)
    const w4 = Math.ceil(cols / 4)
    const h4 = Math.ceil(rows / 4)
    const half = scratchContext('emit-2', w2, h2)
    const quarter = scratchContext('emit-4', w4, h4)
    half.imageSmoothingEnabled = true
    quarter.imageSmoothingEnabled = true
    half.clearRect(0, 0, w2, h2)
    half.drawImage(emit.canvas, 0, 0, cols / 2, rows / 2)
    quarter.clearRect(0, 0, w4, h4)
    quarter.drawImage(half.canvas, 0, 0, w2 / 2, h2 / 2)

    ctx.globalCompositeOperation = 'lighter'
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.globalAlpha = config.glow * 0.55
    ctx.drawImage(emit.canvas, ox, oy, gridW, gridH)
    ctx.globalAlpha = config.glow * 0.75
    ctx.drawImage(quarter.canvas, ox, oy, w4 * 4 * cellPx, h4 * 4 * cellPx)
  }
  ctx.restore()
}

/** The frame `time` seconds after the config's own moment: drifting knobs moved, contours flowed. */
export function renderContours(
  ctx: CanvasRenderingContext2D,
  config: ContourConfig,
  width: number,
  height: number,
  time = 0,
) {
  const live = drifted(config, time)
  paint(ctx, shade(sampleField(live), live, time), live, width, height)
}

/** A canvas exactly the size of the grid, its long side close to `longSide` pixels. */
export function renderToCanvas(config: ContourConfig, longSide = 3840) {
  const { cols, rows } = gridSize(config)
  const cellPx = Math.max(1, Math.round(longSide / Math.max(cols, rows)))
  const canvas = document.createElement('canvas')
  canvas.width = cols * cellPx
  canvas.height = rows * cellPx
  renderContours(canvas.getContext('2d')!, config, canvas.width, canvas.height)
  return canvas
}
