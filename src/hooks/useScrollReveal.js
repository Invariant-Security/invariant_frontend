import { useEffect, useRef } from 'react'

// Adds a `.is-visible` class the first time the element enters the
// viewport -- CSS (index.css) does the actual 200ms opacity/transform
// transition. No-ops instantly if the user asked for reduced motion,
// per ideas.md's animation spec.
export function useScrollReveal() {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.classList.add('is-visible')
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('is-visible')
          observer.disconnect()
        }
      },
      { threshold: 0.15 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return ref
}
