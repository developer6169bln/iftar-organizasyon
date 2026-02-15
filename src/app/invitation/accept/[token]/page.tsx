'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

type PublicInfo = {
  guestName: string
  eventTitle: string
  maxAccompanyingGuests: number
  alreadyAccepted: boolean
}

type AccompanyingGuestEntry = {
  firstName: string
  lastName: string
  funktion: string
  email: string
}

type CheckInTokenEntry = {
  label: string
  token: string
  type: 'main' | 'accompanying'
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
  const [showQrPage, setShowQrPage] = useState(false)
  const [checkInTokens, setCheckInTokens] = useState<CheckInTokenEntry[]>([])
  const [redirectUrl, setRedirectUrl] = useState('')
  const [eventTitle, setEventTitle] = useState('')
  const [sendingPdfEmail, setSendingPdfEmail] = useState(false)
  const [pdfEmailMessage, setPdfEmailMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

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
          setRedirectUrl(data.redirectUrl || '/invitation/success?type=accepted')
          setEventTitle(data.eventTitle || info.eventTitle || '')
          if (Array.isArray(data.checkInTokens) && data.checkInTokens.length > 0) {
            setCheckInTokens(data.checkInTokens)
            setShowQrPage(true)
          } else {
            window.location.href = data.redirectUrl || '/invitation/success?type=accepted'
          }
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

  if (showQrPage && checkInTokens.length > 0) {
    const base = typeof window !== 'undefined' ? window.location.origin : ''
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50 p-4">
        <div className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-xl">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <svg className="h-10 w-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="mb-2 text-xl font-bold text-gray-900">Vielen Dank für Ihre Teilnahme!</h1>
            <p className="mb-4 text-gray-600">
              Bitte zeigen Sie am Eventtag beim Einlass Ihren QR-Code zum Scannen. Jede Person hat einen eigenen Code.
            </p>
            {eventTitle && <p className="text-sm text-gray-500">{eventTitle}</p>}
          </div>
          <div className="space-y-6">
            {checkInTokens.map((entry, idx) => (
              <div key={entry.token} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <p className="mb-2 text-sm font-medium text-gray-700">
                  {entry.type === 'main' ? 'Hauptgast' : 'Begleitperson'} – {entry.label}
                </p>
                <div className="flex justify-center">
                  <img
                    src={`${base}/api/checkin/qr?t=${encodeURIComponent(entry.token)}`}
                    alt={`QR-Code für ${entry.label}`}
                    className="h-48 w-48 rounded border border-gray-300 bg-white object-contain"
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-8 flex flex-col items-center gap-4">
            <div className="flex flex-wrap justify-center gap-3">
              <a
                href={`${typeof window !== 'undefined' ? window.location.origin : ''}/api/invitations/accept/${encodeURIComponent(token)}/qr-pdf`}
                download="Check-in-Eventinformationen.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 font-medium text-white hover:bg-emerald-700"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                PDF herunterladen
              </a>
              <button
                type="button"
                disabled={sendingPdfEmail}
                onClick={async () => {
                  setPdfEmailMessage(null)
                  setSendingPdfEmail(true)
                  try {
                    const res = await fetch(`/api/invitations/accept/${encodeURIComponent(token)}/send-qr-pdf`, {
                      method: 'POST',
                    })
                    const data = await res.json()
                    if (res.ok && data.success) {
                      setPdfEmailMessage({ type: 'success', text: data.message || 'PDF wurde an Ihre E-Mail gesendet.' })
                    } else {
                      setPdfEmailMessage({ type: 'error', text: data.error || 'E-Mail konnte nicht gesendet werden.' })
                    }
                  } catch (e) {
                    setPdfEmailMessage({ type: 'error', text: e instanceof Error ? e.message : 'Fehler beim Senden.' })
                  } finally {
                    setSendingPdfEmail(false)
                  }
                }}
                className="inline-flex items-center gap-2 rounded-lg border-2 border-indigo-600 bg-white px-5 py-2.5 font-medium text-indigo-600 hover:bg-indigo-50 disabled:opacity-50"
              >
                {sendingPdfEmail ? (
                  <>
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                    Wird gesendet …
                  </>
                ) : (
                  <>
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    PDF per E-Mail senden
                  </>
                )}
              </button>
            </div>
            {pdfEmailMessage && (
              <p className={`text-sm ${pdfEmailMessage.type === 'success' ? 'text-green-700' : 'text-red-700'}`}>
                {pdfEmailMessage.text}
              </p>
            )}
            <button
              type="button"
              onClick={() => (window.location.href = redirectUrl)}
              className="rounded-lg bg-indigo-600 px-6 py-3 font-medium text-white hover:bg-indigo-700"
            >
              Weiter
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50 p-4">
      <div className="invitation-form w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
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
                      className="rounded border border-gray-300 px-3 py-2 text-sm"
                    />
                    <input
                      placeholder="Nachname"
                      value={ag.lastName}
                      onChange={(e) => updateAccompanying(idx, 'lastName', e.target.value)}
                      className="rounded border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <input
                    placeholder="Funktion / Rolle"
                    value={ag.funktion}
                    onChange={(e) => updateAccompanying(idx, 'funktion', e.target.value)}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  />
                  <input
                    type="email"
                    placeholder="E-Mail"
                    value={ag.email}
                    onChange={(e) => updateAccompanying(idx, 'email', e.target.value)}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
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
