import type { FieldMode, ModeId } from '../types.ts'
import { bracket } from './bracket.ts'
import { canopy } from './canopy.ts'
import { fairy } from './fairy.ts'
import { gills } from './gills.ts'
import { mycelium } from './mycelium.ts'
import { timber } from './timber.ts'

export const MODES: Record<ModeId, FieldMode> = { fairy, timber, bracket, gills, mycelium, canopy }

export const MODE_IDS = Object.keys(MODES) as ModeId[]

export function modeDefaults(mode: FieldMode) {
  return Object.fromEntries(mode.params.map((spec) => [spec.key, spec.value]))
}
