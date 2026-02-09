'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

function formatSentDate(iso: string | null) {
  if (!iso) return null
  const d = new Date(iso)
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function EtkinlikFormuPage() {
  const [projectId, setProjectId] = useState<string | null>(null)
  const [form, setForm] = useState<{ id: string; formType: string; fields: { id: string; label: string; type: string; required: boolean; jotformQuestionId?: string }[] } | null>(null)
  const [submissions, setSubmissions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [canSubmit, setCanSubmit] = useState(false)
  const [jotformUrl, setJotformUrl] = useState('')
  const [importing, setImporting] = useState(false)
  const [newEntry, setNewEntry] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [sendingId, setSendingId] = useState<string | null>(null)

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
        setCanSubmit(Array.isArray(perms) && perms.some((p: any) => p.canSubmitToJotform))
      })
      .finally(() => setLoading(false))
  }, [projectId])

  const handleSaveDraft = async () => {
    if (!projectId) return
    setSaving(true)
    try {
      const res = await fetch('/api/jotform/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          projectId,
          formType: 'ETKINLIK_FORMU',
          data: newEntry,
          submitToJotform: false,
        }),
      })
      if (res.ok) {
        const created = await res.json()
        setSubmissions((prev) => [created, ...prev])
        setNewEntry({})
      } else {
        const err = await res.json()
        alert(err.error || 'Speichern fehlgeschlagen')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleSendToJotform = async (submissionId: string) => {
    setSendingId(submissionId)
    try {
      const res = await fetch(`/api/jotform/submissions/${submissionId}/send`, { method: 'POST', credentials: 'include' })
      if (res.ok) {
        const updated = await res.json()
        setSubmissions((prev) => prev.map((s) => (s.id === submissionId ? updated : s)))
      } else {
        const err = await res.json()
        alert(err.error || 'Senden fehlgeschlagen')
      }
    } finally {
      setSendingId(null)
    }
  }

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
        Jedes Projekt speichert seine Einträge für sich. Alle können ausfüllen und speichern (Entwurf). Nur berechtigte Nutzer können „An JotForm senden“ – dann wird das Sendedatum festgehalten.
      </p>

      <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
          <h2 className="mb-2 font-medium">JotForm-Import (Projekt-Inhaber oder Admin)</h2>
          <p className="mb-2 text-xs text-gray-500">Öffentliche JotForm-URL eingeben – Felder werden aus der Seite ausgelesen (ohne API). Danach können Teammitglieder das Formular ausfüllen; Berechtigte übermitteln an JotForm.</p>
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

      {/* Neuer Eintrag (Entwurf) – nur in diesem Projekt gespeichert */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-3 font-medium">Neuer Eintrag (Entwurf)</h2>
        <p className="mb-3 text-xs text-gray-500">Daten werden nur in diesem Projekt gespeichert. Senden an JotForm kann später ein berechtigter Nutzer auslösen.</p>
        {(form?.fields?.length ?? 0) > 0 ? (
          <div className="space-y-2">
            {form!.fields.map((field: any) => (
              <div key={field.id}>
                <label className="block text-xs font-medium text-gray-600">{field.label}{field.required ? ' *' : ''}</label>
                {field.type === 'textarea' ? (
                  <textarea
                    value={newEntry[field.jotformQuestionId ?? field.id] ?? ''}
                    onChange={(e) => setNewEntry((prev) => ({ ...prev, [field.jotformQuestionId ?? field.id]: e.target.value }))}
                    className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                    rows={3}
                  />
                ) : (
                  <input
                    type="text"
                    value={newEntry[field.jotformQuestionId ?? field.id] ?? ''}
                    onChange={(e) => setNewEntry((prev) => ({ ...prev, [field.jotformQuestionId ?? field.id]: e.target.value }))}
                    className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                  />
                )}
              </div>
            ))}
          </div>
        ) : (
          <div>
            <label className="block text-xs font-medium text-gray-600">Inhalt (Freitext)</label>
            <textarea
              value={newEntry.note ?? ''}
              onChange={(e) => setNewEntry((prev) => ({ ...prev, note: e.target.value }))}
              placeholder="Text für diesen Eintrag…"
              className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
              rows={3}
            />
          </div>
        )}
        <button
          type="button"
          onClick={handleSaveDraft}
          disabled={saving || !Object.values(newEntry).some((v) => String(v).trim())}
          className="mt-3 rounded-lg bg-gray-700 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {saving ? 'Speichern…' : 'Als Entwurf speichern'}
        </button>
      </div>

      <div>
        <h2 className="mb-2 font-medium">Einträge (nur dieses Projekt)</h2>
        {submissions.length === 0 ? (
          <p className="text-sm text-gray-500">Noch keine Einträge.</p>
        ) : (
          <ul className="space-y-2">
            {submissions.map((s) => (
              <li key={s.id} className="rounded border border-gray-200 bg-white p-3 text-sm">
                <span className="text-gray-600">Eingetragen von {s.enteredBy?.name ?? '–'}</span>
                {s.submittedAt ? (
                  <span className="ml-2 text-green-600">
                    → an JotForm gesendet am {formatSentDate(s.submittedAt)}
                    {s.submittedBy ? ` von ${s.submittedBy.name}` : ''}
                  </span>
                ) : (
                  <>
                    <span className="ml-2 text-amber-600">(Entwurf)</span>
                    {canSubmit && (
                      <button
                        type="button"
                        onClick={() => handleSendToJotform(s.id)}
                        disabled={!!sendingId}
                        className="ml-3 rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-700 disabled:opacity-50"
                      >
                        {sendingId === s.id ? 'Senden…' : 'An JotForm senden'}
                      </button>
                    )}
                  </>
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
