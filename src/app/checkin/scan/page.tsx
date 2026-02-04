'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'

function CheckinScanContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('t')
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [name, setName] = useState('')
  const [eventTitle, setEventTitle] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (!token?.trim()) {
      setStatus('error')
      setErrorMessage('Kein Check-in-Code vorhanden.')
      return
    }

    fetch('/api/checkin/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: token.trim() }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.name) {
          setStatus('success')
          setName(data.name)
          setEventTitle(data.eventTitle || '')
        } else {
          setStatus('error')
          setErrorMessage(data.error || 'Check-in konnte nicht durchgeführt werden.')
        }
      })
      .catch(() => {
        setStatus('error')
        setErrorMessage('Verbindungsfehler. Bitte versuchen Sie es erneut.')
      })
  }, [token])

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50 p-4">
        <div className="rounded-2xl bg-white p-8 shadow-xl text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
          <p className="text-gray-600">Check-in wird verarbeitet …</p>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50 p-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="mb-2 text-xl font-bold text-gray-900">Check-in fehlgeschlagen</h1>
          <p className="text-gray-600">{errorMessage}</p>
          <p className="mt-4 text-sm text-gray-500">Bitte zeigen Sie Ihren QR-Code erneut am Eingang vor.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
          <svg className="h-12 w-12 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="mb-2 text-2xl font-bold text-gray-900">Willkommen!</h1>
        <p className="mb-1 text-lg text-gray-700">
          <strong>{name}</strong> ist als anwesend eingetragen.
        </p>
        {eventTitle && (
          <p className="text-sm text-gray-500">{eventTitle}</p>
        )}
        <p className="mt-6 text-sm text-gray-500">Vielen Dank für Ihre Teilnahme. Sie können dieses Fenster schließen.</p>
      </div>
    </div>
  )
}

export default function CheckinScanPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <p className="text-gray-600">Wird geladen …</p>
        </div>
      }
    >
      <CheckinScanContent />
    </Suspense>
  )
}
