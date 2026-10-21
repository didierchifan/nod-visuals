import { drifts, DRIFT_GROUPS, fieldKnob, GLOBAL_PARAMS, type Section } from './config.ts'
import { MODES } from './modes/index.ts'
import { hash2 } from './random.ts'
import type { ContourConfig, DriftGroup, GlobalKey, ParamSpec } from './types.ts'

const GROUP_OF: Partial<Record<Section, DriftGroup>> = {
  light: 'light',
  contours: 'contours',
  grid: 'grid',
  soil: 'soil',
}

export const isDrifting = (config: ContourConfig) => config.tempo > 0 && DRIFT_GROUPS.some((g) => config.drift[g])

/** Whether the picture changes over time at all. */
export const isMoving = (config: ContourConfig) => config.flow !== 0 || isDrifting(config)

interface DriftingKnob {
  id: string
  spec: ParamSpec
  /** Seeds this knob's own speed and direction. */
  lane: number
  read(c: ContourConfig): number
  write(c: ContourConfig, v: number): void
}

/** The knobs that travel right now: in a drifting section, able to glide, and not marked DNA. */
function driftingKnobs(config: ContourConfig): DriftingKnob[] {
  const held = new Set(config.held)
  const knobs: DriftingKnob[] = []
  GLOBAL_PARAMS.forEach((spec, i) => {
    const group = GROUP_OF[spec.section]
    if (!group || !config.drift[group] || !drifts(spec) || held.has(spec.key)) return
    const key: GlobalKey = spec.key
    knobs.push({ id: key, spec, lane: i, read: (c) => c[key], write: (c, v) => (c[key] = v) })
  })
  if (config.drift.field) {
    const mode = config.mode
    MODES[mode].params.forEach((spec, i) => {
      const id = fieldKnob(mode, spec.key)
      if (!drifts(spec) || held.has(id)) return
      knobs.push({
        id,
        spec,
        lane: 100 + i,
        read: (c) => c.modes[mode][spec.key] ?? spec.value,
        write: (c, v) => (c.modes[mode][spec.key] = v),
      })
    })
  }
  return knobs
}

// A triangle wave with rounded corners: constant speed, gentle turns at the ends.
const BEND = 0.985
const BEND_ASIN = Math.asin(BEND)
const sweep = (theta: number) => Math.asin(BEND * Math.sin(theta)) / BEND_ASIN
const unsweep = (y: number, rising: boolean) => {
  const theta = Math.asin(Math.sin(y * BEND_ASIN) / BEND)
  return rising ? theta : Math.PI - theta
}

/**
 * Dials turn forever in one direction. Bounded knobs travel steadily across a
 * window of the knob's range and turn round only at its ends. Either way the
 * knob starts exactly where it was (`m.c` at clock `m.t`).
 */
function travel(knob: DriftingKnob, m: { c: number; t: number }, clock: number, range: number, seed: number) {
  const { spec } = knob
  const span = spec.max - spec.min
  // Knobs that move the whole picture travel slower.
  const speed = (0.7 + 0.6 * hash2(knob.lane, 1, seed)) * (spec.sway ?? 1)
  const direction = hash2(knob.lane, 2, seed) < 0.5 ? -1 : 1
  const elapsed = clock - m.t

  if (spec.dial) {
    const v = m.c + direction * speed * span * 0.125 * elapsed
    return spec.min + ((((v - spec.min) % span) + span) % span)
  }

  // Same travel speed as a dial, so a wider window just means longer, rarer turns.
  const half = Math.min(span / 2, range * span * 0.5)
  const centre = Math.min(spec.max - half, Math.max(spec.min + half, m.c))
  const start = unsweep(Math.max(-1, Math.min(1, (m.c - centre) / half)), direction > 0)
  const rate = (speed * span * 0.125 * Math.PI) / (2 * half)
  return centre + half * sweep(start + rate * elapsed)
}

const cloneForWrite = (config: ContourConfig): ContourConfig => ({
  ...config,
  modes: { ...config.modes, [config.mode]: { ...config.modes[config.mode] } },
})

/** The config as it stands `seconds` after its own moment. */
export function drifted(config: ContourConfig, seconds: number): ContourConfig {
  if (!isDrifting(config)) return config
  const clock = config.driftClock + config.tempo * seconds
  const out = cloneForWrite(config)
  for (const knob of driftingKnobs(config)) {
    const m = config.motion[knob.id] ?? { c: knob.read(config), t: config.driftClock }
    knob.write(out, travel(knob, m, clock, config.range, config.seed))
  }
  return out
}

const round = (v: number) => Number(v.toFixed(4))

/**
 * Bakes everything time has moved into the config, so it renders this exact
 * frame at time zero and keeps travelling the same way afterwards. Knob values
 * show the frame; `motion` and the clock carry the travel on.
 */
export function freeze(config: ContourConfig, seconds: number): ContourConfig {
  if (!isMoving(config)) return config
  const out = drifted(config, seconds)
  if (out === config) return { ...config, phase: advance(config, seconds) }
  for (const knob of driftingKnobs(config)) knob.write(out, round(knob.read(out)))
  out.phase = advance(config, seconds)
  out.driftClock = round(config.driftClock + config.tempo * seconds)
  return out
}

// Phase counts whole index cycles, so wrapping it never moves the index lines.
function advance(config: ContourConfig, seconds: number) {
  const phase = config.phase + (config.flow * seconds) / Math.max(1, Math.round(config.indexEvery))
  return round(phase - Math.floor(phase))
}

/**
 * Starts travel for knobs that just began drifting, from the value they show,
 * and drops it for knobs that stopped, which then keep the value they show.
 * Run on a frozen config, whose knob values are the frame on screen.
 */
export function syncMotion(config: ContourConfig): ContourConfig {
  const knobs = driftingKnobs(config)
  const motion: ContourConfig['motion'] = {}
  for (const knob of knobs) motion[knob.id] = config.motion[knob.id] ?? { c: knob.read(config), t: config.driftClock }
  return { ...config, motion }
}
