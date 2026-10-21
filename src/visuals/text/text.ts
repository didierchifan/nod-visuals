import type { ParamSpec } from '../contours/types.ts'
import { FONTS, type Font, type FontId } from './fonts.ts'

export type TextAlign = 'left' | 'center' | 'right'

export type TextCase = 'none' | 'upper' | 'lower'

/** A palette colour, which turns with the hue knob, or a fixed hex colour. */
export type TextColor = 'line' | 'accent' | `#${string}`

/** The palette's line and accent colours as they look right now, in hex. */
export interface TextColors {
  line: string
  accent: string
}

export interface TextLayer {
  id: string
  content: string
  font: FontId
  /** Family name used when `font` is `installed`. */
  installed: string
  italic: boolean
  align: TextAlign
  case: TextCase
  color: TextColor
  /** Centre of the text block, as a share of the frame's width and height. */
  x: number
  y: number
  weight: number
  /** Font size as a percentage of the frame height, so text keeps its place at any resolution. */
  size: number
  /** Letter spacing in em. */
  tracking: number
  /** Line height as a multiple of the size. */
  leading: number
  opacity: number
  glow: number
  /** Degrees clockwise about the block's centre. */
  rotation: number
}

export type TextKey = 'size' | 'weight' | 'tracking' | 'leading' | 'opacity' | 'glow' | 'rotation'

export const TEXT_PARAMS: (ParamSpec<TextKey> & { section: 'type' | 'look' })[] = [
  { section: 'type', key: 'size', label: 'Size', min: 2, max: 50, step: 0.5, value: 12, unit: '%' },
  { section: 'type', key: 'weight', label: 'Weight', min: 100, max: 900, step: 10, value: 600 },
  { section: 'type', key: 'tracking', label: 'Tracking', min: -0.1, max: 0.6, step: 0.01, value: 0.02 },
  { section: 'type', key: 'leading', label: 'Line height', min: 0.7, max: 2, step: 0.01, value: 1.05 },
  { section: 'look', key: 'opacity', label: 'Opacity', min: 0, max: 1, step: 0.01, value: 1 },
  { section: 'look', key: 'glow', label: 'Glow', min: 0, max: 1, step: 0.01, value: 0.35 },
  { section: 'look', key: 'rotation', label: 'Rotation', min: 0, max: 360, step: 1, value: 0, dial: true, unit: '°' },
]

export const TEXT_ALIGNS: TextAlign[] = ['left', 'center', 'right']

export const TEXT_CASES: TextCase[] = ['none', 'upper', 'lower']

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

const isColor = (v: unknown): v is TextColor =>
  v === 'line' || v === 'accent' || (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v))

/** A new text in the middle of the frame, or one styled like `like` and set just below it. */
export function createText(like?: TextLayer): TextLayer {
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
  if (like) {
    const below = like.y + (((linesOf(like).length + 1) / 2) * like.size * like.leading) / 100
    return { ...like, id, content: 'Text', y: below < 0.95 ? below : 0.5 }
  }
  return {
    id,
    content: 'Text',
    font: 'unbounded',
    installed: '',
    italic: false,
    align: 'center',
    case: 'none',
    color: 'accent',
    x: 0.5,
    y: 0.5,
    ...(Object.fromEntries(TEXT_PARAMS.map((spec) => [spec.key, spec.value])) as Record<TextKey, number>),
  }
}

/** Reads stored texts, filling anything missing with defaults. */
export function normalizeTexts(raw: unknown): TextLayer[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const input = item as Partial<Record<keyof TextLayer, unknown>>
    const text = createText()
    if (typeof input.id === 'string') text.id = input.id
    if (typeof input.content === 'string') text.content = input.content
    if (typeof input.font === 'string' && input.font in FONTS) text.font = input.font as FontId
    if (typeof input.installed === 'string') text.installed = input.installed
    if (typeof input.italic === 'boolean') text.italic = input.italic
    if (TEXT_ALIGNS.includes(input.align as TextAlign)) text.align = input.align as TextAlign
    if (TEXT_CASES.includes(input.case as TextCase)) text.case = input.case as TextCase
    if (isColor(input.color)) text.color = input.color
    if (isNumber(input.x)) text.x = clamp(input.x, 0, 1)
    if (isNumber(input.y)) text.y = clamp(input.y, 0, 1)
    for (const spec of TEXT_PARAMS) {
      const v = input[spec.key]
      if (isNumber(v)) text[spec.key] = clamp(v, spec.min, spec.max)
    }
    return [text]
  })
}

