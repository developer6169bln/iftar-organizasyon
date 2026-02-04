'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

type PublicInfo = {
  guestName: string
  eventTitle: string
  maxAccompanyingGuests: number
  alreadyAccepted: boolean
}

export default function InvitationAcceptPage() {
  const params = useParams()
  const router = useRouter()
  const token = typeof params?.token === 'string' ? params.token : ''
  const [info, setInfo] = useState<PublicInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [accompanyingGuestsCount, setAccompanyingGuestsCount] = useState(1)
  const [maxExceededWarning, setMaxExceededWarning] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!token) {
      setError('Token fehlt')
      setLoading(false)
      return
    }
    fetch(`/api/invitations/public-info/${encodeURIComponent(token)}`)
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 404 ? 'Einladung nicht gefunden' : 'Laden fehlgeschlagen')
        return res.json()
      })
      .then((data: PublicInfo) => {
        setInfo(data)
        if (data.alreadyAccepted) {
          router.replace('/invitation/success?type=accepted&already=true')
          return
        }
        setAccompanyingGuestsCount(1)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Unbekannter Fehler'))
      .finally(() => setLoading(false))
  }, [token, router])

  const max = info?.maxAccompanyingGuests ?? 5

  const handleCountChange = (value: number) => {
    setAccompanyingGuestsCount(value)
    if (value > max) {
      setMaxExceededWarning(
        `Die maximale Anzahl mitkommender Gäste ist ${max}. Bitte wählen Sie höchstens ${max}.`
      )
    } else {
      setMaxExceededWarning(null)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!token || !info || info.alreadyAccepted) return
    if (accompanyingGuestsCount > max) {
      setMaxExceededWarning(
        `Die maximale Anzahl mitkommender Gäste ist ${max}. Bitte wählen Sie höchstens ${max}.`
      )
      return
    }
    setSubmitting(true)
    setMaxExceededWarning(null)
    fetch(`/api/invitations/accept/${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accompanyingGuestsCount }),
    })
      .then(async (res) => {
        const data = await res.json()
        if (data.success && data.redirectUrl) {
          window.location.href = data.redirectUrl
          return
        }
        if (data.error && res.status === 400) {
          setMaxExceededWarning(data.error)
          if (data.maxAccompanyingGuests != null) setAccompanyingGuestsCount(data.maxAccompanyingGuests)
          return
        }
        setError(data.error || 'Fehler bei der Zusage')
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Fehler beim Senden'))
      .finally(() => setSubmitting(false))
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50 p-4">
        <div className="rounded-xl bg-white p-8 shadow-lg">
          <p className="text-gray-600">Einladung wird geladen …</p>
        </div>
      </div>
    )
  }

  if (error || !info) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50 p-4">
        <div className="rounded-xl bg-white p-8 shadow-lg">
          <p className="text-red-600">{error || 'Einladung nicht gefunden'}</p>
          <a href="/invitation/error" className="mt-4 inline-block text-indigo-600 hover:underline">
            Zur Fehlerseite
          </a>
        </div>
      </div>
    )
  }

  if (info.alreadyAccepted) {
    return null
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <h1 className="mb-2 text-xl font-bold text-gray-900">Teilnahme bestätigen</h1>
        <p className="mb-6 text-gray-600">
          Guten Tag {info.guestName}, Sie sind zu „{info.eventTitle}“ eingeladen. Bitte bestätigen Sie Ihre Teilnahme
          und geben Sie an, wie viele Personen mit Ihnen kommen.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="accompanyingGuestsCount" className="mb-1 block text-sm font-medium text-gray-700">
              Anzahl mitkommender Gäste (inkl. Sie selbst: 1)
            </label>
            <input
              id="accompanyingGuestsCount"
              type="number"
              min={1}
              max={max}
              value={accompanyingGuestsCount}
              onChange={(e) => handleCountChange(parseInt(e.target.value, 10) || 1)}
              onBlur={() => {
                if (accompanyingGuestsCount > max) {
                  setMaxExceededWarning(
                    `Die maximale Anzahl mitkommender Gäste ist ${max}. Bitte wählen Sie höchstens ${max}.`
                  )
                }
              }}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-lg focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              Maximal erlaubt: {max} mitkommende Gäste (festgelegt auf der Einladungsliste).
            </p>
            {maxExceededWarning && (
              <p className="mt-2 text-sm font-medium text-amber-700" role="alert">
                {maxExceededWarning}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting || accompanyingGuestsCount > max || accompanyingGuestsCount < 1}
            className="w-full rounded-lg bg-indigo-600 px-4 py-3 font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {submitting ? 'Wird gesendet …' : 'Teilnahme bestätigen'}
          </button>
        </form>
      </div>
    </div>
  )
}
