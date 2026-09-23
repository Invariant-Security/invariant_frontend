import { Suspense, lazy, useEffect, useState } from 'react'

// Lazy-loaded on purpose: each page's CSS uses generic class names that
// collide across pages (see Demo.jsx's own comment) -- static imports of
// all of them would put every stylesheet in the same bundle regardless of
// route, so whichever loaded last would win everywhere.
const Demo = lazy(() => import('./pages/Demo.jsx'))
const Home = lazy(() => import('./pages/Home.jsx'))
const Historia = lazy(() => import('./pages/Historia.jsx'))
const Setup = lazy(() => import('./pages/Setup.jsx'))
const Login = lazy(() => import('./pages/Login.jsx'))
const Endpoints = lazy(() => import('./pages/Endpoints.jsx'))
const Containers = lazy(() => import('./pages/Containers.jsx'))

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8000'

// /setup, /login, /endpoints, /containers são as telas do "console"
// autenticado do appliance (bootstrap de admin -> login -> cadastro de
// endpoints / containers Docker deste host) -- distintas de /demo e /
// (Home), que continuam públicas, sem auth nenhuma.
const CONSOLE_PATHS = new Set(['/setup', '/login', '/endpoints', '/containers'])

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
// plain <a> tags that reload the page. Within the console's screens, which
// one actually renders is decided by auth state (authGate below), not by
// the literal pathname -- e.g. hitting /setup or /login while logged out
// shows the matching screen in place, no client-side redirect needed.
//
// /containers and /endpoints are the two exceptions: each is also a public
// demo entry point (Home.jsx's "Explorar demo" -- Docker Demo Lab and LXD
// Linux Demo Lab respectively), so neither ever shows the forced
// Login/Setup wall -- an anonymous visitor gets <Containers isVisitor>/
// <Endpoints isVisitor> directly (they fetch the sanitized GET
// /demo-snapshot / GET /demo-host-snapshot instead of the real, now-
// authenticated /api/containers / /api/endpoints). `showAuthScreen` only
// flips to true when the visitor clicks the discreet "Entrar" button in
// either page's header -- that's the sole path to seeing Login/Setup on
// these two routes.
export default function App() {
  const path = window.location.pathname
  const isConsoleRoute = CONSOLE_PATHS.has(path)
  const isContainersRoute = path === '/containers'
  const isEndpointsRoute = path === '/endpoints'

  // null = ainda checando; {mode: 'setup'|'login'} = não autenticado;
  // {mode: 'authed', username} = sessão válida.
  const [authGate, setAuthGate] = useState(null)
  const [showAuthScreen, setShowAuthScreen] = useState(false)

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
    setShowAuthScreen(false)
  }

  function handleLogout() {
    apiFetch('/auth/logout', { method: 'POST' }).finally(() => setAuthGate({ mode: 'login' }))
  }

  return (
    <Suspense fallback={null}>
      {!isConsoleRoute &&
        (path === '/demo' ? <Demo /> : path === '/nossa-historia' ? <Historia /> : <Home />)}

      {isEndpointsRoute && showAuthScreen && authGate?.mode === 'setup' && (
        <Setup apiFetch={apiFetch} onAuthenticated={handleAuthenticated} />
      )}
      {isEndpointsRoute && showAuthScreen && authGate?.mode === 'login' && (
        <Login apiFetch={apiFetch} onAuthenticated={handleAuthenticated} />
      )}
      {isEndpointsRoute && authGate?.mode === 'authed' && (
        <Endpoints apiFetch={apiFetch} username={authGate.username} onLogout={handleLogout} />
      )}
      {isEndpointsRoute && authGate?.mode !== 'authed' && !(showAuthScreen && (authGate?.mode === 'setup' || authGate?.mode === 'login')) && (
        <Endpoints apiFetch={apiFetch} isVisitor onRequestLogin={() => setShowAuthScreen(true)} />
      )}

      {isContainersRoute && showAuthScreen && authGate?.mode === 'setup' && (
        <Setup apiFetch={apiFetch} onAuthenticated={handleAuthenticated} />
      )}
      {isContainersRoute && showAuthScreen && authGate?.mode === 'login' && (
        <Login apiFetch={apiFetch} onAuthenticated={handleAuthenticated} />
      )}
      {isContainersRoute && authGate?.mode === 'authed' && (
        <Containers apiFetch={apiFetch} username={authGate.username} onLogout={handleLogout} />
      )}
      {isContainersRoute && authGate?.mode !== 'authed' && !(showAuthScreen && (authGate?.mode === 'setup' || authGate?.mode === 'login')) && (
        <Containers apiFetch={apiFetch} isVisitor onRequestLogin={() => setShowAuthScreen(true)} />
      )}
    </Suspense>
  )
}
