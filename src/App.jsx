import { Suspense, lazy, useEffect, useState } from 'react'

// Lazy-loaded on purpose: each page's CSS uses generic class names that
// collide across pages (see Demo.jsx's own comment) -- static imports of
// all of them would put every stylesheet in the same bundle regardless of
// route, so whichever loaded last would win everywhere.
const Demo = lazy(() => import('./pages/Demo.jsx'))
const Home = lazy(() => import('./pages/Home.jsx'))
const Setup = lazy(() => import('./pages/Setup.jsx'))
const Login = lazy(() => import('./pages/Login.jsx'))
const Endpoints = lazy(() => import('./pages/Endpoints.jsx'))

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8000'

// /setup, /login, /endpoints são as 3 telas do "console" autenticado do
// appliance (bootstrap de admin -> login -> cadastro de endpoints) --
// distintas de /demo e / (Home), que continuam públicas, sem auth nenhuma.
const CONSOLE_PATHS = new Set(['/setup', '/login', '/endpoints'])

async function apiFetch(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  return response
}

// No router library on purpose (matches this project's small dependency
// footprint, see Demo.jsx's own comment) -- just path-based navigation via
// plain <a> tags that reload the page. Within the console's 3 screens,
// which one actually renders is decided by auth state (authGate below),
// not by the literal pathname -- e.g. hitting /endpoints while logged out
// shows Login in place, no client-side redirect needed.
export default function App() {
  const path = window.location.pathname
  const isConsoleRoute = CONSOLE_PATHS.has(path)

  // null = ainda checando; {mode: 'setup'|'login'} = não autenticado;
  // {mode: 'authed', username} = sessão válida.
  const [authGate, setAuthGate] = useState(null)

  useEffect(() => {
    if (!isConsoleRoute) return
    let cancelled = false

    async function checkAuth() {
      try {
        const me = await apiFetch('/auth/me')
        if (me.ok) {
          const body = await me.json()
          if (!cancelled) setAuthGate({ mode: 'authed', username: body.username })
          return
        }
        const status = await apiFetch('/auth/status')
        const body = await status.json()
        if (!cancelled) setAuthGate({ mode: body.has_admin ? 'login' : 'setup' })
      } catch {
        if (!cancelled) setAuthGate({ mode: 'error' })
      }
    }

    checkAuth()
    return () => {
      cancelled = true
    }
  }, [isConsoleRoute])

  function handleAuthenticated(username) {
    setAuthGate({ mode: 'authed', username })
  }

  function handleLogout() {
    apiFetch('/auth/logout', { method: 'POST' }).finally(() => setAuthGate({ mode: 'login' }))
  }

  return (
    <Suspense fallback={null}>
      {!isConsoleRoute && (path === '/demo' ? <Demo /> : <Home />)}

      {isConsoleRoute && authGate?.mode === 'setup' && <Setup apiFetch={apiFetch} onAuthenticated={handleAuthenticated} />}
      {isConsoleRoute && authGate?.mode === 'login' && <Login apiFetch={apiFetch} onAuthenticated={handleAuthenticated} />}
      {isConsoleRoute && authGate?.mode === 'authed' && (
        <Endpoints apiFetch={apiFetch} username={authGate.username} onLogout={handleLogout} />
      )}
      {isConsoleRoute && authGate?.mode === 'error' && (
        <p style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
          Could not reach the Invariant API at {API_BASE}. Is it running?
        </p>
      )}
    </Suspense>
  )
}
