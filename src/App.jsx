import { Suspense, lazy } from 'react'

// Lazy-loaded on purpose: Home.css and Demo.css both use generic class
// names (.site-header, .desktop-nav, ...) that collide -- static imports
// of both pages put both stylesheets in the same bundle regardless of
// route, so whichever CSS loaded last would win on both pages. Splitting
// into separate chunks means only the active page's CSS ever gets injected.
const Demo = lazy(() => import('./pages/Demo.jsx'))
const Home = lazy(() => import('./pages/Home.jsx'))

// No router library on purpose (matches this project's 2-dependency
// footprint) -- just two pages, navigated via plain <a> tags that reload
// the page. nginx.conf already does `try_files $uri /index.html`, so a
// hard refresh on /demo works without any extra server config.
export default function App() {
  return (
    <Suspense fallback={null}>
      {window.location.pathname === '/demo' ? <Demo /> : <Home />}
    </Suspense>
  )
}
