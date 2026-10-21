import type { Ref } from 'react'
import { FONT_IDS, FONTS } from '../../visuals/text/fonts.ts'
import {
  fontOf,
  linesOf,
  TEXT_ALIGNS,
  TEXT_CASES,
  TEXT_PARAMS,
  weightOf,
  type TextColors,
  type TextLayer,
} from '../../visuals/text/text.ts'
import { ColorField, type SwatchSource } from './ColorField.tsx'
import { Knob } from './Knob.tsx'
import { Segmented } from './Segmented.tsx'

const STYLES = ['upright', 'italic'] as const

interface TextPanelProps {
  texts: TextLayer[]
  text: TextLayer | undefined
  colors: TextColors
  source?: SwatchSource
  inputRef: Ref<HTMLTextAreaElement>
  onAdd(): void
  onSelect(id: string): void
  onChange(change: Partial<TextLayer>): void
  onRemove(): void
}

export function TextPanel({ texts, text, colors, source, inputRef, onAdd, onSelect, onChange, onRemove }: TextPanelProps) {
  return (
    <>
      <div className="lab-text-list" role="group" aria-label="Texts">
        {texts.map((t) => (
          <button
            key={t.id}
            type="button"
            className="lab-text-row"
            aria-pressed={t.id === text?.id}
            style={{ fontFamily: fontOf(t).family }}
            onClick={() => onSelect(t.id)}
          >
            {linesOf(t).find((line) => line.trim()) ?? 'Empty'}
          </button>
        ))}
        <button type="button" className="lab-btn" onClick={onAdd}>
          Add text
        </button>
      </div>
      {text ? (
        <TextEditor text={text} colors={colors} source={source} inputRef={inputRef} onChange={onChange} onRemove={onRemove} />
      ) : (
        <p className="lab-blurb">
          {texts.length
            ? 'Pick a text here or on the canvas to edit it, and drag it anywhere.'
            : 'Texts sit over the picture, go wherever you drag them, and go into the PNG.'}
        </p>
      )}
    </>
  )
}

function TextEditor({
  text,
  colors,
  source,
  inputRef,
  onChange,
  onRemove,
}: Pick<TextPanelProps, 'colors' | 'source' | 'inputRef' | 'onChange' | 'onRemove'> & { text: TextLayer }) {
  const font = fontOf(text)

  const knobs = (section: 'type' | 'look') =>
    TEXT_PARAMS.filter((spec) => spec.section === section).map((spec) => {
      // Weight turns only through what the chosen font has.
      const weight = spec.key === 'weight'
      return (
        <Knob
          key={spec.key}
          label={spec.label}
          value={weight ? weightOf(text) : text[spec.key]}
          min={weight ? font.min : spec.min}
          max={weight ? font.max : spec.max}
          step={spec.step}
          defaultValue={weight ? weightOf({ ...text, weight: spec.value }) : spec.value}
          dial={spec.dial}
          unit={spec.unit}
          idle={weight && font.min === font.max}
          onChange={(v) => onChange({ [spec.key]: v })}
        />
      )
    })

  return (
    <>
      <section className="lab-section">
        <div className="lab-section-head">
          <h2>Text</h2>
          <button type="button" className="lab-mini" onClick={onRemove}>
            Delete
          </button>
        </div>
        <textarea
          ref={inputRef}
          className="lab-input"
          rows={3}
          spellCheck={false}
          aria-label="Text"
          value={text.content}
          onChange={(e) => onChange({ content: e.target.value })}
        />
      </section>

      <section className="lab-section">
        <div className="lab-section-head">
          <h2>Type</h2>
        </div>
        <div className="lab-fonts" role="group" aria-label="Font">
          {FONT_IDS.map((id) => (
            <button
              key={id}
              type="button"
              className="lab-mode lab-font"
              aria-pressed={id === text.font}
              onClick={() => onChange({ font: id })}
            >
              <span style={{ fontFamily: FONTS[id].family, fontWeight: weightOf({ ...text, font: id }) }}>
                {FONTS[id].name}
              </span>
              <small>{FONTS[id].note}</small>
            </button>
          ))}
        </div>
        {text.font === 'installed' && (
          <input
            type="text"
            className="lab-input"
            placeholder="Family name, e.g. Helvetica Neue"
            spellCheck={false}
            aria-label="Installed font name"
            value={text.installed}
            onChange={(e) => onChange({ installed: e.target.value })}
          />
        )}
        <div className="lab-knobs">{knobs('type')}</div>
        <Segmented
          label="Style"
          options={STYLES}
          value={text.italic ? 'italic' : 'upright'}
          onChange={(style) => onChange({ italic: style === 'italic' })}
        />
        <Segmented
          label="Case"
          options={TEXT_CASES}
          labels={{ none: 'As typed' }}
          value={text.case}
          onChange={(c) => onChange({ case: c })}
        />
        <Segmented
          label="Align"
          options={TEXT_ALIGNS}
          labels={{ center: 'Centre' }}
          value={text.align}
          onChange={(align) => onChange({ align })}
        />
      </section>

      <section className="lab-section">
        <div className="lab-section-head">
          <h2>Look</h2>
        </div>
        <ColorField value={text.color} colors={colors} source={source} onChange={(color) => onChange({ color })} />
        <div className="lab-knobs">{knobs('look')}</div>
      </section>
    </>
  )
}
