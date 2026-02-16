'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

type CheckInTokenEntry = { label: string; token: string; type: 'main' | 'accompanying' }

function KemalettingruppeErfolgContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [checkInTokens, setCheckInTokens] = useState<CheckInTokenEntry[]>([])
  const [eventTitle, setEventTitle] = useState('')
  const [eventId, setEventId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pdfSent, setPdfSent] = useState<boolean | null>(null)

  useEffect(() => {
    if (!token) {
      setError('Kein gültiger Link.')
      setLoading(false)
      return
    }

    const fetchTokens = async () => {
      try {
        const res = await fetch(`/api/invitations/accept/${encodeURIComponent(token)}/checkin-tokens`)
        const data = await res.json()
        if (!res.ok) {
          setError(data.error || 'Daten konnten nicht geladen werden.')
          return
        }
        setCheckInTokens(data.checkInTokens ?? [])
        setEventTitle(data.eventTitle ?? '')
        setEventId(data.eventId ?? searchParams.get('eventId') ?? '')
      } catch (e) {
        setError('Verbindungsfehler.')
      } finally {
        setLoading(false)
      }
    }

    fetchTokens()
  }, [token, searchParams])

  useEffect(() => {
    if (!token || checkInTokens.length === 0 || pdfSent !== null) return

    const sendPdf = async () => {
      try {
        const res = await fetch(`/api/invitations/accept/${encodeURIComponent(token)}/send-qr-pdf`, {
          method: 'POST',
        })
        const data = await res.json()
        setPdfSent(res.ok && data.success)
      } catch {
        setPdfSent(false)
      }
    }

    sendPdf()
  }, [token, checkInTokens.length, pdfSent])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-amber-50 to-orange-50 p-4">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
          <p className="text-gray-600">Lade Ihre Check-in-Informationen …</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-amber-50 to-orange-50 p-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="mb-2 text-xl font-bold text-gray-900">Fehler</h1>
          <p className="mb-6 text-gray-600">{error}</p>
          <a
            href={(() => {
              const eid = eventId || searchParams.get('eventId')
              return eid ? `/anmeldung/kemalettingruppe?eventId=${encodeURIComponent(eid)}` : '/anmeldung/kemalettingruppe'
            })()}
            className="inline-block rounded-lg bg-indigo-600 px-6 py-2 font-medium text-white hover:bg-indigo-700"
          >
            Zurück zur Anmeldung
          </a>
        </div>
      </div>
    )
  }

  const base = typeof window !== 'undefined' ? window.location.origin : ''

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-amber-50 to-orange-50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <svg className="h-10 w-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="mb-2 text-xl font-bold text-gray-900">Vielen Dank für Ihre Teilnahme!</h1>
          <p className="mb-4 text-gray-600">
            Bitte zeigen Sie am Eventtag beim Einlass Ihren QR-Code zum Scannen.
          </p>
          {eventTitle && <p className="text-sm text-gray-500">{eventTitle}</p>}
        </div>

        <div className="space-y-6">
          {checkInTokens.map((entry) => (
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
              href={`${base}/api/invitations/accept/${encodeURIComponent(token!)}/qr-pdf`}
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
          </div>
          {pdfSent === true && (
            <p className="text-sm text-green-700">
              Das PDF wurde an Ihre E-Mail-Adresse gesendet.
            </p>
          )}
          {pdfSent === false && (
            <p className="text-sm text-amber-700">
              Das PDF konnte nicht per E-Mail gesendet werden. Bitte laden Sie es herunter.
            </p>
          )}
          <a
            href={eventId ? `/anmeldung/kemalettingruppe?eventId=${encodeURIComponent(eventId)}` : '/anmeldung/kemalettingruppe'}
            className="rounded-lg bg-indigo-600 px-6 py-3 font-medium text-white hover:bg-indigo-700"
          >
            Weitere Anmeldung
          </a>
        </div>
      </div>
    </div>
  )
}

function LoadingFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-amber-50 to-orange-50 p-4">
      <div className="text-center">
        <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
        <p className="text-gray-600">Lade …</p>
      </div>
    </div>
  )
}

export default function KemalettingruppeErfolgPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <KemalettingruppeErfolgContent />
    </Suspense>
  )
}
