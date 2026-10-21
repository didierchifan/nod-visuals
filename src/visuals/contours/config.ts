import { MODE_IDS, MODES, modeDefaults } from './modes/index.ts'
import { PALETTES } from './palettes.ts'
import type { AspectId, ContourConfig, GlobalKey, ModeId, ParamSpec, TintStyle } from './types.ts'

export const ASPECTS: Record<AspectId, number> = {
  '16:9': 16 / 9,
  '4:3': 4 / 3,
  '1:1': 1,
  '4:5': 4 / 5,
  '9:16': 9 / 16,
}

export const TINT_STYLES: TintStyle[] = ['rise', 'fall', 'bands']

export type Section = 'grid' | 'contours' | 'soil' | 'light'

export const GLOBAL_PARAMS: (ParamSpec<GlobalKey> & { section: Section })[] = [
  { section: 'grid', key: 'cols', label: 'Cells', min: 32, max: 220, step: 1, value: 128 },
  { section: 'grid', key: 'gap', label: 'Pitch gap', min: 0, max: 0.45, step: 0.01, value: 0.16 },
  { section: 'contours', key: 'interval', label: 'Interval', min: 2, max: 16, step: 0.1, value: 5 },
  { section: 'contours', key: 'weight', label: 'Weight', min: 0.6, max: 3, step: 0.05, value: 1 },
  { section: 'contours', key: 'feather', label: 'Feather', min: 0, max: 1.5, step: 0.05, value: 0.35 },
  { section: 'contours', key: 'indexEvery', label: 'Index every', min: 2, max: 10, step: 1, value: 5 },
  { section: 'contours', key: 'indexWeight', label: 'Index weight', min: 1, max: 3, step: 0.05, value: 1.6 },
  { section: 'contours', key: 'phase', label: 'Phase', min: 0, max: 1, step: 0.01, value: 0, dial: true },
  { section: 'contours', key: 'flow', label: 'Flow', min: -1, max: 1, step: 0.01, value: 0 },
  { section: 'soil', key: 'warp', label: 'Warp', min: 0, max: 1, step: 0.01, value: 0.3 },
  { section: 'soil', key: 'warpScale', label: 'Grain size', min: 0.3, max: 4, step: 0.05, value: 1.4 },
  { section: 'light', key: 'ghost', label: 'Ghost', min: 0, max: 0.25, step: 0.01, value: 0.05 },
  { section: 'light', key: 'tint', label: 'Tint', min: 0, max: 0.6, step: 0.01, value: 0.08 },
  { section: 'light', key: 'glow', label: 'Glow', min: 0, max: 1, step: 0.01, value: 0.45 },
  { section: 'light', key: 'grain', label: 'Unevenness', min: 0, max: 0.6, step: 0.01, value: 0.15 },
]

const globals = Object.fromEntries(GLOBAL_PARAMS.map((spec) => [spec.key, spec.value])) as Record<GlobalKey, number>

export const DEFAULT_CONFIG: ContourConfig = {
  version: 1,
  seed: 0x2f6b1d4a,
  mode: 'fairy',
  aspect: '16:9',
  ...globals,
  palette: 'foxfire',
  tintStyle: 'rise',
  modes: Object.fromEntries(MODE_IDS.map((id) => [id, modeDefaults(MODES[id])])) as Record<ModeId, Record<string, number>>,
}

export function gridSize(config: ContourConfig) {
  const cols = Math.round(config.cols)
  return { cols, rows: Math.max(8, Math.round(cols / ASPECTS[config.aspect])) }
}

/** Everything the sampled field depends on. Line, light and phase knobs are left out. */
export function fieldKey(config: ContourConfig) {
  return JSON.stringify([
    config.seed,
    config.mode,
    config.modes[config.mode],
    config.aspect,
    config.cols,
    config.interval,
    config.warp,
    config.warpScale,
  ])
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/** Reads a pasted or saved config, filling anything missing with defaults. */
export function normalizeConfig(raw: unknown): ContourConfig | null {
  if (!raw || typeof raw !== 'object') return null
  const input = raw as Partial<Record<keyof ContourConfig, unknown>>
  if (typeof input.mode !== 'string' || !(input.mode in MODES)) return null

  const config = structuredClone(DEFAULT_CONFIG)
  config.mode = input.mode as ModeId
  if (isNumber(input.seed)) config.seed = input.seed >>> 0
  if (typeof input.aspect === 'string' && input.aspect in ASPECTS) config.aspect = input.aspect as AspectId
  if (typeof input.palette === 'string' && input.palette in PALETTES) config.palette = input.palette as ContourConfig['palette']
  if (TINT_STYLES.includes(input.tintStyle as TintStyle)) config.tintStyle = input.tintStyle as TintStyle

  for (const spec of GLOBAL_PARAMS) {
    const v = input[spec.key]
    if (isNumber(v)) config[spec.key] = clamp(v, spec.min, spec.max)
  }

  const modes = (input.modes ?? {}) as Partial<Record<ModeId, Record<string, unknown>>>
  for (const id of MODE_IDS) {
    for (const spec of MODES[id].params) {
      const v = modes[id]?.[spec.key]
      if (isNumber(v)) config.modes[id][spec.key] = clamp(v, spec.min, spec.max)
    }
  }
  return config
}

export function seedLabel(seed: number) {
  return (seed >>> 0).toString(16).toUpperCase().padStart(8, '0')
}
