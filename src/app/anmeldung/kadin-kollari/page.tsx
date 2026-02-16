'use client'

import { Suspense, useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'

function KadinKollariAnmeldungContent() {
  const searchParams = useSearchParams()
  const eventId = searchParams.get('eventId') ?? ''

  const [shareUrl, setShareUrl] = useState('')
  const [linkCopied, setLinkCopied] = useState(false)
  useEffect(() => {
    setShareUrl(typeof window !== 'undefined' ? window.location.href : '')
  }, [])
  const handleCopyLink = () => {
    if (typeof window !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl || window.location.href)
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2000)
    }
  }
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [district, setDistrict] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [participating, setParticipating] = useState(true)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const body: Record<string, unknown> = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        district: district.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim(),
        participating,
        notes: notes.trim() || undefined,
      }
      if (participating && eventId) body.eventId = eventId

      const res = await fetch('/api/registrations/kadin-kollari', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Ein Fehler ist aufgetreten.')
        return
      }
      if (data.participating && data.acceptToken) {
        const params = new URLSearchParams({ token: data.acceptToken })
        if (eventId) params.set('eventId', eventId)
        window.location.href = `/anmeldung/kadin-kollari/erfolg?${params.toString()}`
        return
      }
      setSuccess(true)
      setFirstName('')
      setLastName('')
      setDistrict('')
      setPhone('')
      setEmail('')
      setNotes('')
      setParticipating(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verbindungsfehler.')
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-amber-50 to-orange-50 p-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
            <svg className="h-12 w-12 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="mb-2 text-2xl font-bold text-gray-900">Vielen Dank!</h1>
          <p className="text-gray-600">
            Ihre Anmeldung für Kadın Kolları wurde erfolgreich übermittelt. Wir freuen uns auf Ihre Teilnahme.
          </p>
          <button
            type="button"
            onClick={() => setSuccess(false)}
            className="mt-6 rounded-lg bg-indigo-600 px-6 py-2 font-medium text-white hover:bg-indigo-700"
          >
            Weitere Anmeldung
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-amber-50 to-orange-50 p-4">
      <div className="anmeldung-form w-full max-w-lg rounded-2xl bg-white p-8 shadow-xl">
        <h1 className="mb-2 text-center text-3xl font-bold text-gray-900">Kadın Kolları</h1>
        <p className="mb-6 text-center text-gray-600">
          Registrierung für Kadın Kolları – Teilnahme am Event bekunden
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="firstName" className="mb-1 block text-sm font-medium text-gray-700">
                Vorname <span className="text-red-500">*</span>
              </label>
              <input
                id="firstName"
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Vorname"
              />
            </div>
            <div>
              <label htmlFor="lastName" className="mb-1 block text-sm font-medium text-gray-700">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                id="lastName"
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Name"
              />
            </div>
          </div>

          <div>
            <label htmlFor="district" className="mb-1 block text-sm font-medium text-gray-700">
              Bezirk
            </label>
            <input
              id="district"
              type="text"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="z. B. Mitte, Friedrichshain-Kreuzberg"
            />
          </div>

          <div>
            <label htmlFor="phone" className="mb-1 block text-sm font-medium text-gray-700">
              Telefonnummer <span className="text-red-500">*</span>
            </label>
            <input
              id="phone"
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Telefonnummer"
            />
          </div>

          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700">
              E-Mail-Adresse <span className="text-red-500">*</span>
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="ihre@email.de"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              id="participating"
              type="checkbox"
              checked={participating}
              onChange={(e) => setParticipating(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="participating" className="text-sm font-medium text-gray-700">
              Ich nehme teil
            </label>
          </div>
          {participating && !eventId && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Hinweis: Für sofortigen QR-Code und E-Mail-Versand muss der Anmeldelink die Event-ID enthalten. Bitte verwenden Sie den Link von der Registrierungen-Seite.
            </p>
          )}

          <div>
            <label htmlFor="notes" className="mb-1 block text-sm font-medium text-gray-700">
              Notizen / Vorschläge
            </label>
            <textarea
              id="notes"
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Anmerkungen, Wünsche oder Vorschläge …"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-indigo-600 px-4 py-3 font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {submitting ? 'Wird gesendet …' : 'Anmeldung absenden'}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-gray-500">
          Diese Seite ist öffentlich zugänglich. Der Link kann geteilt werden.
        </p>
        <div className="mt-4 flex items-center justify-center gap-2">
          <input
            type="text"
            readOnly
            value={shareUrl || '/anmeldung/kadin-kollari'}
            className="flex-1 max-w-xs rounded border border-gray-300 px-3 py-2 text-xs text-gray-600"
          />
          <button
            type="button"
            onClick={handleCopyLink}
            className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
          >
            {linkCopied ? 'Kopiert!' : 'Link kopieren'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function KadinKollariAnmeldungPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-amber-50 p-4"><p className="text-gray-600">Lade …</p></div>}>
      <KadinKollariAnmeldungContent />
    </Suspense>
  )
}
