import Demo from './pages/Demo.jsx'
import Home from './pages/Home.jsx'

// No router library on purpose (matches this project's 2-dependency
// footprint) -- just two pages, navigated via plain <a> tags that reload
// the page. nginx.conf already does `try_files $uri /index.html`, so a
// hard refresh on /demo works without any extra server config.
export default function App() {
  return window.location.pathname === '/demo' ? <Demo /> : <Home />
}
