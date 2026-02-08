'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function EtkinlikFormuPage() {
  const [projectId, setProjectId] = useState<string | null>(null)
  const [form, setForm] = useState<{ id: string; formType: string; fields: { id: string; label: string; type: string; required: boolean }[] } | null>(null)
  const [submissions, setSubmissions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [canSubmit, setCanSubmit] = useState(false)
  const [jotformUrl, setJotformUrl] = useState('')
  const [importing, setImporting] = useState(false)

  useEffect(() => {
    const pid = typeof window !== 'undefined' ? localStorage.getItem('dashboard-project-id') : null
    setProjectId(pid)
  }, [])

  useEffect(() => {
    if (!projectId) {
      setLoading(false)
      return
    }
    Promise.all([
      fetch(`/api/jotform/forms?projectId=${encodeURIComponent(projectId)}`, { credentials: 'include' }).then((r) => (r.ok ? r.json() : [])),
      fetch(`/api/jotform/submissions?projectId=${encodeURIComponent(projectId)}&formType=ETKINLIK_FORMU`, { credentials: 'include' }).then((r) => (r.ok ? r.json() : [])),
      fetch(`/api/jotform/permissions?projectId=${encodeURIComponent(projectId)}`, { credentials: 'include' }).then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([forms, list, perms]) => {
        const f = Array.isArray(forms) ? forms.find((x: any) => x.formType === 'ETKINLIK_FORMU') : null
        setForm(f || null)
        setSubmissions(Array.isArray(list) ? list : [])
        const me = typeof window !== 'undefined' && (document.cookie.match(/auth-token=([^;]+)/)?.[1] || localStorage.getItem('auth-token'))
        const myPerm = Array.isArray(perms) ? perms.find((p: any) => p.canSubmitToJotform) : []
        setCanSubmit(Array.isArray(perms) && perms.some((p: any) => p.canSubmitToJotform))
      })
      .finally(() => setLoading(false))
  }, [projectId])

  const handleImport = async () => {
    if (!projectId || !jotformUrl.trim()) return
    setImporting(true)
    try {
      const res = await fetch('/api/jotform/forms/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ projectId, formType: 'ETKINLIK_FORMU', jotformUrl: jotformUrl.trim() }),
      })
      if (res.ok) {
        const updated = await res.json()
        setForm(updated)
        setJotformUrl('')
      } else {
        const err = await res.json()
        alert(err.error || 'Import fehlgeschlagen')
      }
    } finally {
      setImporting(false)
    }
  }

  if (!projectId) {
    return (
      <div className="p-6">
        <h1 className="mb-4 text-xl font-semibold">Etkinlik Formu</h1>
        <p className="text-gray-600">Bitte wählen Sie zuerst ein Projekt auf der Dashboard-Startseite.</p>
        <Link href="/dashboard" className="mt-4 inline-block text-indigo-600 hover:underline">← Zum Dashboard</Link>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-gray-500">Laden…</p>
      </div>
    )
  }

  return (
    <div className="p-6">
      <h1 className="mb-4 text-xl font-semibold">Etkinlik Formu</h1>
      <p className="mb-6 text-sm text-gray-600">
        Jeder im Projekt kann Daten eintragen. Nur berechtigte Nutzer können das Formular an JotForm senden.
      </p>

      <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
          <h2 className="mb-2 font-medium">JotForm-Import (nur Projekt-Inhaber)</h2>
          <p className="mb-2 text-xs text-gray-500">JotForm-URL eingeben und Felder importieren. Danach können Teammitglieder das Formular ausfüllen.</p>
          <div className="flex gap-2">
            <input
              type="url"
              value={jotformUrl}
              onChange={(e) => setJotformUrl(e.target.value)}
              placeholder="https://form.jotform.com/..."
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={handleImport}
              disabled={importing}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {importing ? 'Import…' : 'Felder importieren'}
            </button>
          </div>
          {(form?.fields?.length ?? 0) > 0 && (
            <p className="mt-2 text-xs text-green-600">{form!.fields.length} Felder importiert.</p>
          )}
        </div>

      <div>
        <h2 className="mb-2 font-medium">Einträge</h2>
        {submissions.length === 0 ? (
          <p className="text-sm text-gray-500">Noch keine Einträge.</p>
        ) : (
          <ul className="space-y-2">
            {submissions.map((s) => (
              <li key={s.id} className="rounded border border-gray-200 bg-white p-3 text-sm">
                <span className="text-gray-600">Eingetragen von {s.enteredBy?.name ?? '–'}</span>
                {s.submittedAt ? (
                  <span className="ml-2 text-green-600">→ an JotForm gesendet</span>
                ) : (
                  <span className="ml-2 text-amber-600">(Entwurf)</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="mt-6 text-xs text-gray-500">
        Berechtigung „An JotForm senden“ vergibt der Projekt-Inhaber unter Projekte → Mitglieder (JotForm-Sendeberechtigung).
      </p>
      <Link href="/dashboard" className="mt-4 inline-block text-indigo-600 hover:underline">← Zum Dashboard</Link>
    </div>
  )
}
