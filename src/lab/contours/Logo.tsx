import { useEffect, useRef, useState, type PointerEvent } from 'react'
import type { FrameOf } from '../../visuals/frame.ts'
import type { TextColor, TextColors } from '../../visuals/text/text.ts'
import { DEFAULT_LOGO, type LogoPlacement } from './lab.ts'

interface LogoProps {
  frameOf: FrameOf
  placement: LogoPlacement
  color: TextColor
  colors: TextColors
  onSelect(): void
  onChange(placement: LogoPlacement): void
}

/** Width over height of public/nod-logo.svg. */
const RATIO = 519 / 263
const MIN_WIDTH = 0.04

/** Which way each corner handle points, x then y. */
const CORNERS = { nw: [-1, -1], ne: [1, -1], sw: [-1, 1], se: [1, 1] } as const
type Corner = keyof typeof CORNERS

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** Keeps the whole logo inside a picture `aspect` wide for every unit high. */
function fit({ x, y, width }: LogoPlacement, aspect: number): LogoPlacement {
  const w = clamp(width, MIN_WIDTH, Math.min(1, RATIO / aspect))
  const h = (w * aspect) / RATIO
  return { x: clamp(x, w / 2, 1 - w / 2), y: clamp(y, h / 2, 1 - h / 2), width: w }
}

/** The NOD logo over the picture. Drag to move, drag a corner to resize, double-click to reset. */
export function Logo({ frameOf, placement, color, colors, onSelect, onChange }: LogoProps) {
  const ref = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; y: number; start: LogoPlacement; corner?: Corner } | null>(null)
  const [box, setBox] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const el = ref.current!
    const observer = new ResizeObserver(() => setBox({ width: el.clientWidth, height: el.clientHeight }))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const frame = frameOf(box.width, box.height)
  const aspect = frame.height ? frame.width / frame.height : 1
  const { x, y, width } = fit(placement, aspect)

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    const target = e.target as HTMLElement
    // Captured on the handle itself, so its resize cursor stays put for the whole drag.
    target.setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, y: e.clientY, start: { x, y, width }, corner: target.dataset.corner as Corner | undefined }
    onSelect()
  }

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d) return
    // Measured in picture heights, so both axes share a unit.
    const dx = (e.clientX - d.x) / frame.height
    const dy = (e.clientY - d.y) / frame.height
    const { start } = d
    if (!d.corner) {
      onChange(fit({ x: start.x + dx / aspect, y: start.y + dy, width: start.width }, aspect))
      return
    }
    // The opposite corner stays put; this one follows the pointer along the logo's diagonal.
    const [sx, sy] = CORNERS[d.corner]
    const w0 = start.width * aspect
    const ax = start.x * aspect - (sx * w0) / 2
    const ay = start.y - (sy * w0) / RATIO / 2
    const reach = Math.min(sx > 0 ? aspect - ax : ax, (sy > 0 ? 1 - ay : ay) * RATIO)
    const w = clamp(w0 + (sx * dx + (sy * dy) / RATIO) / (1 + 1 / RATIO ** 2), MIN_WIDTH * aspect, reach)
    onChange(fit({ x: (ax + (sx * w) / 2) / aspect, y: ay + (sy * w) / RATIO / 2, width: w / aspect }, aspect))
  }

  const onPointerUp = () => {
    drag.current = null
  }

  return (
    <div className="lab-logo-layer" ref={ref}>
      {box.width > 0 && (
        <div className="lab-logo-frame" style={frame}>
          <div
            className="lab-logo"
            role="img"
            aria-label="NOD"
            style={{ left: `${x * 100}%`, top: `${y * 100}%`, width: `${width * 100}%` }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onDoubleClick={() => onChange(DEFAULT_LOGO)}
          >
            <span
              className="lab-logo-mark"
              style={{ background: color === 'line' || color === 'accent' ? colors[color] : color }}
            />
            {(Object.keys(CORNERS) as Corner[]).map((corner) => (
              <span key={corner} className="lab-logo-handle" data-corner={corner} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
