import { useEffect } from 'react'
import {
  BrowserRouter,
  HashRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
} from 'react-router-dom'
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
    // Keep embed=1 in the real query string; HashRouter only owns the hash path.
    navigate('/editor', { replace: true })
  }, [navigate])
  return null
}

function AppRoutes() {
  useKeyboardShortcuts()
  const embed = isEmbedMode()

  return (
    <>
      {embed ? <EmbedBootstrap /> : null}
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={embed ? <Navigate to="/editor" replace /> : <Dashboard />} />
          <Route path="new" element={<Navigate to="/" replace />} />
          <Route path="editor" element={<Editor />} />
          {!embed ? (
            <>
              <Route path="components" element={<Components />} />
              <Route path="deploy" element={<Deploy />} />
              <Route path="settings" element={<Settings />} />
            </>
          ) : null}
          <Route path="*" element={embed ? <Navigate to="/editor" replace /> : <NotFound />} />
        </Route>
      </Routes>
    </>
  )
}

export function App() {
  const embed = isEmbedMode()
  const basename =
    import.meta.env.BASE_URL === '/'
      ? undefined
      : String(import.meta.env.BASE_URL).replace(/\/$/, '')

  // HashRouter in embed mode so Caddy SPA fallback cannot replace OpenPage with the
  // dashboard index.html when the iframe path becomes /openpage/editor.
  return (
    <ErrorBoundary>
      {embed ? (
        <HashRouter>
          <AppRoutes />
        </HashRouter>
      ) : (
        <BrowserRouter basename={basename}>
          <AppRoutes />
        </BrowserRouter>
      )}
    </ErrorBoundary>
  )
}
