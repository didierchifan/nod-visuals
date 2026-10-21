import { useState } from 'react'
import { parseHex } from '../../visuals/fluid/config.ts'

interface HexFieldProps {
  label: string
  /** The leva name, shown beside the label. */
  note: string
  value: string
  onChange(hex: string): void
}

/** A swatch that opens the system picker, and the hex beside it to type into. */
export function HexField({ label, note, value, onChange }: HexFieldProps) {
  // What's being typed, until it reads as a colour or the field is left.
  const [draft, setDraft] = useState<string | null>(null)

  return (
    <div className="lab-field">
      <span className="lab-field-label">
        {label} <span>{note}</span>
      </span>
      <div className="fluid-color">
        <input type="color" aria-label={`${label} colour`} value={value} onChange={(e) => onChange(e.target.value)} />
        <input
          type="text"
          className="fluid-hex"
          aria-label={`${label} hex`}
          value={draft ?? value}
          spellCheck={false}
          autoComplete="off"
          onChange={(e) => {
            setDraft(e.target.value)
            const hex = parseHex(e.target.value)
            if (hex) onChange(hex)
          }}
          onBlur={() => setDraft(null)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur()
          }}
        />
      </div>
    </div>
  )
}
