import { useEffect, useImperativeHandle, useRef, type Ref } from 'react'
import type { FluidConfig } from './config.ts'
import { createWater, type Water } from './water.ts'

export type FluidView = Pick<Water, 'capture' | 'resetView'>

interface FluidCanvasProps {
  config: FluidConfig
  ref?: Ref<FluidView>
  onClick?(): void
}

/** Fills its box, the picture letterboxed to the config's aspect. Drag to orbit, scroll to dolly, right-drag to pan. */
export function FluidCanvas({ config, ref, onClick }: FluidCanvasProps) {
  const box = useRef<HTMLDivElement>(null)
  const water = useRef<Water | null>(null)

  // Each mount makes its own canvas, so a remount never inherits a context the last one lost.
  useEffect(() => {
    const created = createWater(box.current!)
    water.current = created
    return () => {
      created.dispose()
      water.current = null
    }
  }, [])

  useEffect(() => water.current?.apply(config), [config])

  useImperativeHandle(
    ref,
    () => ({
      capture: () => water.current!.capture(),
      resetView: () => water.current?.resetView(),
    }),
    [],
  )

  return <div ref={box} style={{ position: 'absolute', inset: 0 }} onClick={onClick} />
}
