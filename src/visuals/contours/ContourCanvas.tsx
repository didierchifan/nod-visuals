import { useEffect, useRef, type ComponentProps } from 'react'
import { isMoving } from './drift.ts'
import { renderContours } from './render.ts'
import type { ContourConfig } from './types.ts'

interface ContourCanvasProps extends Omit<ComponentProps<'canvas'>, 'children'> {
  config: ContourConfig
  /** performance.now() at which the config holds exactly. Flow and drift are measured from here. */
  epoch?: number
  /** Let flow and drifting knobs move the picture. Off renders the config as a still. */
  animate?: boolean
}

/** Fills its box, letterboxed in the palette background so every cell stays square. */
export function ContourCanvas({ config, epoch = 0, animate = true, style, ...props }: ContourCanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const moving = animate && isMoving(config)
    const draw = () => {
      const time = moving ? (performance.now() - epoch) / 1000 : 0
      renderContours(ctx, config, canvas.width, canvas.height, time)
    }
    const fit = () => {
      const dpr = window.devicePixelRatio || 1
      const width = Math.max(1, Math.round(canvas.clientWidth * dpr))
      const height = Math.max(1, Math.round(canvas.clientHeight * dpr))
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
      }
      draw()
    }

    const observer = new ResizeObserver(fit)
    observer.observe(canvas)
    fit()

    let frame = 0
    if (moving) {
      const tick = () => {
        draw()
        frame = requestAnimationFrame(tick)
      }
      frame = requestAnimationFrame(tick)
    }
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [config, epoch, animate])

  return <canvas ref={ref} style={{ display: 'block', width: '100%', height: '100%', ...style }} {...props} />
}
