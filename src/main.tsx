import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import ContourLab from './lab/contours/ContourLab.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ContourLab />
  </StrictMode>,
)
