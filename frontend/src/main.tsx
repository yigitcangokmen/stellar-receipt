import './polyfills'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, useParams } from 'react-router-dom'
import './styles/globals.css'
import Landing from './Landing.tsx'
import AppPage from './AppPage.tsx'
import PayPage from './PayPage.tsx'

function PayRoute() {
  const { id } = useParams<{ id: string }>()
  return <PayPage id={id ?? ''} />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/app" element={<AppPage />} />
        <Route path="/pay/:id" element={<PayRoute />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
