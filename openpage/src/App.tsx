import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { ErrorBoundary } from './layout/ErrorBoundary'
import { AppLayout } from './layout/AppLayout'
import { Dashboard } from './routes/Dashboard'
import { Editor } from './routes/Editor'
import { Components } from './routes/Components'
import { Deploy } from './routes/Deploy'
import { Settings } from './routes/Settings'
import { NotFound } from './routes/NotFound'
import { useKeyboardShortcuts } from './lib/useKeyboardShortcuts'
import { isEmbedMode } from './lib/embed-bridge'

function EmbedBootstrap() {
  const navigate = useNavigate()
  useEffect(() => {
    if (!isEmbedMode()) return
    navigate('/editor?embed=1', { replace: true })
  }, [navigate])
  return null
}

function AppRoutes() {
  useKeyboardShortcuts()
  const embed = isEmbedMode()

  return (
    <>
      <EmbedBootstrap />
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={embed ? <Navigate to="/editor?embed=1" replace /> : <Dashboard />} />
          <Route path="new" element={<Navigate to="/" replace />} />
          <Route path="editor" element={<Editor />} />
          {!embed ? (
            <>
              <Route path="components" element={<Components />} />
              <Route path="deploy" element={<Deploy />} />
              <Route path="settings" element={<Settings />} />
            </>
          ) : null}
          <Route path="*" element={embed ? <Navigate to="/editor?embed=1" replace /> : <NotFound />} />
        </Route>
      </Routes>
    </>
  )
}

export function App() {
  const basename =
    import.meta.env.BASE_URL === '/' ? undefined : String(import.meta.env.BASE_URL).replace(/\/$/, '')

  return (
    <ErrorBoundary>
      <BrowserRouter basename={basename}>
        <AppRoutes />
      </BrowserRouter>
    </ErrorBoundary>
  )
}
