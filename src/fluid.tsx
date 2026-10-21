import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import FluidLab from './lab/fluid/FluidLab.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FluidLab />
  </StrictMode>,
)
