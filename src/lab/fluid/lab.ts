import { normalizeConfig, type FluidConfig } from '../../visuals/fluid/config.ts'

const STORAGE_KEY = 'nod-visuals:fluid-lab'
/** Its own texts and logo, for the contour lab's helpers; kept apart from the config like theirs. */
export const TEXTS_KEY = 'nod-visuals:fluid-lab:texts'
export const LOGO_KEY = 'nod-visuals:fluid-lab:logo'

export function loadStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? normalizeConfig(JSON.parse(raw)) : null
  } catch {
    return null
  }
}

export function store(config: FluidConfig) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
  } catch {
    // Private windows can refuse storage; the lab still works without it.
  }
}
