import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { ContourCanvas } from '../../visuals/contours/ContourCanvas.tsx'
import {
  ASPECTS,
  DEFAULT_CONFIG,
  drifts,
  fieldKnob,
  GLOBAL_PARAMS,
  normalizeConfig,
  seedLabel,
  TINT_STYLES,
  type Section,
} from '../../visuals/contours/config.ts'
import { drifted, isDrifting, syncMotion } from '../../visuals/contours/drift.ts'
import { MODE_IDS, MODES } from '../../visuals/contours/modes/index.ts'
import { colorsOf, css, PALETTE_IDS, PALETTES } from '../../visuals/contours/palettes.ts'
import { renderToCanvas } from '../../visuals/contours/render.ts'
import type { AspectId, ContourConfig, DriftGroup, GlobalKey } from '../../visuals/contours/types.ts'
import { Knob } from './Knob.tsx'
import { listSaved, loadStored, randomSeed, rebase, saveConfig, snapshot, store, type SavedConfig } from './lab.ts'
import './lab.css'

const SECTIONS: { id: Section; title: string; drift?: DriftGroup }[] = [
  { id: 'light', title: 'Light', drift: 'light' },
  { id: 'contours', title: 'Contours', drift: 'contours' },
  { id: 'grid', title: 'Grid', drift: 'grid' },
  { id: 'soil', title: 'Soil', drift: 'soil' },
  { id: 'motion', title: 'Motion' },
]

const ASPECT_IDS = Object.keys(ASPECTS) as AspectId[]

function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: readonly T[]
  value: T
  onChange(value: T): void
}) {
  return (
    <div className="lab-field">
      <span className="lab-field-label">{label}</span>
      <div className="lab-seg" role="group" aria-label={label}>
        {options.map((option) => (
          <button key={option} type="button" aria-pressed={option === value} onClick={() => onChange(option)}>
            {option}
          </button>
        ))}
      </div>
    </div>
  )
}

function SectionHead({ title, active, onToggle }: { title: string; active?: boolean; onToggle?(): void }) {
  return (
    <div className="lab-section-head">
      <h2>{title}</h2>
      {onToggle && (
        <button type="button" className="lab-drift" aria-pressed={active} onClick={onToggle}>
          <span className="lab-drift-dot" aria-hidden="true" />
          Randomly animate
        </button>
      )}
    </div>
  )
}

