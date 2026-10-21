import type { TextColor, TextColors } from '../../visuals/text/text.ts'

/** What the two swatches are called, and what changes them. */
export interface SwatchSource {
  line: string
  accent: string
  follows: string
}

const PALETTE: SwatchSource = { line: 'Palette line', accent: 'Palette accent', follows: 'turns with the hue' }

interface ColorFieldProps {
  value: TextColor
  colors: TextColors
  /** Leave out for the contour palette. */
  source?: SwatchSource
  onChange(color: TextColor): void
}

/** The picture's own line or accent colour, which change with it, or any fixed colour. */
export function ColorField({ value, colors, source = PALETTE, onChange }: ColorFieldProps) {
  const custom = value !== 'line' && value !== 'accent'

  return (
    <div className="lab-field">
      <span className="lab-field-label">
        Colour <span>{custom ? value : `${source[value]}, ${source.follows}`}</span>
      </span>
      <div className="lab-swatches lab-text-colors" role="group" aria-label="Colour">
        {(['line', 'accent'] as const).map((id) => (
          <button
            key={id}
            type="button"
            className="lab-swatch"
            aria-pressed={value === id}
            aria-label={source[id]}
            title={source[id]}
            style={{ background: colors[id] }}
            onClick={() => onChange(id)}
          />
        ))}
        <label className="lab-swatch lab-swatch-pick" data-pressed={custom || undefined} title="Any colour">
          <i style={custom ? { background: value } : undefined} />
          <input
            type="color"
            aria-label="Any colour"
            value={value === 'line' || value === 'accent' ? colors[value] : value}
            onChange={(e) => onChange(e.target.value as TextColor)}
          />
        </label>
      </div>
    </div>
  )
}
