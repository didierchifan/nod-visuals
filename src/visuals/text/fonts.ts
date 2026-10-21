export type FontId =
  | 'unbounded'
  | 'syne'
  | 'grotesk'
  | 'bricolage'
  | 'shoulders'
  | 'fraunces'
  | 'kalnia'
  | 'cormorant'
  | 'grenze'
  | 'monoton'
  | 'mono'
  | 'system'
  | 'installed'

export interface Font {
  name: string
  note: string
  /** CSS font-family, fallbacks included. */
  family: string
  /** The weights the font really has. Text asks for one inside them. */
  min: number
  max: number
}

const SANS = 'ui-sans-serif, system-ui, -apple-system, sans-serif'

// The Google Fonts link in index.html loads these. Keep its weight ranges in step with min and max.
export const FONTS: Record<FontId, Font> = {
  unbounded: { name: 'Unbounded', note: 'Wide rave flyer', family: `'Unbounded', ${SANS}`, min: 200, max: 900 },
  syne: { name: 'Syne', note: 'Widens when heavy', family: `'Syne', ${SANS}`, min: 400, max: 800 },
  grotesk: { name: 'Space Grotesk', note: 'Quirky techno grotesk', family: `'Space Grotesk', ${SANS}`, min: 300, max: 700 },
  bricolage: { name: 'Bricolage', note: 'Inky and slightly off', family: `'Bricolage Grotesque', ${SANS}`, min: 200, max: 800 },
  shoulders: { name: 'Big Shoulders', note: 'Tall, for lineups', family: `'Big Shoulders Display', ${SANS}`, min: 100, max: 900 },
  fraunces: { name: 'Fraunces', note: 'Soft, wobbly serif', family: `'Fraunces', Georgia, serif`, min: 100, max: 900 },
  kalnia: { name: 'Kalnia', note: 'Art nouveau contrast', family: `'Kalnia', Georgia, serif`, min: 100, max: 700 },
  cormorant: { name: 'Cormorant', note: 'Fine Garamond', family: `'Cormorant', Georgia, serif`, min: 300, max: 700 },
  grenze: { name: 'Grenze Gotisch', note: 'Blackletter', family: `'Grenze Gotisch', Georgia, serif`, min: 100, max: 900 },
  monoton: { name: 'Monoton', note: 'Neon tubes, one weight', family: `'Monoton', ${SANS}`, min: 400, max: 400 },
  mono: { name: 'JetBrains Mono', note: 'Times and coordinates', family: `'JetBrains Mono', ui-monospace, monospace`, min: 100, max: 800 },
  system: { name: 'System', note: "This computer's sans", family: SANS, min: 100, max: 900 },
  installed: { name: 'Installed', note: 'Any font you have', family: SANS, min: 100, max: 900 },
}

export const FONT_IDS = Object.keys(FONTS) as FontId[]