export function fontOf(text: TextLayer): Font {
  const font = FONTS[text.font]
  const name = text.installed.replace(/['"\\]/g, '').trim()
  return text.font === 'installed' && name ? { ...font, family: `'${name}', ${font.family}` } : font
}

/** The weight asked for, inside what the font has, so it survives a trip through a font with fewer weights. */
export const weightOf = (text: TextLayer) => {
  const font = fontOf(text)
  return clamp(text.weight, font.min, font.max)
}

export function linesOf(text: TextLayer) {
  const content = text.case === 'upper' ? text.content.toUpperCase() : text.case === 'lower' ? text.content.toLowerCase() : text.content
  return content.split('\n')
}

export const colorOf = (text: TextLayer, colors: TextColors) =>
  text.color === 'line' ? colors.line : text.color === 'accent' ? colors.accent : text.color

/** Glow blur radius in em. CSS text-shadow and canvas shadowBlur blur by the same amount. */
export const glowOf = (text: TextLayer) => text.glow * 0.6

export const cssFont = (text: TextLayer, px: number) =>
  `${text.italic ? 'italic ' : ''}${weightOf(text)} ${px}px ${fontOf(text).family}`

/** Canvas draws with whatever has loaded by then, so fetch every face the texts use first. */
export function loadFonts(texts: TextLayer[]) {
  return Promise.all(
    texts.map((text) => document.fonts.load(cssFont(text, 16), linesOf(text).join('') || ' ').catch(() => [])),
  )
}

/**
 * Draws the texts over a `width` x `height` frame the way the lab lays them
 * out in CSS: each line in a box `leading` tall with the font's ascent and
 * descent centred in it, the block centred on (x, y) and turned about it.
 */
export function drawTexts(
  ctx: CanvasRenderingContext2D,
  texts: TextLayer[],
  colors: TextColors,
  width: number,
  height: number,
) {
  for (const text of texts) {
    const lines = linesOf(text)
    const px = (text.size / 100) * height
    const lineHeight = text.leading * px
    const tracking = text.tracking * px
    const color = colorOf(text, colors)

    ctx.save()
    ctx.font = cssFont(text, px)
    ctx.fillStyle = color
    ctx.globalAlpha = text.opacity
    if (text.glow > 0) {
      ctx.shadowColor = color
      ctx.shadowBlur = glowOf(text) * px
    }
    // Without canvas letter spacing, glyphs are placed one by one.
    const native = typeof ctx.letterSpacing === 'string'
    if (native) ctx.letterSpacing = `${tracking}px`
    const advance = (s: string) => ctx.measureText(s).width + (native ? 0 : tracking * [...s].length)
    const widths = lines.map(advance)
    const block = Math.max(...widths)
    const { fontBoundingBoxAscent: ascent, fontBoundingBoxDescent: descent } = ctx.measureText(' ')

    ctx.translate(text.x * width, text.y * height)
    ctx.rotate((text.rotation * Math.PI) / 180)
    lines.forEach((line, i) => {
      const slack = block - widths[i]
      const left = -block / 2 + (text.align === 'left' ? 0 : text.align === 'right' ? slack : slack / 2)
      const baseline = (i - lines.length / 2) * lineHeight + (lineHeight - ascent - descent) / 2 + ascent
      if (native) {
        ctx.fillText(line, left, baseline)
        return
      }
      const glyphs = [...line]
      glyphs.forEach((glyph, k) => ctx.fillText(glyph, left + advance(glyphs.slice(0, k).join('')), baseline))
    })
    ctx.restore()
  }
}
