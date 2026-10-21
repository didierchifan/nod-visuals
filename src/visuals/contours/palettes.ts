import type { PaletteId } from './types.ts'

export interface Palette {
  name: string
  note: string
  bg: string
  /** Ordinary contours, ghost cells and layer tints. */
  line: string
  /** Index contours and margins. */
  accent: string
}

// Black plus at most two emitted colours. Everything else is that light at a lower level.
export const PALETTES: Record<PaletteId, Palette> = {
  foxfire: {
    name: 'Foxfire',
    note: 'Fungal glow peaks near 525 nm',
    bg: '#030605',
    line: '#3ee68a',
    accent: '#d9ffe8',
  },
  jackolantern: {
    name: "Jack-o'-lantern",
    note: 'Omphalotus is orange by day and glows green at night',
    bg: '#060403',
    line: '#ff6b1a',
    accent: '#62ffa3',
  },
  amanita: {
    name: 'Fly Agaric',
    note: 'Red cap, white warts',
    bg: '#070303',
    line: '#e2321e',
    accent: '#f6ecdc',
  },
  blacklight: {
    name: 'Blacklight',
    note: 'UV violet and what fluoresces under it',
    bg: '#05030a',
    line: '#7c45ff',
    accent: '#e8ff3a',
  },
  spore: {
    name: 'Spore Print',
    note: 'Rust-brown spores dropped on black card',
    bg: '#050403',
    line: '#b8743a',
    accent: '#f2dcaa',
  },
  lichen: {
    name: 'Lichen',
    note: 'Grey-green thallus, Xanthoria orange',
    bg: '#040504',
    line: '#9fc25a',
    accent: '#ff8b3d',
  },
  bluing: {
    name: 'Bluing',
    note: 'The blue bruise some mushrooms take when handled',
    bg: '#020309',
    line: '#2f6bff',
    accent: '#cfe0ff',
  },
  bone: {
    name: 'Bone',
    note: 'One colour, for projection mapping',
    bg: '#000000',
    line: '#c9c2b6',
    accent: '#fffaf0',
  },
}

export const PALETTE_IDS = Object.keys(PALETTES) as PaletteId[]

export type RGB = [number, number, number]

export function rgb(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export const css = ([r, g, b]: RGB) => `rgb(${r} ${g} ${b})`

const byte = (v: number) => Math.round(Math.min(255, Math.max(0, v)))

/** The hue-rotate matrix from the CSS filter spec: turns hue, keeps luminance. */
export function turn([r, g, b]: RGB, degrees: number): RGB {
  if (!degrees) return [r, g, b]
  const a = (degrees * Math.PI) / 180
  const c = Math.cos(a)
  const s = Math.sin(a)
  return [
    byte(r * (0.213 + c * 0.787 - s * 0.213) + g * (0.715 - c * 0.715 - s * 0.715) + b * (0.072 - c * 0.072 + s * 0.928)),
    byte(r * (0.213 - c * 0.213 + s * 0.143) + g * (0.715 + c * 0.285 + s * 0.14) + b * (0.072 - c * 0.072 - s * 0.283)),
    byte(r * (0.213 - c * 0.213 - s * 0.787) + g * (0.715 - c * 0.715 + s * 0.715) + b * (0.072 + c * 0.928 + s * 0.072)),
  ]
}

/** The palette's three colours after the hue knob. */
export function colorsOf(palette: PaletteId, hue: number) {
  const p = PALETTES[palette]
  return { bg: turn(rgb(p.bg), hue), line: turn(rgb(p.line), hue), accent: turn(rgb(p.accent), hue) }
}
