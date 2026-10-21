/** Where the picture sits inside the box its canvas fills, in CSS pixels. */
export interface Frame {
  left: number
  top: number
  width: number
  height: number
}

/** The picture's frame inside a `width` x `height` box. */
export type FrameOf = (width: number, height: number) => Frame
