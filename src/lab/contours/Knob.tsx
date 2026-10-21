import { useRef, type KeyboardEvent, type PointerEvent } from 'react'

interface KnobProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  defaultValue: number
  /** Turns all the way round and wraps, for angles and phase. */
  dial?: boolean
  unit?: string
  /** Turning this knob does nothing right now, like a field that ignores it. */
  idle?: boolean
  /** Being turned by Randomly animate. */
  drifting?: boolean
  /** Kept still by its DNA (do not animate) box. */
  held?: boolean
  /** Shows the DNA box; leave out for knobs that never animate. */
  onHeldChange?(held: boolean): void
  onChange(value: number): void
}

const SIZE = 40
const R = 15
const SWEEP = 270

function polar(deg: number, r = R) {
  const a = (deg * Math.PI) / 180
  return [SIZE / 2 + r * Math.sin(a), SIZE / 2 - r * Math.cos(a)] as const
}

function arc(from: number, to: number) {
  if (to - from >= 359.99) to = from + 359.99
  const [x0, y0] = polar(from)
  const [x1, y1] = polar(to)
  return `M ${x0} ${y0} A ${R} ${R} 0 ${to - from > 180 ? 1 : 0} 1 ${x1} ${y1}`
}

function decimals(step: number) {
  const s = String(step)
  return s.includes('.') ? s.length - s.indexOf('.') - 1 : 0
}

/** Drag up or right to turn. Shift for fine, double-click to reset, arrows when focused. */
export function Knob({
  label,
  value,
  min,
  max,
  step,
  defaultValue,
  dial,
  unit,
  idle,
  drifting,
  held,
  onHeldChange,
  onChange,
}: KnobProps) {
  const drag = useRef<{ x: number; y: number; raw: number } | null>(null)
  const span = max - min
  const places = decimals(step)

  const settle = (raw: number) => {
    let v = dial ? min + ((((raw - min) % span) + span) % span) : Math.min(max, Math.max(min, raw))
    v = Math.round((v - min) / step) * step + min
    if (dial && v >= max) v = min
    return Number(v.toFixed(places))
  }

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, y: e.clientY, raw: value }
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d) return
    const delta = e.clientX - d.x + (d.y - e.clientY)
    d.x = e.clientX
    d.y = e.clientY
    d.raw += (delta / (e.shiftKey ? 1600 : 200)) * span
    if (!dial) d.raw = Math.min(max, Math.max(min, d.raw))
    const next = settle(d.raw)
    if (next !== value) onChange(next)
  }
  const onPointerUp = () => {
    drag.current = null
  }
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const big = Math.max(step, Number((span / 10).toFixed(places)))
    const moves: Record<string, number> = {
      ArrowUp: step,
      ArrowRight: step,
      ArrowDown: -step,
      ArrowLeft: -step,
      PageUp: big,
      PageDown: -big,
    }
    if (e.key in moves) onChange(settle(value + moves[e.key] * (e.shiftKey ? 10 : 1)))
    else if (e.key === 'Home') onChange(min)
    else if (e.key === 'End') onChange(dial ? settle(max - step) : max)
    else return
    e.preventDefault()
    e.stopPropagation()
  }

  const t = span > 0 ? (value - min) / span : 0
  const start = dial ? 0 : -SWEEP / 2
  const angle = start + t * (dial ? 360 : SWEEP)
  const [px, py] = polar(angle, R - 5)
  const [qx, qy] = polar(angle, R - 11)
  const shown = `${value.toFixed(places)}${unit ?? ''}`

  const dialEl = (
    <div
      className="knob"
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={shown}
      data-idle={idle || undefined}
      data-drifting={drifting || undefined}
      title={idle ? `${label} has no effect here` : 'Drag to turn · Shift for fine · Double-click to reset'}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={() => onChange(defaultValue)}
      onKeyDown={onKeyDown}
    >
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
        {dial ? (
          <circle className="knob-track" cx={SIZE / 2} cy={SIZE / 2} r={R} />
        ) : (
          <path className="knob-track" d={arc(start, start + SWEEP)} />
        )}
        {t > 0 && <path className="knob-fill" d={arc(start, angle)} />}
        <line className="knob-pointer" x1={qx} y1={qy} x2={px} y2={py} />
      </svg>
      <span className="knob-value">{shown}</span>
      <span className="knob-label">{label}</span>
    </div>
  )

  if (!onHeldChange) return dialEl
  return (
    <div className="knob-cell">
      {dialEl}
      <label className="knob-hold" title="Do not animate">
        <input
          type="checkbox"
          checked={held}
          aria-label={`Do not animate ${label}`}
          onChange={(e) => onHeldChange(e.target.checked)}
        />
        DNA
      </label>
    </div>
  )
}
