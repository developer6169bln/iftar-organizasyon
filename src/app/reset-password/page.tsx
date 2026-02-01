'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!token) {
      setMessage({ type: 'error', text: 'Ungültiger Link. Bitte fordern Sie einen neuen Link an.' })
    }
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)
    if (!token) return
    if (password !== confirmPassword) {
      setMessage({ type: 'error', text: 'Die Passwörter stimmen nicht überein.' })
      return
    }
    if (password.length < 6) {
      setMessage({ type: 'error', text: 'Passwort muss mindestens 6 Zeichen haben.' })
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || 'Passwort konnte nicht geändert werden.' })
        setLoading(false)
        return
      }
      setMessage({ type: 'success', text: data.message || 'Passwort wurde geändert.' })
      setTimeout(() => router.push('/login'), 2000)
    } catch {
      setMessage({ type: 'error', text: 'Anfrage fehlgeschlagen. Bitte später erneut versuchen.' })
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
            Ungültiger Link. Bitte fordern Sie einen neuen Link zum Zurücksetzen an.
          </div>
          <div className="mt-6 text-center">
            <Link href="/forgot-password" className="font-medium text-indigo-600 hover:text-indigo-500">
              Neuen Link anfordern
            </Link>
            <span className="mx-2 text-gray-400">|</span>
            <Link href="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
              Zum Login
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Neues Passwort setzen</h1>
          <p className="mt-2 text-gray-600">Wählen Sie ein neues Passwort (mindestens 6 Zeichen).</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {message && (
            <div
              className={`rounded-lg p-3 text-sm ${
                message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
              }`}
            >
              {message.text}
            </div>
          )}

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Neues Passwort
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
              placeholder="••••••••"
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
              Passwort bestätigen
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {loading ? 'Wird gespeichert…' : 'Passwort speichern'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm">
          <Link href="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
            ← Zurück zum Login
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
          <p className="text-gray-500">Laden…</p>
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  )
}