export default function ContourLab() {
  const [config, setConfig] = useState<ContourConfig>(() => syncMotion(loadStored() ?? DEFAULT_CONFIG))
  const [epoch, setEpoch] = useState(0)
  const [clock, setClock] = useState(0)
  const [past, setPast] = useState<ContourConfig[]>([])
  const [future, setFuture] = useState<ContourConfig[]>([])
  const [saved, setSaved] = useState<SavedConfig[]>([])
  const [notice, setNotice] = useState('')
  const stage = useRef<HTMLDivElement>(null)

  // What the knobs show: the config as the canvas is drawing it right now.
  const shown = drifted(config, Math.max(0, (clock - epoch) / 1000))
  const mode = MODES[config.mode]
  const palette = PALETTES[config.palette]
  const accent = css(colorsOf(shown.palette, shown.hue).accent)

  useEffect(() => store(config), [config])

  useEffect(() => {
    listSaved().then(setSaved)
  }, [])

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(''), 3600)
    return () => clearTimeout(timer)
  }, [notice])

  // Keeps the panel in step with the canvas while knobs drift.
  useEffect(() => {
    if (!isDrifting(config)) return
    let frame = requestAnimationFrame(function tick(now) {
      setClock(now)
      frame = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(frame)
  }, [config])

  const now = () => snapshot(config, epoch)
  const settingsJson = () => JSON.stringify(now(), null, 2)

  /**
   * Every edit starts from the frame on screen, so nothing jumps while things
   * move. `restart` is a knob the user just set by hand: it travels on from there.
   */
  const update = (change: (c: ContourConfig) => ContourConfig, restart?: string) => {
    const next = rebase(config, epoch)
    const changed = change(next.config)
    if (restart && changed.motion[restart]) {
      changed.motion = Object.fromEntries(Object.entries(changed.motion).filter(([id]) => id !== restart))
    }
    setConfig(syncMotion(changed))
    setEpoch(next.epoch)
  }

  const apply = (next: ContourConfig) => {
    const current = rebase(config, epoch)
    setPast((p) => [...p.slice(-49), current.config])
    setFuture([])
    setConfig(syncMotion(next))
    setEpoch(current.epoch)
  }

  const regenerate = () => apply({ ...now(), seed: randomSeed() })

  const back = () => {
    const previous = past.at(-1)
    if (!previous) return
    const current = rebase(config, epoch)
    setPast((p) => p.slice(0, -1))
    setFuture((f) => [current.config, ...f])
    setConfig(previous)
    setEpoch(current.epoch)
  }

  const forward = () => {
    const next = future[0]
    if (!next) return
    const current = rebase(config, epoch)
    setFuture((f) => f.slice(1))
    setPast((p) => [...p, current.config])
    setConfig(next)
    setEpoch(current.epoch)
  }

  const setGlobal = (key: GlobalKey, value: number) => update((c) => ({ ...c, [key]: value }), key)

  const setParam = (key: string, value: number) =>
    update(
      (c) => ({ ...c, modes: { ...c.modes, [c.mode]: { ...c.modes[c.mode], [key]: value } } }),
      fieldKnob(config.mode, key),
    )

  const toggleDrift = (group: DriftGroup) =>
    update((c) => ({ ...c, drift: { ...c.drift, [group]: !c.drift[group] } }))

  const setHeld = (id: string, held: boolean) =>
    update((c) => ({ ...c, held: held ? [...c.held.filter((h) => h !== id), id] : c.held.filter((h) => h !== id) }))

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(settingsJson())
      setNotice(`Copied settings for seed ${seedLabel(config.seed)}`)
    } catch {
      setNotice('The browser blocked the clipboard. Press ⌘C with nothing selected instead.')
    }
  }

  const save = async () => {
    const keeper = now()
    const json = JSON.stringify(keeper, null, 2)
    const copied = await navigator.clipboard.writeText(json).then(
      () => true,
      () => false,
    )
    const path = await saveConfig(json)
    if (path) {
      setSaved((s) => [{ path, config: keeper }, ...s])
      setNotice(`Saved ${path}${copied ? ' and copied it' : ''}`)
    } else {
      setNotice(copied ? 'Copied, but the dev server did not write the file' : 'Save failed')
    }
  }

  const exportPng = () => {
    const keeper = now()
    renderToCanvas(keeper).toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${keeper.mode}-${seedLabel(keeper.seed)}.png`
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    })
  }

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen()
    else stage.current?.requestFullscreen()
  }

  useEffect(() => {
    const isControl = (target: EventTarget | null) =>
      target instanceof HTMLElement && target.closest('button, input, textarea, select, [role="slider"]') !== null

    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isControl(e.target)) return
      if (e.key === 'f') toggleFullscreen()
      else if (e.key === ' ' || e.key === 'n') regenerate()
      else if (e.key === 'ArrowLeft') back()
      else if (e.key === 'ArrowRight') forward()
      else return
      e.preventDefault()
    }
    // ⌘C with nothing selected copies the settings; ⌘V of copied settings brings them back.
    const onCopy = (e: ClipboardEvent) => {
      if (isControl(e.target) || window.getSelection()?.toString()) return
      e.clipboardData?.setData('text/plain', settingsJson())
      e.preventDefault()
      setNotice(`Copied settings for seed ${seedLabel(config.seed)}`)
    }
    const onPaste = (e: ClipboardEvent) => {
      let parsed: unknown = null
      try {
        parsed = JSON.parse(e.clipboardData?.getData('text/plain') ?? '')
      } catch {
        // Not JSON, so not ours.
      }
      const next = normalizeConfig(parsed)
      if (!next) {
        setNotice('The clipboard does not hold contour settings')
        return
      }
      e.preventDefault()
      apply(next)
      setNotice(`Loaded seed ${seedLabel(next.seed)}`)
    }

    window.addEventListener('keydown', onKey)
    window.addEventListener('copy', onCopy)
    window.addEventListener('paste', onPaste)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('copy', onCopy)
      window.removeEventListener('paste', onPaste)
    }
  })

  return (
    <div className="lab" style={{ '--lab-accent': accent } as CSSProperties}>
      <div className="lab-stage" ref={stage}>
        <header className="lab-bar">
          <div className="lab-id">
            <span className="lab-id-mode">{mode.name}</span>
            <span className="lab-id-seed">seed {seedLabel(config.seed)}</span>
          </div>
          <p className="lab-hint">
            Click the canvas for a new one <span>· ← → history · F fullscreen · ⌘C ⌘V settings</span>
          </p>
          <div className="lab-bar-actions">
            <button type="button" className="lab-icon" onClick={back} disabled={!past.length} aria-label="Previous composition">
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M10 3 5 8l5 5" />
              </svg>
            </button>
            <button type="button" className="lab-icon" onClick={forward} disabled={!future.length} aria-label="Next composition">
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="m6 3 5 5-5 5" />
              </svg>
            </button>
            <button type="button" className="lab-icon" onClick={toggleFullscreen} aria-label="Fullscreen">
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10" />
              </svg>
            </button>
          </div>
        </header>

        <div className="lab-canvas">
          <ContourCanvas config={config} epoch={epoch} onClick={regenerate} />
        </div>

        <footer className="lab-rail" aria-label="Saved settings">
          {saved.length ? (
            saved.map((entry) => (
              <button
                key={entry.path}
                type="button"
                className="lab-thumb"
                title={entry.path}
                style={{ aspectRatio: ASPECTS[entry.config.aspect] }}
                onClick={() => {
                  apply(entry.config)
                  setNotice(`Loaded ${entry.path}`)
                }}
              >
                <ContourCanvas config={entry.config} animate={false} />
              </button>
            ))
          ) : (
            <p className="lab-rail-empty">Saved settings collect here. Click one to bring it back.</p>
          )}
        </footer>
      </div>

      <aside className="lab-panel">
        <div className="lab-scroll">
          <div className="lab-modes" role="group" aria-label="Field">
            {MODE_IDS.map((id) => (
              <button
                key={id}
                type="button"
                className="lab-mode"
                aria-pressed={id === config.mode}
                onClick={() => update((c) => ({ ...c, mode: id }))}
              >
                {MODES[id].name}
                <small>{MODES[id].latin}</small>
              </button>
            ))}
          </div>
          <p className="lab-blurb">{mode.blurb}</p>

          <section className="lab-section">
            <SectionHead title={mode.name} active={config.drift.field} onToggle={() => toggleDrift('field')} />
            <div className="lab-knobs">
              {mode.params.map((spec) => {
                const id = fieldKnob(mode.id, spec.key)
                const held = config.held.includes(id)
                return (
                  <Knob
                    key={id}
                    label={spec.label}
                    value={shown.modes[mode.id][spec.key]}
                    min={spec.min}
                    max={spec.max}
                    step={spec.step}
                    defaultValue={spec.value}
                    dial={spec.dial}
                    unit={spec.unit}
                    drifting={config.drift.field && drifts(spec) && !held}
                    held={held}
                    onHeldChange={drifts(spec) ? (h) => setHeld(id, h) : undefined}
                    onChange={(v) => setParam(spec.key, v)}
                  />
                )
              })}
            </div>
          </section>

          {SECTIONS.map((section) => (
            <section key={section.id} className="lab-section">
              <SectionHead
                title={section.title}
                active={section.drift && config.drift[section.drift]}
                onToggle={section.drift && (() => toggleDrift(section.drift!))}
              />
              {section.id === 'light' && (
                <div className="lab-field">
                  <span className="lab-field-label">
                    {palette.name} <span>{palette.note}</span>
                  </span>
                  <div className="lab-swatches" role="group" aria-label="Palette">
                    {PALETTE_IDS.map((id) => (
                      <button
                        key={id}
                        type="button"
                        className="lab-swatch"
                        aria-pressed={id === config.palette}
                        aria-label={PALETTES[id].name}
                        title={PALETTES[id].name}
                        style={{ background: PALETTES[id].bg }}
                        onClick={() => update((c) => ({ ...c, palette: id }))}
                      >
                        <i style={{ background: PALETTES[id].line }} />
                        <i style={{ background: PALETTES[id].accent }} />
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {section.id === 'grid' && (
                <Segmented
                  label="Aspect"
                  options={ASPECT_IDS}
                  value={config.aspect}
                  onChange={(aspect) => update((c) => ({ ...c, aspect }))}
                />
              )}
              <div className="lab-knobs">
                {GLOBAL_PARAMS.filter((spec) => spec.section === section.id).map((spec) => (
                  <Knob
                    key={spec.key}
                    label={spec.label}
                    value={shown[spec.key]}
                    min={spec.min}
                    max={spec.max}
                    step={spec.step}
                    defaultValue={spec.value}
                    dial={spec.dial}
                    unit={spec.unit}
                    idle={mode.ignores?.includes(spec.key)}
                    drifting={!!section.drift && config.drift[section.drift] && drifts(spec) && !config.held.includes(spec.key)}
                    held={config.held.includes(spec.key)}
                    onHeldChange={section.drift && drifts(spec) ? (h) => setHeld(spec.key, h) : undefined}
                    onChange={(v) => setGlobal(spec.key, v)}
                  />
                ))}
              </div>
              {section.id === 'light' && (
                <Segmented
                  label="Tint"
                  options={TINT_STYLES}
                  value={config.tintStyle}
                  onChange={(tintStyle) => update((c) => ({ ...c, tintStyle }))}
                />
              )}
              {section.id === 'motion' && (
                <p className="lab-note">Tempo and Range set how fast and how far every randomly animated section wanders.</p>
              )}
            </section>
          ))}
        </div>

        <div className="lab-actions">
          <button type="button" className="lab-btn lab-btn-primary" onClick={copy}>
            Copy settings
          </button>
          <button type="button" className="lab-btn" onClick={save}>
            Save
          </button>
          <button type="button" className="lab-btn" onClick={exportPng}>
            PNG
          </button>
        </div>
        <p className="lab-notice" aria-live="polite">
          {notice}
        </p>
      </aside>
    </div>
  )
}
