import { normalizeConfig } from '../../visuals/contours/config.ts'
import type { ContourConfig } from '../../visuals/contours/types.ts'

/** Served by the dev-only plugin in vite.config.ts. */
const ENDPOINT = '/__lab/contours'
const STORAGE_KEY = 'nod-visuals:contour-lab'

export interface SavedConfig {
  path: string
  config: ContourConfig
}

export function randomSeed() {
  return crypto.getRandomValues(new Uint32Array(1))[0]
}

/** Freezes a flowing config at the phase it shows right now. */
export function bake(config: ContourConfig, epoch: number, now: number): ContourConfig {
  if (config.flow === 0) return config
  const phase = config.phase + (config.flow * (now - epoch)) / 1000
  return { ...config, phase: Number((phase - Math.floor(phase)).toFixed(4)) }
}

/** Bakes the current phase and restarts the flow clock from now, so changing flow never jumps. */
export function rebase(config: ContourConfig, epoch: number) {
  const now = performance.now()
  return { config: bake(config, epoch, now), epoch: now }
}

export async function listSaved(): Promise<SavedConfig[]> {
  const res = await fetch(ENDPOINT)
  if (!res.ok) return []
  const entries = (await res.json()) as { path: string; config: unknown }[]
  return entries.flatMap(({ path, config }) => {
    const normalized = normalizeConfig(config)
    return normalized ? [{ path, config: normalized }] : []
  })
}

/** Writes the config into the project and returns its path, or null without a dev server. */
export async function saveConfig(json: string): Promise<string | null> {
  const res = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: json })
  if (!res.ok) return null
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
