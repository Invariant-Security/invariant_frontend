import { useState } from 'react'
import './Console.css'

// Primeira tela que o admin vê depois de instalar o appliance -- não
// existe sessão nem admin ainda, então não tem header/nav, só o form.
// App.jsx só renderiza isso quando GET /auth/status já confirmou
// has_admin: false.
export default function Setup({ apiFetch, onAuthenticated }) {
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      const response = await apiFetch('/auth/setup', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.detail ?? `HTTP ${response.status}`)
      }
      const body = await response.json()
      onAuthenticated(body.username)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-card__brand">INVARIANT</div>
        <p className="auth-card__subtitle">Create the admin account to finish setting up this appliance.</p>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="username">Username</label>
            <input id="username" value={username} onChange={(e) => setUsername(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>
          <div className="field">
            <label htmlFor="confirm">Confirm password</label>
            <input
              id="confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </div>
          {error && (
            <p className="error" style={{ marginBottom: '1rem' }}>
              {error}
            </p>
          )}
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Creating…' : 'Create admin account'}
          </button>
        </form>
      </div>
    </div>
  )
}
