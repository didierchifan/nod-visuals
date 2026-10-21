import type { AspectId } from '../contours/types.ts'
import type { TextColor, TextLayer } from './text.ts'

// The NOD party poster, "WHY NØD ?" over the date and the lineup, in white JetBrains Mono.
// Both labs start from it until their texts are changed, and Default layout brings it back.

/** The shape the poster was laid out on. Positions and sizes are shares of it, so it only reads right here. */
export const POSTER_ASPECT: AspectId = '4:5'

/** The logo between WHY and ?. */
export const POSTER_LOGO = { x: 0.7105, y: 0.0786, width: 0.2417 }
export const POSTER_LOGO_COLOR: TextColor = '#ffffff'

const type: Omit<TextLayer, 'id' | 'content' | 'x' | 'y' | 'size'> = {
  font: 'mono',
  installed: '',
  italic: false,
  align: 'left',
  case: 'none',
  color: '#ffffff',
  weight: 600,
  tracking: 0.02,
  leading: 1.05,
  opacity: 1,
  glow: 0,
  rotation: 0,
}

export const POSTER_TEXTS: TextLayer[] = [
  { ...type, id: 'lineup', content: 'BOG &\nDIDIER\nDANA& \nDUMITRA\nYGOR', x: 0.2418, y: 0.7854, size: 6.5 },
  { ...type, id: 'why', content: 'WHY', x: 0.5, y: 0.0807, size: 5.5, glow: 0.03 },
  { ...type, id: 'question', content: '?', x: 0.8842, y: 0.0818, size: 5.5 },
  { ...type, id: 'title', content: 'differspective\ngeeked out\n', align: 'right', x: 0.6043, y: 0.3096, size: 5.5 },
  { ...type, id: 'date', content: '22NOV', x: 0.7986, y: 0.4471, size: 4.5, glow: 0.01 },
  { ...type, id: 'time', content: 'FROM 22', x: 0.7715, y: 0.5, size: 4.5 },
]
