'use client'

import { useState } from 'react'

export default function DeleteAccountForm(): React.ReactElement {
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/delete-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ confirm }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Could not delete your account.')
        return
      }
      window.location.assign('/login')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete your account.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3" noValidate>
      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm">{error}</div>
      )}
      <div className="flex gap-2">
        <input
          type="text"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          disabled={loading}
          autoComplete="off"
          className="flex-1 px-4 py-2 border border-input rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
          placeholder="Type DELETE"
          aria-label="Type DELETE to confirm"
        />
        <button
          type="submit"
          disabled={loading || confirm !== 'DELETE'}
          className="bg-destructive text-white px-4 py-2 rounded-lg font-medium hover:bg-destructive/90 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Deleting...' : 'Delete everything'}
        </button>
      </div>
    </form>
  )
}
