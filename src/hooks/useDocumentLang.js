import { useEffect } from 'react'

// index.html has no single correct `lang` -- Home.jsx's content is
// pt-BR, Demo.jsx's is English (Overview/Assessments/Evidence, all of
// it). Each page sets <html lang> to match what it actually renders,
// restored to the previous value on unmount so navigating away doesn't
// leave a stale lang behind.
export function useDocumentLang(lang) {
  useEffect(() => {
    const previous = document.documentElement.lang
    document.documentElement.lang = lang
    return () => {
      document.documentElement.lang = previous
    }
  }, [lang])
}
