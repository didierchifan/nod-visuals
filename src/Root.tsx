import { lazy, Suspense } from 'react'

const App = lazy(() => import('./App.tsx'))
// Generator labs are dev-only scaffolding; this import drops out of production builds.
const ContourLab = import.meta.env.DEV ? lazy(() => import('./lab/contours/ContourLab.tsx')) : null

export function Root() {
  const lab = ContourLab && window.location.pathname.startsWith('/lab/contours')
  return <Suspense>{lab ? <ContourLab /> : <App />}</Suspense>
}
