export type ModeId = 'fairy' | 'timber' | 'bracket' | 'gills' | 'mycelium' | 'canopy'

export type PaletteId =
  | 'foxfire'
  | 'jackolantern'
  | 'amanita'
  | 'blacklight'
  | 'spore'
  | 'lichen'
  | 'bluing'
  | 'bone'

export type AspectId = '16:9' | '4:3' | '1:1' | '4:5' | '9:16'

export type TintStyle = 'rise' | 'fall' | 'bands'

/** Panel sections that can be set to drift on their own. */
export type DriftGroup = 'field' | 'light' | 'contours' | 'grid' | 'soil'

export interface ContourConfig {
  version: 1
  seed: number
  mode: ModeId
  aspect: AspectId
  /** Cells across the width. Rows follow from the aspect. */
  cols: number
  /** Fraction of each cell left dark, like the pitch of an LED wall. */
  gap: number
  /** Magnification of the field under the grid. */
  zoom: number
  panX: number
  panY: number
  /** Cells between neighbouring contour levels. */
  interval: number
  /** Line thickness in cells. */
  weight: number
  /** Extra cells over which a line fades out. */
  feather: number
  indexEvery: number
  indexWeight: number
  /** Offset of every level. One full turn moves the lines through a whole index cycle. */
  phase: number
  /** Levels per second the contours travel when animated. */
  flow: number
  warp: number
  warpScale: number
  palette: PaletteId
  /** Degrees the whole palette is turned around the colour wheel. */
  hue: number
  ghost: number
  tint: number
  tintStyle: TintStyle
  glow: number
  grain: number
  /** Sections whose knobs wander on their own. */
  drift: Record<DriftGroup, boolean>
  /** Knobs kept still even while their section drifts: global keys, or `mode.key` for field knobs. */
  held: string[]
  /** How fast drifting knobs travel. */
  tempo: number
  /** How wide a window bounded knobs sweep, as a share of each knob's range. */
  range: number
  /** The drift clock. Advanced on every bake, never set by hand. */
  driftClock: number
  /** Where each drifting knob started travelling: value `c` at clock `t`. Keyed like `held`. */
  motion: Record<string, { c: number; t: number }>
  modes: Record<ModeId, Record<string, number>>
}

export type GlobalKey =
  | 'cols'
  | 'gap'
  | 'zoom'
  | 'panX'
  | 'panY'
  | 'interval'
  | 'weight'
  | 'feather'
  | 'indexEvery'
  | 'indexWeight'
  | 'phase'
  | 'flow'
  | 'warp'
  | 'warpScale'
  | 'hue'
  | 'ghost'
  | 'tint'
  | 'glow'
  | 'grain'
  | 'tempo'
  | 'range'

export interface ParamSpec<K extends string = string> {
  key: K
  label: string
  min: number
  max: number
  step: number
  value: number
  /** Wraps around instead of stopping at the ends. */
  dial?: boolean
  unit?: string
  /** Never drifts: small changes reshuffle the picture instead of moving it. */
  still?: boolean
  /** Scales how fast this knob drifts, for knobs that move the whole picture. */
  sway?: number
}

export interface FieldContext {
  seed: number
  /** Half the frame width in world units. The frame is always 2 units tall. */
  halfWidth: number
  /** World distance between contour levels. */
  spacing: number
  /** World size of one cell. */
  cell: number
}

export interface Sample {
  /** Field value, or NaN where the field is void. */
  v: number
  /** Cells whose corners land in different regions are drawn as a margin. */
  region: number
  /** Level density multiplier: 2 adds supplementary lines halfway between levels. */
  detail: number
  /** Linework drawn as itself rather than as a contour, like streams on a survey map. */
  ink: number
}

export interface Field {
  sample(x: number, y: number, out: Sample): void
  /** Set when the field jumps by whole multiples of this value (spirals, angles). */
  period?: number
  /** Also sample cell centres for `ink`. */
  ink?: boolean
}

export interface FieldMode {
  id: ModeId
  name: string
  latin: string
  blurb: string
  params: ParamSpec[]
  /** Global knobs this field has no use for. */
  ignores?: GlobalKey[]
  /** Draw a margin where the field meets the void. */
  outline?: boolean
  build(params: Record<string, number>, ctx: FieldContext): Field
}
