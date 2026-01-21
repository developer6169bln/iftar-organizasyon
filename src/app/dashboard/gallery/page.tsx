'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function GalleryPage() {
  const [eventId, setEventId] = useState<string | null>(null)
  const [galleryItems, setGalleryItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [showShareModal, setShowShareModal] = useState(false)
  const [shareRecipient, setShareRecipient] = useState<string>('')

  useEffect(() => {
    loadEventAndGallery()
  }, [])

  const loadEventAndGallery = async () => {
    try {
      setLoading(true)
      const eventResponse = await fetch('/api/events')
      if (eventResponse.ok) {
        const event = await eventResponse.json()
        setEventId(event.id)
        await loadGallery(event.id)
      }
    } catch (error) {
      console.error('Event yükleme hatası:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadGallery = async (eventId: string) => {
    try {
      const response = await fetch(`/api/gallery?eventId=${encodeURIComponent(eventId)}&category=GALLERY`)
      if (response.ok) {
        const data = await response.json()
        console.log('Gallery items loaded:', data.items)
        setGalleryItems(data.items || [])
      } else {
        const errorData = await response.json().catch(() => ({}))
        console.error('Gallery load error:', response.status, errorData)
      }
    } catch (error) {
      console.error('Galerie yükleme hatası:', error)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0 || !eventId) return

    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('eventId', eventId)
        formData.append('category', 'GALLERY')

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          const error = await response.json()
          alert(`Fehler beim Hochladen von ${file.name}: ${error.error || 'Unbekannter Fehler'}`)
        }
      }

      await loadGallery(eventId)
    } catch (error) {
      console.error('Upload error:', error)
      alert('Fehler beim Hochladen')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Datei wirklich löschen?')) return

    try {
      const response = await fetch(`/api/upload?id=${id}`, {
        method: 'DELETE',
      })

      if (response.ok && eventId) {
        await loadGallery(eventId)
        setSelectedItems(new Set())
      } else {
        const error = await response.json()
        alert(error.error || 'Fehler beim Löschen')
      }
    } catch (error) {
      console.error('Delete error:', error)
      alert('Fehler beim Löschen')
    }
  }

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedItems)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedItems(newSelected)
  }

  const selectAll = () => {
    if (selectedItems.size === galleryItems.length) {
      setSelectedItems(new Set())
    } else {
      setSelectedItems(new Set(galleryItems.map((item) => item.id)))
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const getFileUrl = (filePath: string) => {
    // Verwende window.location.origin für die aktuelle Domain
    // Falls nicht verfügbar (SSR), verwende einen Fallback
    if (typeof window !== 'undefined') {
      const origin = window.location.origin
      // Stelle sicher, dass filePath mit / beginnt
      const path = filePath.startsWith('/') ? filePath : `/${filePath}`
      const fullUrl = `${origin}${path}`
      console.log('Generated file URL:', fullUrl, 'from path:', filePath)
      return fullUrl
    }
    // Fallback für SSR (wird beim Client-Side-Rendering überschrieben)
    return filePath
  }

  const shareViaEmail = (items: any[]) => {
    const subject = encodeURIComponent(`Fotos/Videos - Iftar Organizasyon`)
    const fileUrls = items.map((item) => getFileUrl(item.filePath))
    const body = encodeURIComponent(
      `Hallo,\n\nIch teile ${items.length} Foto(s)/Video(s) mit dir:\n\n${fileUrls.join('\n')}\n\n---\nIftar Organizasyon System`
    )
    const mailtoLink = shareRecipient
      ? `mailto:${encodeURIComponent(shareRecipient)}?subject=${subject}&body=${body}`
      : `mailto:?subject=${subject}&body=${body}`
    window.open(mailtoLink, '_blank')
    setShowShareModal(false)
    setSelectedItems(new Set())
  }

  const shareViaWhatsApp = (items: any[]) => {
    const fileUrls = items.map((item) => getFileUrl(item.filePath))
    const text = encodeURIComponent(
      `📸 Fotos/Videos - Iftar Organizasyon\n\n${items.length} Datei(en):\n\n${fileUrls.join('\n')}`
    )
    window.open(`https://wa.me/?text=${text}`, '_blank')
    setShowShareModal(false)
    setSelectedItems(new Set())
  }

  const handleShareSelected = () => {
    const itemsToShare = galleryItems.filter((item) => selectedItems.has(item.id))
    if (itemsToShare.length === 0) {
      alert('Bitte wählen Sie mindestens ein Element aus')
      return
    }
    setShowShareModal(true)
  }

  const shareSingle = (item: any, method: 'email' | 'whatsapp') => {
    if (method === 'email') {
      shareViaEmail([item])
    } else {
      shareViaWhatsApp([item])
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className="text-gray-600 hover:text-gray-900">
                ← Geri
              </Link>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500 text-xl text-white">
                  📸
                </div>
                <h1 className="text-2xl font-bold text-gray-900">Foto / Video Galeri</h1>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Toolbar */}
        <div className="mb-6 flex items-center justify-between rounded-xl bg-white p-4 shadow-md">
          <div className="flex items-center gap-3">
            <label className="cursor-pointer">
              <input
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={handleFileUpload}
                className="hidden"
                disabled={uploading || !eventId}
              />
              <span className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:bg-gray-400">
                {uploading ? '⏳ Hochladen...' : '📤 Foto/Video hochladen'}
              </span>
            </label>
            {galleryItems.length > 0 && (
              <>
                <button
                  onClick={selectAll}
                  className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
                >
                  {selectedItems.size === galleryItems.length ? 'Alle abwählen' : 'Alle auswählen'}
                </button>
                {selectedItems.size > 0 && (
                  <button
                    onClick={handleShareSelected}
                    className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                  >
                    📤 {selectedItems.size} ausgewählt teilen
                  </button>
                )}
              </>
            )}
          </div>
          <div className="text-sm text-gray-600">
            {galleryItems.length} {galleryItems.length === 1 ? 'Datei' : 'Dateien'}
          </div>
        </div>

        {/* Gallery Grid */}
        {loading ? (
          <div className="flex min-h-[400px] items-center justify-center">
            <p className="text-gray-500">Lade Galerie...</p>
          </div>
        ) : galleryItems.length === 0 ? (
          <div className="flex min-h-[400px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-white">
            <p className="mb-4 text-gray-500">Noch keine Fotos oder Videos hochgeladen</p>
            <label className="cursor-pointer">
              <input
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={handleFileUpload}
                className="hidden"
                disabled={uploading || !eventId}
              />
              <span className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
                📤 Erste Dateien hochladen
              </span>
            </label>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {galleryItems.map((item) => (
              <div
                key={item.id}
                className={`group relative overflow-hidden rounded-lg border-2 bg-white shadow-md transition-all ${
                  selectedItems.has(item.id) ? 'border-indigo-500 ring-2 ring-indigo-300' : 'border-gray-200'
                }`}
              >
                {/* Checkbox */}
                <div className="absolute left-2 top-2 z-10">
                  <input
                    type="checkbox"
                    checked={selectedItems.has(item.id)}
                    onChange={() => toggleSelection(item.id)}
                    className="h-5 w-5 cursor-pointer rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </div>

                {/* Preview */}
                <div className="aspect-square w-full overflow-hidden bg-gray-900">
                  {item.isImage ? (
                    <img
                      src={item.filePath}
                      alt={item.fileName}
                      className="h-full w-full object-cover transition-transform group-hover:scale-110"
                      loading="lazy"
                      onError={(e) => {
                        console.error('Image load error for:', item.filePath, item)
                        const target = e.target as HTMLImageElement
                        target.style.display = 'none'
                        const parent = target.parentElement
                        if (parent) {
                          parent.innerHTML = '<div class="flex h-full items-center justify-center text-white text-sm">❌ Bild konnte nicht geladen werden</div>'
                        }
                      }}
                      onLoad={() => {
                        console.log('Image loaded successfully:', item.filePath)
                      }}
                    />
                  ) : item.isVideo ? (
                    <div className="relative h-full w-full bg-black">
                      <video
                        src={item.filePath}
                        className="h-full w-full object-contain"
                        controls={true}
                        preload="metadata"
                        playsInline
                        onError={(e) => {
                          console.error('Video load error for:', item.filePath, item)
                          const target = e.target as HTMLVideoElement
                          target.style.display = 'none'
                          const parent = target.parentElement
                          if (parent) {
                            parent.innerHTML = '<div class="flex h-full items-center justify-center text-white text-sm">❌ Video konnte nicht geladen werden</div>'
                          }
                        }}
                        onLoadedMetadata={() => {
                          console.log('Video metadata loaded:', item.filePath)
                        }}
                      />
                      <div className="absolute bottom-2 right-2 rounded bg-black bg-opacity-70 px-2 py-1 text-xs text-white">
                        ▶ Video
                      </div>
                    </div>
                  ) : (
                    <div className="flex h-full items-center justify-center text-4xl text-white">📄</div>
                  )}
                </div>

                {/* Overlay Actions */}
                <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black bg-opacity-0 transition-all group-hover:bg-opacity-50">
                  <button
                    onClick={() => shareSingle(item, 'email')}
                    className="rounded-full bg-blue-600 p-2 text-white opacity-0 transition-opacity hover:bg-blue-700 group-hover:opacity-100"
                    title="Per E-Mail teilen"
                  >
                    📧
                  </button>
                  <button
                    onClick={() => shareSingle(item, 'whatsapp')}
                    className="rounded-full bg-green-600 p-2 text-white opacity-0 transition-opacity hover:bg-green-700 group-hover:opacity-100"
                    title="Per WhatsApp teilen"
                  >
                    💬
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="rounded-full bg-red-600 p-2 text-white opacity-0 transition-opacity hover:bg-red-700 group-hover:opacity-100"
                    title="Löschen"
                  >
                    🗑
                  </button>
                </div>

                {/* File Info */}
                <div className="p-2">
                  <p className="truncate text-xs font-medium text-gray-900">{item.fileName}</p>
                  <p className="text-xs text-gray-500">{formatFileSize(item.fileSize)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-xl font-semibold">
              {selectedItems.size} {selectedItems.size === 1 ? 'Datei' : 'Dateien'} teilen
            </h2>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Empfänger E-Mail (optional)
              </label>
              <input
                type="email"
                value={shareRecipient}
                onChange={(e) => setShareRecipient(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
                placeholder="empfaenger@example.com"
              />
            </div>
            <div className="space-y-2">
              <button
                onClick={() => shareViaEmail(galleryItems.filter((item) => selectedItems.has(item.id)))}
                className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700 flex items-center justify-center gap-2"
              >
                📧 Per E-Mail teilen
              </button>
              <button
                onClick={() => shareViaWhatsApp(galleryItems.filter((item) => selectedItems.has(item.id)))}
                className="w-full rounded-lg bg-green-600 px-4 py-3 text-sm font-medium text-white hover:bg-green-700 flex items-center justify-center gap-2"
              >
                💬 Per WhatsApp teilen
              </button>
            </div>
            <button
              onClick={() => {
                setShowShareModal(false)
                setShareRecipient('')
              }}
              className="mt-4 w-full rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
