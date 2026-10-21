import { normalizeConfig } from '../../visuals/contours/config.ts'
import { freeze } from '../../visuals/contours/drift.ts'
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
