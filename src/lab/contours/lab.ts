import { normalizeConfig } from '../../visuals/contours/config.ts'
import { freeze } from '../../visuals/contours/drift.ts'
import type { ContourConfig } from '../../visuals/contours/types.ts'
import { normalizeTexts, type TextColor, type TextLayer } from '../../visuals/text/text.ts'

/** Served by the dev-only plugin in vite.config.ts. */
const ENDPOINT = '/__lab/contours'
const STORAGE_KEY = 'nod-visuals:contour-lab'
/** Kept apart from the config, so texts stay put through new seeds, history and loaded settings. */
const TEXTS_KEY = 'nod-visuals:contour-lab:texts'
const LOGO_KEY = 'nod-visuals:contour-lab-logo'

export interface SavedConfig {
  path: string
  config: ContourConfig
}

/** Where the logo sits, as shares of the picture: its centre, and its width. */
export interface LogoPlacement {
  x: number
  y: number
  width: number
}

export interface LogoState extends LogoPlacement {
  shown: boolean
  /** Picked the same way as a text's colour. */
  color: TextColor
}

export const DEFAULT_LOGO: LogoPlacement = { x: 0.5, y: 0.5, width: 0.3 }

export function randomSeed() {
  return crypto.getRandomValues(new Uint32Array(1))[0]
}

/** The config exactly as it looks right now, flow and drift baked in. */
export function snapshot(config: ContourConfig, epoch: number) {
  return freeze(config, Math.max(0, (performance.now() - epoch) / 1000))
}

/** Bakes the current moment and restarts the clock from it, so no change ever makes the picture jump. */
export function rebase(config: ContourConfig, epoch: number) {
  const now = performance.now()
  return { config: freeze(config, Math.max(0, (now - epoch) / 1000)), epoch: now }
}

// Outside the dev server the endpoint is missing, or a host answers with the page itself.
const fromDevServer = (res: Response) => res.ok && (res.headers.get('Content-Type') ?? '').includes('application/json')

export async function listSaved(): Promise<SavedConfig[]> {
  const res = await fetch(ENDPOINT)
  if (!fromDevServer(res)) return []
  const entries = (await res.json()) as { path: string; config: unknown }[]
  return entries.flatMap(({ path, config }) => {
    const normalized = normalizeConfig(config)
    return normalized ? [{ path, config: normalized }] : []
  })
}

/** Writes the config into the project and returns its path, or null without a dev server. */
export async function saveConfig(json: string): Promise<string | null> {
  const res = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: json })
  if (!fromDevServer(res)) return null
  return ((await res.json()) as { path: string }).path
}

export function loadStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? normalizeConfig(JSON.parse(raw)) : null
  } catch {
    return null
  }
}

export function store(config: ContourConfig) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
  } catch {
    // Private windows can refuse storage; the lab still works without it.
  }
}

// The text and logo helpers take another lab's own storage key; left out, they keep this lab's.

export function loadTexts(key = TEXTS_KEY) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? normalizeTexts(JSON.parse(raw)) : []
  } catch {
    return []
  }
}

export function storeTexts(texts: TextLayer[], key = TEXTS_KEY) {
  try {
    localStorage.setItem(key, JSON.stringify(texts))
  } catch {
    // As in store().
  }
}

export function loadLogo(key = LOGO_KEY): LogoState {
  const logo: LogoState = { ...DEFAULT_LOGO, shown: true, color: 'accent' }
  try {
    const stored = JSON.parse(localStorage.getItem(key) ?? '{}') as Record<string, unknown>
    for (const key of ['x', 'y', 'width'] as const) {
      const v = stored[key]
      if (typeof v === 'number' && Number.isFinite(v)) logo[key] = v
    }
    logo.shown = stored.shown !== false
    const { color } = stored
    if (color === 'line' || color === 'accent' || (typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color))) {
      logo.color = color as TextColor
    }
  } catch {
    // Unreadable storage leaves the logo where it starts.
  }
  return logo
}

export function storeLogo(logo: LogoState, key = LOGO_KEY) {
  try {
    localStorage.setItem(key, JSON.stringify(logo))
  } catch {
    // As with the config, the logo just forgets its place.
  }
}
