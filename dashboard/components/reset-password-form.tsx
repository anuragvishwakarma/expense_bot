'use client'

import { useState } from 'react'

export default function ResetPasswordForm(): React.ReactElement {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password.length < 8) return setError('Password must be at least 8 characters.')
    if (password !== confirm) return setError('The two passwords do not match.')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Could not update the password.')
        return
      }
      // Hard navigation, like login: the router cache can hold a stale redirect
      window.location.assign('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the password.')
    } finally {
      setLoading(false)
    }
  }

  const input = 'w-full px-4 py-2 border border-input rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent disabled:opacity-60'
  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      {error && <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm">{error}</div>}
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-muted-foreground mb-2">New password</label>
        <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={loading} className={input} autoComplete="new-password" required />
      </div>
      <div>
        <label htmlFor="confirm" className="block text-sm font-medium text-muted-foreground mb-2">Confirm new password</label>
        <input id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} disabled={loading} className={input} autoComplete="new-password" required />
      </div>
      <button type="submit" disabled={loading} className="w-full bg-primary text-primary-foreground py-2 rounded-lg font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors">
        {loading ? 'Saving...' : 'Set new password'}
      </button>
    </form>
  )
}
