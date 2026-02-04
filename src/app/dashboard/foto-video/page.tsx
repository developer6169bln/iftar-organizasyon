'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

type MediaItem = {
  id: string
  eventId: string
  type: 'PHOTO' | 'VIDEO'
  fileName: string
  filePath: string
  fileType: string
  fileSize: number
  title: string | null
  text: string | null
  approvedForSharing: boolean
  sharedInstagram: boolean
  sharedFacebook: boolean
  sharedOtherMedia: boolean
  notes: string | null
  uploadedBy: string | null
  createdAt: string
  updatedAt: string
}

export default function FotoVideoPage() {
  const [eventId, setEventId] = useState<string | null>(null)
  const [items, setItems] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadType, setUploadType] = useState<'PHOTO' | 'VIDEO'>('PHOTO')
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadText, setUploadText] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<{
    title: string
    text: string
    approvedForSharing: boolean
    sharedInstagram: boolean
    sharedFacebook: boolean
    sharedOtherMedia: boolean
    notes: string
  }>({
    title: '',
    text: '',
    approvedForSharing: false,
    sharedInstagram: false,
    sharedFacebook: false,
    sharedOtherMedia: false,
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const loadEvent = useCallback(async () => {
    try {
      const projectId = typeof window !== 'undefined' ? localStorage.getItem('dashboard-project-id') : null
      const url = projectId ? `/api/events?projectId=${encodeURIComponent(projectId)}` : '/api/events'
      const res = await fetch(url, { credentials: 'include' })
      if (!res.ok) return
      const data = await res.json()
      const event = Array.isArray(data) ? data[0] : data
      if (event?.id) setEventId(event.id)
    } catch (e) {
      console.error(e)
    }
  }, [])

  const loadMedia = useCallback(async () => {
    if (!eventId) return
    setLoadError(null)
    try {
      const res = await fetch(`/api/media?eventId=${eventId}`, { credentials: 'include' })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setLoadError((data?.error as string) || `Fehler ${res.status}`)
        setItems([])
        setLoading(false)
        return
      }
      const list = Array.isArray(data) ? data : []
      setItems(list)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Laden fehlgeschlagen')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [eventId])

  useEffect(() => {
    loadEvent()
  }, [loadEvent])

  useEffect(() => {
    const onProjectChange = () => {
      loadEvent()
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('dashboard-project-changed', onProjectChange)
      return () => window.removeEventListener('dashboard-project-changed', onProjectChange)
    }
  }, [loadEvent])

  useEffect(() => {
    if (eventId) loadMedia()
    else setLoading(false)
  }, [eventId, loadMedia])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !eventId) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.set('file', file)
      formData.set('eventId', eventId)
      formData.set('type', uploadType)
      if (uploadTitle.trim()) formData.set('title', uploadTitle.trim())
      if (uploadText.trim()) formData.set('text', uploadText.trim())
      const res = await fetch('/api/media', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(err.error || 'Upload fehlgeschlagen')
        return
      }
      await loadMedia()
      setUploadTitle('')
      setUploadText('')
      e.target.value = ''
    } catch (err) {
      alert('Upload fehlgeschlagen')
    } finally {
      setUploading(false)
    }
  }

  const openEdit = (item: MediaItem) => {
    setEditingId(item.id)
    setEditForm({
      title: item.title ?? '',
      text: item.text ?? '',
      approvedForSharing: item.approvedForSharing,
      sharedInstagram: item.sharedInstagram,
      sharedFacebook: item.sharedFacebook,
      sharedOtherMedia: item.sharedOtherMedia,
      notes: item.notes ?? '',
    })
  }

  const saveEdit = async () => {
    if (!editingId) return
    setSaving(true)
    try {
      const res = await fetch(`/api/media/${editingId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert((data as { error?: string }).error || 'Speichern fehlgeschlagen')
        return
      }
      const updated = data as MediaItem
      // Liste sofort mit aktualisiertem Eintrag aktualisieren (Änderungen sichtbar)
      setItems((prev) =>
        prev.map((it) => (it.id === editingId ? { ...it, ...updated } : it))
      )
      setEditingId(null)
      await loadMedia()
    } catch {
      alert('Speichern fehlgeschlagen')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Dieses Foto/Video wirklich löschen?')) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/media/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(err.error || 'Löschen fehlgeschlagen')
        return
      }
      await loadMedia()
      if (editingId === id) setEditingId(null)
    } catch {
      alert('Löschen fehlgeschlagen')
    } finally {
      setDeletingId(null)
    }
  }

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''

  if (!eventId && !loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <Link href="/dashboard" className="text-indigo-600 hover:underline">
          ← Dashboard
        </Link>
        <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-6 text-amber-800">
          Kein Event für das aktuelle Projekt vorhanden. Bitte wählen Sie ein Projekt mit Event oder legen Sie ein Event an.
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link href="/dashboard" className="text-indigo-600 hover:underline">
            ← Dashboard
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">Foto & Video</h1>
          <p className="text-sm text-gray-600">
            Fotos und Videos hochladen, mit Titel und Kommentar versehen, Teilen-Status und Notizen verwalten.
          </p>
        </div>
      </div>

      {/* Upload-Bereich */}
      <div className="mb-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-800">Hochladen</h2>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Typ</label>
            <select
              value={uploadType}
              onChange={(e) => setUploadType(e.target.value as 'PHOTO' | 'VIDEO')}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="PHOTO">Foto</option>
              <option value="VIDEO">Video</option>
            </select>
          </div>
          <div className="min-w-[200px]">
            <label className="mb-1 block text-sm font-medium text-gray-700">Titel (optional)</label>
            <input
              type="text"
              value={uploadTitle}
              onChange={(e) => setUploadTitle(e.target.value)}
              placeholder="Titel"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="min-w-[200px]">
            <label className="mb-1 block text-sm font-medium text-gray-700">Text / Kommentar (optional)</label>
            <input
              type="text"
              value={uploadText}
              onChange={(e) => setUploadText(e.target.value)}
              placeholder="Kommentar"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Datei</label>
            <input
              type="file"
              accept={uploadType === 'PHOTO' ? 'image/jpeg,image/png,image/gif,image/webp' : 'video/mp4,video/webm,video/quicktime,video/x-msvideo'}
              onChange={handleUpload}
              disabled={uploading}
              className="block w-full text-sm text-gray-600 file:mr-2 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:text-indigo-700 file:hover:bg-indigo-100"
            />
            {uploading && <span className="mt-1 block text-sm text-gray-500">Wird hochgeladen…</span>}
          </div>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          Titel und Text können auch später bearbeitet werden. Fotos max. 15 MB, Videos max. 100 MB.
        </p>
      </div>

      {/* Liste */}
      {loadError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
          {loadError}
        </div>
      )}

      {loading ? (
        <p className="text-gray-500">Lade Medien…</p>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-12 text-center text-gray-600">
          Noch keine Fotos oder Videos. Laden Sie oben eine Datei hoch.
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="relative aspect-video bg-gray-100">
                {item.type === 'PHOTO' ? (
                  <img
                    src={baseUrl + item.filePath}
                    alt={item.title || item.fileName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <video
                    src={baseUrl + item.filePath}
                    controls
                    className="h-full w-full object-contain"
                  />
                )}
                <div className="absolute right-2 top-2 rounded bg-black/60 px-2 py-0.5 text-xs text-white">
                  {item.type === 'PHOTO' ? 'Foto' : 'Video'}
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-medium text-gray-900">
                  {item.title || item.fileName || '(ohne Titel)'}
                </h3>
                {item.text && (
                  <p className="mt-1 line-clamp-2 text-sm text-gray-600">{item.text}</p>
                )}
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <span
                    className={`rounded px-1.5 py-0.5 ${item.approvedForSharing ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}
                  >
                    Geprüft
                  </span>
                  {item.sharedInstagram && <span className="rounded bg-pink-100 px-1.5 py-0.5 text-pink-800">Instagram</span>}
                  {item.sharedFacebook && <span className="rounded bg-blue-100 px-1.5 py-0.5 text-blue-800">Facebook</span>}
                  {item.sharedOtherMedia && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-700">Andere</span>}
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(item)}
                    className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
                  >
                    Bearbeiten
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(item.id)}
                    disabled={deletingId === item.id}
                    className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    {deletingId === item.id ? 'Löschen…' : 'Löschen'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bearbeiten-Modal */}
      {editingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">Medium bearbeiten</h3>
            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Titel</label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Text / Kommentar</label>
                <textarea
                  value={editForm.text}
                  onChange={(e) => setEditForm((f) => ({ ...f, text: e.target.value }))}
                  rows={2}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-2">
                <span className="block text-sm font-medium text-gray-700">Teilen-Status</span>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editForm.approvedForSharing}
                    onChange={(e) => setEditForm((f) => ({ ...f, approvedForSharing: e.target.checked }))}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm">Geprüft fürs Teilen</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editForm.sharedInstagram}
                    onChange={(e) => setEditForm((f) => ({ ...f, sharedInstagram: e.target.checked }))}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm">Geteilt in Instagram</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editForm.sharedFacebook}
                    onChange={(e) => setEditForm((f) => ({ ...f, sharedFacebook: e.target.checked }))}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm">Geteilt in Facebook</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editForm.sharedOtherMedia}
                    onChange={(e) => setEditForm((f) => ({ ...f, sharedOtherMedia: e.target.checked }))}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm">Geteilt in anderen Medien</span>
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Notizen</label>
                <textarea
                  value={editForm.notes}
                  onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={3}
                  placeholder="Interne Notizen zu diesem Foto/Video"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingId(null)}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={saveEdit}
                disabled={saving}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? 'Speichern…' : 'Speichern'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
