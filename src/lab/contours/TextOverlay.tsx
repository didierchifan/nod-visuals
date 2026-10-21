import { useEffect, useRef, useState, type PointerEvent } from 'react'
import type { FrameOf } from '../../visuals/frame.ts'
import { colorOf, fontOf, glowOf, linesOf, weightOf, type TextColors, type TextLayer } from '../../visuals/text/text.ts'

/** Screen pixels from the frame's centre lines within which a dragged text lands on them. */
const SNAP = 6

const unit = (v: number) => Math.min(1, Math.max(0, v))

interface TextOverlayProps {
  frameOf: FrameOf
  texts: TextLayer[]
  colors: TextColors
  selected: string | null
  onSelect(id: string): void
  onMove(id: string, x: number, y: number): void
  onEdit(): void
}

/** Lays the texts over exactly the picture, clipped to it like the PNG, and lets them be dragged. */
export function TextOverlay({ frameOf, texts, colors, selected, onSelect, onMove, onEdit }: TextOverlayProps) {
  const ref = useRef<HTMLDivElement>(null)
  const drag = useRef<{ id: string; clientX: number; clientY: number; x: number; y: number } | null>(null)
  const [box, setBox] = useState({ width: 0, height: 0 })
  const [snapped, setSnapped] = useState({ x: false, y: false })

  useEffect(() => {
    const el = ref.current!
    const observer = new ResizeObserver(() => setBox({ width: el.clientWidth, height: el.clientHeight }))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const frame = frameOf(box.width, box.height)

  const onPointerDown = (e: PointerEvent<HTMLDivElement>, text: TextLayer) => {
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { id: text.id, clientX: e.clientX, clientY: e.clientY, x: text.x, y: text.y }
    onSelect(text.id)
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d) return
    const x = unit(d.x + (e.clientX - d.clientX) / frame.width)
    const y = unit(d.y + (e.clientY - d.clientY) / frame.height)
    const snap = {
      x: !e.altKey && Math.abs(x - 0.5) * frame.width < SNAP,
      y: !e.altKey && Math.abs(y - 0.5) * frame.height < SNAP,
    }
    setSnapped(snap)
    onMove(d.id, snap.x ? 0.5 : x, snap.y ? 0.5 : y)
  }
  const onPointerUp = () => {
    drag.current = null
    setSnapped({ x: false, y: false })
  }

  return (
    <div className="lab-overlay" ref={ref}>
      {box.width > 0 && (
        <div className="lab-frame" style={frame}>
          {texts.map((text) => {
            const color = colorOf(text, colors)
            return (
              <div
                key={text.id}
                className="lab-text"
                tabIndex={0}
                data-selected={text.id === selected || undefined}
                title="Drag anywhere · Alt to skip snapping · Double-click to edit"
                style={{
                  left: `${text.x * 100}%`,
                  top: `${text.y * 100}%`,
                  transform: `translate(-50%, -50%) rotate(${text.rotation}deg)`,
                  color,
                  opacity: text.opacity,
                  fontFamily: fontOf(text).family,
                  fontWeight: weightOf(text),
                  fontStyle: text.italic ? 'italic' : 'normal',
                  fontSize: (text.size / 100) * frame.height,
                  lineHeight: text.leading,
                  letterSpacing: `${text.tracking}em`,
                  textAlign: text.align,
                  textShadow: text.glow > 0 ? `0 0 ${glowOf(text)}em ${color}` : undefined,
                }}
                onFocus={() => onSelect(text.id)}
                onPointerDown={(e) => onPointerDown(e, text)}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                onDoubleClick={onEdit}
              >
                {linesOf(text).map((line, i) => (
                  <span key={i} className="lab-text-line">
                    {line}
                  </span>
                ))}
              </div>
            )
          })}
          {snapped.x && <i className="lab-guide lab-guide-x" />}
          {snapped.y && <i className="lab-guide lab-guide-y" />}
        </div>
      )}
    </div>
  )
}
