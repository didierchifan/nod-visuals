import { ASPECTS } from '../contours/config.ts'
import type { AspectId } from '../contours/types.ts'

/** Named as the leva panel in 3d-portfolio's raging-sea names them, so settings carry over both ways. */
export interface FluidConfig {
  color1: string
  color2: string
  uBigWavesElevation: number
  uBigWavesFrequencyX: number
  uBigWavesFrequencyY: number
  uBigWavesSpeed: number
  uSmallWavesElevation: number
  uSmallWavesFrequency: number
  uSmallWavesSpeed: number
  uSmallIterations: number
  uColorOffset: number
  uColorMultiplier: number
  /** The picture's shape. Not in the repo's panel; its canvas fills the window. */
  aspect: AspectId
  /** The camera's zoom, which the repo's page fixes at 0.25. */
  zoom: number
}

export type ColorKey = 'color1' | 'color2'
export type ParamKey = Exclude<keyof FluidConfig, ColorKey | 'aspect'>
export type Section = 'frame' | 'color' | 'big' | 'small'

export interface ParamSpec {
  section: Section
  key: ParamKey
  label: string
  min: number
  max: number
  step: number
}

/**
 * The repo's panel as last tuned. Its code starts Frequency Y at 1.5 and Speed at 0.75;
 * everything else matches.
 */
export const DEFAULT_CONFIG: FluidConfig = {
  color1: '#5c74c7',
  color2: '#0033ff',
  uBigWavesElevation: 0.2,
  uBigWavesFrequencyX: 4,
  uBigWavesFrequencyY: 8.05,
  uBigWavesSpeed: 2.13,
  uSmallWavesElevation: 0.15,
  uSmallWavesFrequency: 3,
  uSmallWavesSpeed: 0.2,
  uSmallIterations: 4,
  uColorOffset: 0.925,
  uColorMultiplier: 1,
  aspect: '16:9',
  zoom: 0.25,
}

export const COLORS: { key: ColorKey; label: string }[] = [
  { key: 'color1', label: 'Depth' },
  { key: 'color2', label: 'Surface' },
]

// Ranges and steps as the repo's leva panel sets them; Zoom is the lab's own.
export const PARAMS: ParamSpec[] = [
  { section: 'frame', key: 'zoom', label: 'Zoom', min: 0.1, max: 4, step: 0.01 },
  { section: 'color', key: 'uColorOffset', label: 'Offset', min: 0, max: 1, step: 0.001 },
  { section: 'color', key: 'uColorMultiplier', label: 'Multiplier', min: 0, max: 10, step: 0.001 },
  { section: 'big', key: 'uBigWavesElevation', label: 'Elevation', min: 0, max: 1, step: 0.001 },
  { section: 'big', key: 'uBigWavesFrequencyX', label: 'Frequency X', min: 0, max: 10, step: 0.001 },
  { section: 'big', key: 'uBigWavesFrequencyY', label: 'Frequency Y', min: 0, max: 10, step: 0.001 },
  { section: 'big', key: 'uBigWavesSpeed', label: 'Speed', min: 0, max: 4, step: 0.001 },
  { section: 'small', key: 'uSmallWavesElevation', label: 'Elevation', min: 0, max: 1, step: 0.001 },
  { section: 'small', key: 'uSmallWavesFrequency', label: 'Frequency', min: 0, max: 30, step: 0.001 },
  { section: 'small', key: 'uSmallWavesSpeed', label: 'Speed', min: 0, max: 4, step: 0.001 },
  { section: 'small', key: 'uSmallIterations', label: 'Iterations', min: 0, max: 5, step: 1 },
]

/** #rgb or #rrggbb, with or without the #, as lowercase #rrggbb. */
export function parseHex(text: string) {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(text.trim())
  if (!match) return null
  const digits = match[1].length === 3 ? [...match[1]].map((d) => d + d).join('') : match[1]
  return `#${digits.toLowerCase()}`
}

/** Whatever was stored or pasted, made safe; null when it holds none of our settings. */
export function normalizeConfig(raw: unknown): FluidConfig | null {
  if (!raw || typeof raw !== 'object') return null
  const input = raw as Record<string, unknown>
  if (!Object.keys(DEFAULT_CONFIG).some((key) => key in input)) return null

  const config = { ...DEFAULT_CONFIG }
  for (const { key } of COLORS) {
    const hex = typeof input[key] === 'string' ? parseHex(input[key]) : null
    if (hex) config[key] = hex
  }
  for (const { key, min, max } of PARAMS) {
    const v = input[key]
    if (typeof v === 'number' && Number.isFinite(v)) config[key] = Math.min(max, Math.max(min, v))
  }
  if (typeof input.aspect === 'string' && input.aspect in ASPECTS) config.aspect = input.aspect as AspectId
  return config
}
