import { Outlet, useLocation } from 'react-router-dom'
import { TopNav } from './TopNav'
import { Toaster } from 'sonner'
import { ShortcutsModal } from '@/editor/ShortcutsModal'
import { isEmbedMode } from '@/lib/embed-bridge'

export function AppLayout() {
  const location = useLocation()
  const embed = isEmbedMode()

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden">
      {!embed ? <a href="#main-content" className="skip-to-content">Skip to content</a> : null}
      {!embed ? <TopNav /> : null}
      <main
        id="main-content"
        className={`flex-1 overflow-hidden ${embed ? '' : 'mt-12'}`}
        role="main"
      >
        <div key={location.pathname} className="h-full animate-fade-in-up">
          <Outlet />
        </div>
      </main>
      <Toaster
        position="bottom-center"
        toastOptions={{
          style: {
            background: 'var(--color-bg-3)',
            border: '1px solid var(--color-border-default)',
            color: 'var(--color-text-0)',
            fontSize: '13px',
          },
        }}
      />
      {!embed ? <ShortcutsModal /> : null}
    </div>
  )
}
