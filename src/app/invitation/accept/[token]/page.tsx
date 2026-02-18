'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

type PublicInfo = {
  guestName: string
  eventTitle: string
  maxAccompanyingGuests: number
  alreadyAccepted: boolean
  alreadyDeclined?: boolean
}

type AccompanyingGuestEntry = {
  firstName: string
  lastName: string
  funktion: string
  email: string
}

export default function InvitationAcceptPage() {
  const params = useParams()
  const router = useRouter()
  const token = typeof params?.token === 'string' ? params.token : ''
  const [info, setInfo] = useState<PublicInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [accompanyingGuestsCount, setAccompanyingGuestsCount] = useState(1)
  const [accompanyingGuests, setAccompanyingGuests] = useState<AccompanyingGuestEntry[]>([])
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
        setAccompanyingGuests([])
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Unbekannter Fehler'))
      .finally(() => setLoading(false))
  }, [token, router])

  const max = info?.maxAccompanyingGuests ?? 5
  const numAdditional = Math.max(0, accompanyingGuestsCount - 1)

  useEffect(() => {
    setAccompanyingGuests((prev) => {
      const next: AccompanyingGuestEntry[] = []
      for (let i = 0; i < numAdditional; i++) {
        next.push(prev[i] ?? { firstName: '', lastName: '', funktion: '', email: '' })
      }
      return next
    })
  }, [numAdditional])

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

  const updateAccompanying = (index: number, field: keyof AccompanyingGuestEntry, value: string) => {
    setAccompanyingGuests((prev) => {
      const next = [...prev]
      if (!next[index]) next[index] = { firstName: '', lastName: '', funktion: '', email: '' }
      next[index] = { ...next[index], [field]: value }
      return next
    })
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
    const payload = {
      accompanyingGuestsCount,
      accompanyingGuests:
        numAdditional > 0
          ? accompanyingGuests.slice(0, numAdditional).map((a) => ({
              firstName: a.firstName.trim(),
              lastName: a.lastName.trim(),
              funktion: a.funktion.trim() || undefined,
              email: a.email.trim() || undefined,
            }))
          : undefined,
    }
    fetch(`/api/invitations/accept/${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(async (res) => {
        const data = await res.json()
        if (data.success) {
          // Yedek Liste: Kein QR-Code anzeigen. Admin sendet bei freiem Platz.
          window.location.href = '/invitation/success?type=accepted&yedek=true'
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

  if (info.alreadyDeclined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50 p-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
            <svg className="h-7 w-7 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="mb-2 text-xl font-bold text-gray-900">Erneute Zusage nicht möglich</h1>
          <p className="mb-6 text-gray-600">
            Sie haben bereits abgesagt. Eine erneute Zusage ist über diesen Link nicht möglich. Für eine neue Zusage
            wenden Sie sich bitte an UID Berlin.
          </p>
          <a href="/invitation/error" className="inline-block rounded-lg bg-indigo-600 px-6 py-3 font-medium text-white hover:bg-indigo-700">
            Zurück
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50 p-4">
      <div className="invitation-form w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <h1 className="mb-2 text-xl font-bold text-gray-900">Iftar - Yedek Liste</h1>
        <p className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
          İftar yemeği için kontenjanımız sınırlı olduğundan bir yedek liste oluşturduk. Yer açıldığında size onay kodunuzu ileteceğiz.
        </p>
        <p className="mb-6 text-gray-600">
          Guten Tag {info.guestName}, Sie sind zu „{info.eventTitle}“ eingeladen. Bitte bestätigen Sie Ihre Teilnahme
          und geben Sie an, wie viele Personen mit Ihnen kommen.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="accompanyingGuestsCount" className="mb-1 block text-sm font-medium text-gray-700">
              Anzahl mitkommender Gäste (inkl. Sie selbst: 1)
            </label>
            <select
              id="accompanyingGuestsCount"
              value={accompanyingGuestsCount}
              onChange={(e) => handleCountChange(parseInt(e.target.value, 10) || 1)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-lg text-black focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Maximal erlaubt: {max} mitkommende Gäste (festgelegt auf der Einladungsliste).
            </p>
            {maxExceededWarning && (
              <p className="mt-2 text-sm font-medium text-amber-700" role="alert">
                {maxExceededWarning}
              </p>
            )}
          </div>

          {numAdditional > 0 && (
            <div className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <p className="text-sm font-medium text-gray-700">
                Daten der zusätzlichen Gäste (Vorname, Nachname, Funktion, E-Mail)
              </p>
              {accompanyingGuests.slice(0, numAdditional).map((ag, idx) => (
                <div key={idx} className="space-y-2 rounded border border-gray-200 bg-white p-3">
                  <p className="text-xs font-medium text-gray-500">Gast {idx + 1}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      placeholder="Vorname"
                      value={ag.firstName}
                      onChange={(e) => updateAccompanying(idx, 'firstName', e.target.value)}
                      className="rounded border border-gray-300 px-3 py-2 text-sm text-black"
                    />
                    <input
                      placeholder="Nachname"
                      value={ag.lastName}
                      onChange={(e) => updateAccompanying(idx, 'lastName', e.target.value)}
                      className="rounded border border-gray-300 px-3 py-2 text-sm text-black"
                    />
                  </div>
                  <input
                    placeholder="Funktion / Rolle"
                    value={ag.funktion}
                    onChange={(e) => updateAccompanying(idx, 'funktion', e.target.value)}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-black"
                  />
                  <input
                    type="email"
                    placeholder="E-Mail"
                    value={ag.email}
                    onChange={(e) => updateAccompanying(idx, 'email', e.target.value)}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-black"
                  />
                </div>
              ))}
            </div>
          )}

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
