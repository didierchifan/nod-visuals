import type { TextColors } from '../../visuals/text/text.ts'
import { ColorField, type SwatchSource } from './ColorField.tsx'
import type { LogoState } from './lab.ts'
import { Segmented } from './Segmented.tsx'

const SHOWN = ['shown', 'hidden'] as const

interface LogoPanelProps {
  logo: LogoState
  colors: TextColors
  source?: SwatchSource
  onChange(change: Partial<LogoState>): void
}

export function LogoPanel({ logo, colors, source, onChange }: LogoPanelProps) {
  return (
    <>
      <Segmented
        label="Logo"
        options={SHOWN}
        value={logo.shown ? 'shown' : 'hidden'}
        onChange={(v) => onChange({ shown: v === 'shown' })}
      />
      <p className="lab-blurb">
        Drag it on the canvas, pull a corner to resize it, double-click it to put it back. L shows and hides it.
      </p>

      <section className="lab-section">
        <div className="lab-section-head">
          <h2>Look</h2>
        </div>
        <ColorField value={logo.color} colors={colors} source={source} onChange={(color) => onChange({ color })} />
      </section>
    </>
  )
}
