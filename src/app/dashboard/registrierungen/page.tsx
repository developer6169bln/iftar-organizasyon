'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type Registration = {
  id: string
  eventSlug: string
  firstName: string
  lastName: string
  district: string | null
  sube: string | null
  phone: string | null
  email: string
  participating: boolean
  notes: string | null
  createdAt: string
  invitationSentAt?: string | null
  called?: boolean
}

type EventOption = { id: string; title: string; date: string }

type MergedEntry = {
  key: string
  firstName: string
  lastName: string
  fullName: string
  email: string
  phone: string | null
  district: string | null
  sources: string[]
  registrations: Registration[]
  inGuestList: boolean
  hasQr: boolean
  primaryReg: Registration
}

const EVENT_SLUG_LABELS: Record<string, string> = {
  'uid-iftar': 'UID Iftar',
  'sube-baskanlari': 'Şube Başkanları',
  'kadin-kollari': 'Kadın Kolları',
  'genclik-kollari': 'Gençlik Kolları',
  'fatihgruppe': 'Fatihgruppe',
  'omerliste': 'Ömerliste',
  'kemalettingruppe': 'Kemalettingruppe',
}

function mergeRegistrations(list: Registration[], guestNamesLower: Set<string>): MergedEntry[] {
  const key = (r: Registration) =>
    `${(r.firstName || '').trim().toLowerCase()}|${(r.lastName || '').trim().toLowerCase()}`
  const groups = new Map<string, Registration[]>()
  for (const r of list) {
    const k = key(r)
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k)!.push(r)
  }
  const merged: MergedEntry[] = []
  for (const [, regs] of groups) {
    const primary = regs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0]
    const fullName = [primary.firstName, primary.lastName].filter(Boolean).join(' ').trim()
    const nameLower = fullName.toLowerCase()
    merged.push({
      key: key(primary),
      firstName: primary.firstName,
      lastName: primary.lastName,
      fullName,
      email: primary.email,
      phone: primary.phone ?? regs.find((r) => r.phone)?.phone ?? null,
      district: primary.district ?? regs.find((r) => r.district)?.district ?? null,
      sources: [...new Set(regs.map((r) => EVENT_SLUG_LABELS[r.eventSlug] ?? r.eventSlug))],
      registrations: regs,
      inGuestList: guestNamesLower.has(nameLower),
      hasQr: regs.some((r) => r.invitationSentAt),
      primaryReg: primary,
    })
  }
  return merged.sort((a, b) => a.fullName.localeCompare(b.fullName))
}

function filterBySearch(rows: Registration[], query: string): Registration[] {
  if (!query.trim()) return rows
  const q = query.trim().toLowerCase()
  return rows.filter(
    (r) =>
      r.firstName?.toLowerCase().includes(q) ||
      r.lastName?.toLowerCase().includes(q) ||
      r.email?.toLowerCase().includes(q) ||
      r.district?.toLowerCase().includes(q) ||
      r.sube?.toLowerCase().includes(q) ||
      r.phone?.includes(q) ||
      r.notes?.toLowerCase().includes(q)
  )
}

function filterByNoQr(rows: Registration[], filterNoQr: boolean): Registration[] {
  if (!filterNoQr) return rows
  return rows.filter((r) => !r.invitationSentAt)
}

function filterMergedBySearch(rows: MergedEntry[], query: string): MergedEntry[] {
  if (!query.trim()) return rows
  const q = query.trim().toLowerCase()
  return rows.filter(
    (m) =>
      m.firstName?.toLowerCase().includes(q) ||
      m.lastName?.toLowerCase().includes(q) ||
      m.fullName?.toLowerCase().includes(q) ||
      m.email?.toLowerCase().includes(q) ||
      m.district?.toLowerCase().includes(q) ||
      m.phone?.includes(q) ||
      m.sources.some((s) => s.toLowerCase().includes(q))
  )
}

function filterMergedByNoQr(rows: MergedEntry[], filterNoQr: boolean): MergedEntry[] {
  if (!filterNoQr) return rows
  return rows.filter((m) => !m.hasQr)
}

export default function RegistrierungenPage() {
  const [list, setList] = useState<Registration[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterNoQr, setFilterNoQr] = useState(false)
  const [activeTab, setActiveTab] = useState<'uebersicht' | 'uid-iftar' | 'sube-baskanlari' | 'kadin-kollari' | 'genclik-kollari' | 'fatihgruppe' | 'omerliste' | 'kemalettingruppe'>('uebersicht')
  const [events, setEvents] = useState<EventOption[]>([])
  const [selectedEventId, setSelectedEventId] = useState<string>('')
  const [importing, setImporting] = useState<string | null>(null)
  const [fixing, setFixing] = useState<string | null>(null)
  const [acceptingId, setAcceptingId] = useState<string | null>(null)
  const [sendingEmailId, setSendingEmailId] = useState<string | null>(null)
  const [updatingCalledId, setUpdatingCalledId] = useState<string | null>(null)
  const [removingDuplicates, setRemovingDuplicates] = useState(false)
  const [guests, setGuests] = useState<{ name: string }[]>([])
  const [loadingGuests, setLoadingGuests] = useState(false)
  const [qrModal, setQrModal] = useState<{ checkInToken: string; acceptToken?: string; fullName: string; eventTitle: string } | null>(null)

  const loadRegistrations = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/registrations')
      if (!res.ok) throw new Error('Laden fehlgeschlagen')
      const data = await res.json()
      setList(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error(e)
      setList([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRegistrations()
  }, [])

  useEffect(() => {
    const onEmailSent = () => loadRegistrations()
    if (typeof window !== 'undefined') {
      window.addEventListener('email-sent', onEmailSent)
      return () => window.removeEventListener('email-sent', onEmailSent)
    }
  }, [])

  useEffect(() => {
    const loadEvents = async () => {
      try {
        const projectId = typeof window !== 'undefined' ? localStorage.getItem('dashboard-project-id') : null
        const params = new URLSearchParams({ list: 'true' })
        if (projectId) params.set('projectId', projectId)
        const res = await fetch(`/api/events?${params}`)
        if (!res.ok) return
        const data = await res.json()
        const arr = Array.isArray(data) ? data : (data?.id ? [data] : [])
        const evs = arr.map((e: { id: string; title: string; date: string }) => ({ id: e.id, title: e.title, date: e.date }))
        setEvents(evs)
        setSelectedEventId((prev) => (prev ? prev : evs[0]?.id ?? ''))
      } catch (e) {
        console.error(e)
      }
    }
    loadEvents()
  }, [])

  useEffect(() => {
    if (activeTab !== 'uebersicht' || !selectedEventId) {
      setGuests([])
      return
    }
    let cancelled = false
    setLoadingGuests(true)
    fetch(`/api/guests?eventId=${encodeURIComponent(selectedEventId)}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (cancelled) return
        const arr = Array.isArray(data) ? data : []
        setGuests(arr.map((g: { name?: string }) => ({ name: (g.name || '').trim() })))
      })
      .catch(() => { if (!cancelled) setGuests([]) })
      .finally(() => { if (!cancelled) setLoadingGuests(false) })
    return () => { cancelled = true }
  }, [activeTab, selectedEventId])

  useEffect(() => {
    const onProjectChange = () => {
      const projectId = typeof window !== 'undefined' ? localStorage.getItem('dashboard-project-id') : null
      const params = new URLSearchParams({ list: 'true' })
      if (projectId) params.set('projectId', projectId)
      fetch(`/api/events?${params}`)
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => {
          const arr = Array.isArray(data) ? data : []
          setEvents(arr.map((e: { id: string; title: string; date: string }) => ({ id: e.id, title: e.title, date: e.date })))
          setSelectedEventId((prev) => (arr.some((e: { id: string }) => e.id === prev) ? prev : arr[0]?.id ?? ''))
        })
        .catch(() => {})
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('dashboard-project-changed', onProjectChange)
      return () => window.removeEventListener('dashboard-project-changed', onProjectChange)
    }
  }, [])

  const uidIftar = list.filter((r) => r.eventSlug === 'uid-iftar')
  const subeBaskanlari = list.filter((r) => r.eventSlug === 'sube-baskanlari')
  const kadinKollari = list.filter((r) => r.eventSlug === 'kadin-kollari')
  const genclikKollari = list.filter((r) => r.eventSlug === 'genclik-kollari')
  const fatihgruppe = list.filter((r) => r.eventSlug === 'fatihgruppe')
  const omerliste = list.filter((r) => r.eventSlug === 'omerliste')
  const kemalettingruppe = list.filter((r) => r.eventSlug === 'kemalettingruppe')

  const guestNamesLower = new Set(guests.map((g) => g.name.toLowerCase()).filter(Boolean))
  const mergedList = mergeRegistrations(list, guestNamesLower)
  const mergedFiltered = filterMergedByNoQr(filterMergedBySearch(mergedList, searchQuery), filterNoQr)

  const formatDate = (s: string) => {
    try {
      return new Date(s).toLocaleString('de-DE', {
        dateStyle: 'short',
        timeStyle: 'short',
      })
    } catch {
      return s
    }
  }

  const handleImportToGuests = async (eventSlug: string) => {
    if (!selectedEventId) {
      alert('Bitte wählen Sie zuerst ein Event aus.')
      return
    }
    setImporting(eventSlug)
    try {
      const res = await fetch('/api/registrations/import-to-guests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventSlug, eventId: selectedEventId }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || 'Import fehlgeschlagen')
        return
      }
      const msg = [
        `${data.imported} Anmeldung(en) in die Gästeliste übernommen.`,
        data.skipped > 0 ? `${data.skipped} übersprungen (bereits vorhanden).` : '',
        data.duplicateNames?.length ? `Duplikate: ${data.duplicateNames.slice(0, 5).join(', ')}${data.duplicateNames.length > 5 ? ' …' : ''}` : '',
      ]
        .filter(Boolean)
        .join('\n')
      alert(msg)
    } catch (e) {
      console.error(e)
      alert('Import fehlgeschlagen')
    } finally {
      setImporting(null)
    }
  }

  const handleFixImportedGuests = async (eventSlug: string) => {
    if (!selectedEventId) {
      alert('Bitte wählen Sie zuerst ein Event aus.')
      return
    }
    if (!confirm('Bereits importierte Gäste korrigieren? Vorname und Nachname werden aus den Anmeldungen in die richtigen Spalten übertragen.')) return
    setFixing(eventSlug)
    try {
      const res = await fetch('/api/registrations/fix-imported-guests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventSlug, eventId: selectedEventId }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || 'Korrektur fehlgeschlagen')
        return
      }
      alert(`${data.fixed} Gäste korrigiert.`)
    } catch (e) {
      console.error(e)
      alert('Korrektur fehlgeschlagen')
    } finally {
      setFixing(null)
    }
  }

  const handleAcceptParticipation = async (registrationId: string) => {
    if (!selectedEventId) {
      alert('Bitte wählen Sie zuerst ein Event aus.')
      return
    }
    setAcceptingId(registrationId)
    try {
      const res = await fetch('/api/registrations/accept-participation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registrationId, eventId: selectedEventId }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || 'Teilnahme konnte nicht bestätigt werden.')
        return
      }
      await loadRegistrations()
      if (data.checkInToken) {
        setQrModal({
          checkInToken: data.checkInToken,
          acceptToken: data.acceptToken,
          fullName: data.fullName ?? '',
          eventTitle: data.eventTitle ?? '',
        })
      }
    } catch (e) {
      console.error(e)
      alert('Teilnahme konnte nicht bestätigt werden.')
    } finally {
      setAcceptingId(null)
    }
  }

  const fetchQrInfo = async (registrationId: string) => {
    if (!selectedEventId) return null
    const res = await fetch(`/api/registrations/${encodeURIComponent(registrationId)}/qr-info?eventId=${encodeURIComponent(selectedEventId)}`)
    if (!res.ok) return null
    return res.json() as Promise<{ acceptToken: string; checkInToken: string; fullName: string }>
  }

  const handleDownloadQr = async (r: Registration) => {
    if (!selectedEventId) return
    const info = await fetchQrInfo(r.id)
    if (!info?.checkInToken) {
      alert('QR-Code konnte nicht geladen werden.')
      return
    }
    try {
      const base = typeof window !== 'undefined' ? window.location.origin : ''
      const res = await fetch(`${base}/api/checkin/qr?t=${encodeURIComponent(info.checkInToken)}`)
      if (!res.ok) throw new Error('Download fehlgeschlagen')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `QR-${(info.fullName || `${r.firstName} ${r.lastName}`).replace(/\s+/g, '-')}.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error(e)
      alert('Download fehlgeschlagen.')
    }
  }

  const handleSendEmailAgain = async (r: Registration) => {
    if (!selectedEventId) return
    setSendingEmailId(r.id)
    try {
      const info = await fetchQrInfo(r.id)
      if (!info?.acceptToken) {
        alert('Einladung konnte nicht geladen werden.')
        return
      }
      const res = await fetch(`/api/invitations/accept/${encodeURIComponent(info.acceptToken)}/send-qr-pdf`, {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || 'E-Mail konnte nicht gesendet werden.')
        return
      }
      alert('PDF wurde an die E-Mail-Adresse gesendet.')
      window.dispatchEvent(new Event('email-sent'))
    } catch (e) {
      console.error(e)
      alert('E-Mail konnte nicht gesendet werden.')
    } finally {
      setSendingEmailId(null)
    }
  }

  const handleRemoveDuplicates = async () => {
    if (!confirm('Doppelteinträge (gleicher Vorname + Name) werden über alle Gruppen hinweg geprüft und entfernt. Die betroffenen Personen erhalten eine E-Mail. Fortfahren?')) return
    setRemovingDuplicates(true)
    try {
      const res = await fetch('/api/registrations/remove-duplicates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || 'Duplikate konnten nicht entfernt werden.')
        return
      }
      await loadRegistrations()
      const msg = [
        `${data.deleted} Duplikat(e) entfernt.`,
        data.emailsSent > 0 ? `${data.emailsSent} E-Mail(s) gesendet.` : '',
        data.errors?.length ? `Fehler beim E-Mail-Versand: ${data.errors.slice(0, 3).join('; ')}${data.errors.length > 3 ? ' …' : ''}` : '',
      ]
        .filter(Boolean)
        .join('\n')
      alert(msg)
    } catch (e) {
      console.error(e)
      alert('Duplikate konnten nicht entfernt werden.')
    } finally {
      setRemovingDuplicates(false)
    }
  }

  const handleCalledChange = async (r: Registration, checked: boolean) => {
    setUpdatingCalledId(r.id)
    try {
      const res = await fetch(`/api/registrations/${encodeURIComponent(r.id)}/called`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ called: checked }),
      })
      if (!res.ok) {
        const data = await res.json()
        alert(data.error || 'Status konnte nicht aktualisiert werden.')
        return
      }
      await loadRegistrations()
    } catch (e) {
      console.error(e)
      alert('Status konnte nicht aktualisiert werden.')
    } finally {
      setUpdatingCalledId(null)
    }
  }

  const handleWhatsAppShare = async (r: Registration) => {
    if (!selectedEventId) return
    const info = await fetchQrInfo(r.id)
    if (!info?.checkInToken) {
      alert('QR-Code konnte nicht geladen werden.')
      return
    }
    const base = typeof window !== 'undefined' ? window.location.origin : ''
    const qrUrl = `${base}/api/checkin/qr?t=${encodeURIComponent(info.checkInToken)}`
    const text = `Ihr Check-in QR-Code für die Veranstaltung:\n\n${qrUrl}`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer')
  }

  const renderMergedTable = (rows: MergedEntry[]) => {
    const inGuestCount = rows.filter((m) => m.inGuestList).length
    const hasQrCount = rows.filter((m) => m.hasQr).length
    return (
      <div>
        <p className="mb-3 text-sm text-gray-600">
          <span className="font-medium">Gesamtanzahl: {rows.length} Einträge (nach Name zusammengeführt)</span>
          {' · '}
          <span className="font-medium text-green-700">In Gästeliste: {inGuestCount}</span>
          {' · '}
          <span className="font-medium text-indigo-700">QR-Codes gesendet: {hasQrCount}</span>
        </p>
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Listen</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">In Gästeliste</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">QR</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">E-Mail</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Telefon</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Bezirk</th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500">Aktion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500">
                    {searchQuery.trim()
                      ? 'Keine Einträge entsprechen der Suche.'
                      : filterNoQr
                        ? 'Keine Einträge ohne QR-Code.'
                        : 'Keine Anmeldungen.'}
                  </td>
                </tr>
              ) : (
                rows.map((m) => (
                  <tr
                    key={m.key}
                    className={`hover:bg-gray-50 ${m.inGuestList ? 'bg-green-50/50' : ''} ${m.hasQr ? 'bg-indigo-50/30' : ''}`}
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">{m.fullName}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      <span className="inline-flex flex-wrap gap-1">
                        {m.sources.map((s) => (
                          <span key={s} className="rounded bg-gray-200 px-1.5 py-0.5 text-xs">
                            {s}
                          </span>
                        ))}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {m.inGuestList ? (
                        <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">Ja</span>
                      ) : (
                        <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">Nein</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {m.hasQr ? (
                        <span className="inline-flex rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-800">Gesendet</span>
                      ) : (
                        <span className="text-gray-400">–</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">{m.email || '–'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">{m.phone || '–'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">{m.district || '–'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-center">
                      <div className="flex flex-wrap justify-center gap-1">
                        {m.hasQr ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleWhatsAppShare(m.primaryReg)}
                              disabled={!selectedEventId}
                              className="rounded bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                              title="QR per WhatsApp"
                            >
                              WhatsApp
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDownloadQr(m.primaryReg)}
                              disabled={!selectedEventId}
                              className="rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                              title="QR herunterladen"
                            >
                              Download
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSendEmailAgain(m.primaryReg)}
                              disabled={!selectedEventId || sendingEmailId !== null}
                              className="rounded bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                              title="PDF per E-Mail"
                            >
                              {sendingEmailId === m.primaryReg.id ? '…' : 'E-Mail'}
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleAcceptParticipation(m.primaryReg.id)}
                            disabled={!selectedEventId || acceptingId !== null}
                            className="rounded bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                            title="QR erstellen"
                          >
                            {acceptingId === m.primaryReg.id ? '…' : 'QR erstellen'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  const renderTable = (rows: Registration[], showSube: boolean, noQrFilterActive = false) => {
    const zusagenCount = rows.filter((r) => r.participating).length
    const qrGesendetCount = rows.filter((r) => r.invitationSentAt).length
    return (
    <div>
      <p className="mb-3 text-sm text-gray-600">
        <span className="font-medium">Gesamtanzahl: {rows.length} Einträge</span>
        {' · '}
        <span className="font-medium text-green-700">Zusagen: {zusagenCount}</span>
        {' · '}
        <span className="font-medium text-indigo-700">QR-Codes gesendet: {qrGesendetCount}</span>
      </p>
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500">Aktion</th>
            <th className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500">Angerufen</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Datum</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Vorname</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Name</th>
            {showSube && (
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Şube</th>
            )}
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Bezirk</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Telefon</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">E-Mail</th>
            <th className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500">Teilnahme</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Einladung per E-Mail</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Notizen</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={showSube ? 12 : 11} className="px-4 py-8 text-center text-sm text-gray-500">
                {searchQuery.trim()
                  ? 'Keine Anmeldungen entsprechen der Suche.'
                  : noQrFilterActive
                    ? 'Keine Anmeldungen ohne QR-Code.'
                    : 'Noch keine Anmeldungen.'}
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr
                key={r.id}
                className={`hover:bg-gray-50 ${r.invitationSentAt ? 'bg-green-50' : ''}`}
              >
                <td className="whitespace-nowrap px-4 py-3 text-center">
                  {r.invitationSentAt ? (
                    <div className="flex flex-wrap justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleWhatsAppShare(r)}
                        disabled={!selectedEventId}
                        className="rounded bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                        title="QR-Code per WhatsApp senden"
                      >
                        WhatsApp
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownloadQr(r)}
                        disabled={!selectedEventId}
                        className="rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                        title="QR-Code als Bild herunterladen"
                      >
                        Download
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSendEmailAgain(r)}
                        disabled={!selectedEventId || sendingEmailId !== null}
                        className="rounded bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="PDF per E-Mail erneut senden"
                      >
                        {sendingEmailId === r.id ? '…' : 'E-Mail'}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleAcceptParticipation(r.id)}
                      disabled={!selectedEventId || acceptingId !== null}
                      className="rounded bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Teilnahme akzeptieren und QR-Code generieren"
                    >
                      {acceptingId === r.id ? '…' : 'QR erstellen'}
                    </button>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-center">
                  <label className="flex items-center justify-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={r.called ?? false}
                      onChange={(e) => handleCalledChange(r, e.target.checked)}
                      disabled={updatingCalledId === r.id}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-xs text-gray-600">Angerufen</span>
                  </label>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">{formatDate(r.createdAt)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">{r.firstName}</td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">{r.lastName}</td>
                {showSube && (
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">{r.sube ?? '–'}</td>
                )}
                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">{r.district ?? '–'}</td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">{r.phone ?? '–'}</td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">{r.email}</td>
                <td className="whitespace-nowrap px-4 py-3 text-center">
                  {r.participating ? (
                    <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">Ja</span>
                  ) : (
                    <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">Nein</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm">
                  {r.invitationSentAt ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800" title={`Gesendet: ${formatDate(r.invitationSentAt)}`}>
                      <span className="h-1.5 w-1.5 rounded-full bg-green-600" aria-hidden />
                      {formatDate(r.invitationSentAt)}
                    </span>
                  ) : (
                    <span className="text-gray-400">–</span>
                  )}
                </td>
                <td className="max-w-xs truncate px-4 py-3 text-sm text-gray-600" title={r.notes ?? ''}>
                  {r.notes ?? '–'}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
    </div>
  )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className="text-gray-600 hover:text-gray-900">
                ← Zurück
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">Ergebnisse der Anmeldungen</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex gap-2 border-b border-gray-200">
          <button
            type="button"
            onClick={() => setActiveTab('uebersicht')}
            className={`rounded-t-lg px-4 py-2 text-sm font-medium ${
              activeTab === 'uebersicht'
                ? 'border border-b-0 border-gray-200 bg-white text-indigo-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Übersicht ({mergedList.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('uid-iftar')}
            className={`rounded-t-lg px-4 py-2 text-sm font-medium ${
              activeTab === 'uid-iftar'
                ? 'border border-b-0 border-gray-200 bg-white text-indigo-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            UID Iftar ({uidIftar.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('sube-baskanlari')}
            className={`rounded-t-lg px-4 py-2 text-sm font-medium ${
              activeTab === 'sube-baskanlari'
                ? 'border border-b-0 border-gray-200 bg-white text-indigo-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Şube Başkanları ({subeBaskanlari.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('kadin-kollari')}
            className={`rounded-t-lg px-4 py-2 text-sm font-medium ${
              activeTab === 'kadin-kollari'
                ? 'border border-b-0 border-gray-200 bg-white text-indigo-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Kadın Kolları ({kadinKollari.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('genclik-kollari')}
            className={`rounded-t-lg px-4 py-2 text-sm font-medium ${
              activeTab === 'genclik-kollari'
                ? 'border border-b-0 border-gray-200 bg-white text-indigo-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Gençlik Kolları ({genclikKollari.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('fatihgruppe')}
            className={`rounded-t-lg px-4 py-2 text-sm font-medium ${
              activeTab === 'fatihgruppe'
                ? 'border border-b-0 border-gray-200 bg-white text-indigo-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Fatihgruppe ({fatihgruppe.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('omerliste')}
            className={`rounded-t-lg px-4 py-2 text-sm font-medium ${
              activeTab === 'omerliste'
                ? 'border border-b-0 border-gray-200 bg-white text-indigo-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Ömerliste ({omerliste.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('kemalettingruppe')}
            className={`rounded-t-lg px-4 py-2 text-sm font-medium ${
              activeTab === 'kemalettingruppe'
                ? 'border border-b-0 border-gray-200 bg-white text-indigo-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Kemalettingruppe ({kemalettingruppe.length})
          </button>
        </div>

        {loading ? (
          <p className="text-gray-500">Lade Anmeldungen …</p>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-4">
              <div className="flex flex-1 min-w-[200px] items-center gap-2">
                <label htmlFor="search-registrations" className="text-sm font-medium text-gray-700 shrink-0">
                  Suchen:
                </label>
                <input
                  id="search-registrations"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Vorname, Name, E-Mail, Bezirk …"
                  className="rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-full max-w-xs"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filterNoQr}
                  onChange={(e) => setFilterNoQr(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-700">Nur ohne QR-Code</span>
              </label>
              <div className="flex items-center gap-2">
                <label htmlFor="import-event" className="text-sm font-medium text-gray-700">
                  Ziel-Event für Import:
                </label>
                <select
                  id="import-event"
                  value={selectedEventId}
                  onChange={(e) => setSelectedEventId(e.target.value)}
                  className="rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">– Event wählen –</option>
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.title} ({ev.date ? new Date(ev.date).toLocaleDateString('de-DE') : ''})
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={() => handleImportToGuests(activeTab === 'uebersicht' ? 'all' : activeTab)}
                disabled={!selectedEventId || importing !== null}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {importing === (activeTab === 'uebersicht' ? 'all' : activeTab)
                  ? 'Import läuft …'
                  : activeTab === 'uebersicht'
                    ? 'Alle in Gästeliste übernehmen'
                    : 'In Gästeliste übernehmen'}
              </button>
              <button
                type="button"
                onClick={() => handleFixImportedGuests(activeTab === 'uebersicht' ? 'uid-iftar' : activeTab)}
                disabled={!selectedEventId || fixing !== null || activeTab === 'uebersicht'}
                className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Vorname und Nachname in die richtigen Spalten übertragen (für bereits importierte Gäste)"
              >
                {fixing === activeTab ? 'Korrektur läuft …' : 'Bereits importierte korrigieren'}
              </button>
              <button
                type="button"
                onClick={handleRemoveDuplicates}
                disabled={removingDuplicates}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Doppelteinträge über alle Gruppen prüfen, entfernen und E-Mail senden"
              >
                {removingDuplicates ? 'Duplikate werden entfernt …' : 'Duplikate entfernen'}
              </button>
              <span className="text-sm text-gray-500">
                Doppelte Namen werden übersprungen.
              </span>
            </div>
            {activeTab === 'uebersicht' ? (
              <>
                <h2 className="mb-4 text-lg font-semibold text-gray-900">
                  Übersicht – alle Listen zusammengeführt (Duplikate nach Name zusammengefasst)
                </h2>
                {!selectedEventId ? (
                  <p className="text-amber-600">Bitte wählen Sie ein Ziel-Event für den Gästelisten-Vergleich.</p>
                ) : loadingGuests ? (
                  <p className="text-gray-500">Lade Gästeliste …</p>
                ) : (
                  renderMergedTable(mergedFiltered)
                )}
              </>
            ) : activeTab === 'uid-iftar' ? (
              <>
                <h2 className="mb-4 text-lg font-semibold text-gray-900">UID Iftar</h2>
                {renderTable(filterByNoQr(filterBySearch(uidIftar, searchQuery), filterNoQr), false, filterNoQr)}
              </>
            ) : activeTab === 'sube-baskanlari' ? (
              <>
                <h2 className="mb-4 text-lg font-semibold text-gray-900">Şube Başkanları</h2>
                {renderTable(filterByNoQr(filterBySearch(subeBaskanlari, searchQuery), filterNoQr), true, filterNoQr)}
              </>
            ) : activeTab === 'kadin-kollari' ? (
              <>
                <h2 className="mb-4 text-lg font-semibold text-gray-900">Kadın Kolları</h2>
                {renderTable(filterByNoQr(filterBySearch(kadinKollari, searchQuery), filterNoQr), false, filterNoQr)}
              </>
            ) : activeTab === 'fatihgruppe' ? (
              <>
                <h2 className="mb-4 text-lg font-semibold text-gray-900">Fatihgruppe</h2>
                {renderTable(filterByNoQr(filterBySearch(fatihgruppe, searchQuery), filterNoQr), false, filterNoQr)}
              </>
            ) : activeTab === 'omerliste' ? (
              <>
                <h2 className="mb-4 text-lg font-semibold text-gray-900">Ömerliste</h2>
                {renderTable(filterByNoQr(filterBySearch(omerliste, searchQuery), filterNoQr), false, filterNoQr)}
              </>
            ) : activeTab === 'kemalettingruppe' ? (
              <>
                <h2 className="mb-4 text-lg font-semibold text-gray-900">Kemalettingruppe</h2>
                {renderTable(filterByNoQr(filterBySearch(kemalettingruppe, searchQuery), filterNoQr), false, filterNoQr)}
              </>
            ) : (
              <>
                <h2 className="mb-4 text-lg font-semibold text-gray-900">Gençlik Kolları</h2>
                {renderTable(filterByNoQr(filterBySearch(genclikKollari, searchQuery), filterNoQr), false, filterNoQr)}
              </>
            )}
          </>
        )}

        <p className="mt-6 text-sm text-gray-500">
          Links zu den Formularen:{' '}
          <a href="/anmeldung/uid-iftar" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
            UID Iftar
          </a>
          {' · '}
          <a href="/anmeldung/sube-baskanlari" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
            Şube Başkanları
          </a>
          {' · '}
          <a
            href={selectedEventId ? `/anmeldung/kadin-kollari?eventId=${encodeURIComponent(selectedEventId)}` : '/anmeldung/kadin-kollari'}
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-600 hover:underline"
            title={selectedEventId ? 'Mit Event verknüpft – bei „Ich nehme teil“ sofort QR-Code & E-Mail' : 'Event wählen für QR-Code bei Teilnahme'}
          >
            Kadın Kolları
          </a>
          {' · '}
          <a href="/anmeldung/genclik-kollari" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
            Gençlik Kolları
          </a>
          {' · '}
          <a
            href={selectedEventId ? `/anmeldung/fatihgruppe?eventId=${encodeURIComponent(selectedEventId)}` : '/anmeldung/fatihgruppe'}
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-600 hover:underline"
            title={selectedEventId ? 'Mit Event verknüpft – bei „Ich nehme teil“ sofort QR-Code & E-Mail' : 'Event wählen für QR-Code bei Teilnahme'}
          >
            Fatihgruppe
          </a>
          {' · '}
          <a
            href={selectedEventId ? `/anmeldung/omerliste?eventId=${encodeURIComponent(selectedEventId)}` : '/anmeldung/omerliste'}
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-600 hover:underline"
            title={selectedEventId ? 'Mit Event verknüpft – bei „Ich nehme teil“ sofort QR-Code & E-Mail' : 'Event wählen für QR-Code bei Teilnahme'}
          >
            Ömerliste
          </a>
          {' · '}
          <a
            href={selectedEventId ? `/anmeldung/kemalettingruppe?eventId=${encodeURIComponent(selectedEventId)}` : '/anmeldung/kemalettingruppe'}
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-600 hover:underline"
            title={selectedEventId ? 'Mit Event verknüpft – bei „Ich nehme teil“ sofort QR-Code & E-Mail' : 'Event wählen für QR-Code bei Teilnahme'}
          >
            Kemalettingruppe
          </a>
        </p>
      </main>

      {qrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setQrModal(null)}>
          <div className="rounded-2xl bg-white p-6 shadow-xl max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 text-center">
              <h3 className="text-lg font-semibold text-gray-900">QR-Code erstellt</h3>
              <p className="text-sm text-gray-600">{qrModal.fullName}</p>
              {qrModal.eventTitle && <p className="text-xs text-gray-500 mt-1">{qrModal.eventTitle}</p>}
            </div>
            <div className="flex justify-center mb-4">
              <img
                src={`/api/checkin/qr?t=${encodeURIComponent(qrModal.checkInToken)}`}
                alt={`QR-Code für ${qrModal.fullName}`}
                className="h-48 w-48 rounded border border-gray-200 bg-white object-contain"
              />
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  try {
                    const res = await fetch(`/api/checkin/qr?t=${encodeURIComponent(qrModal.checkInToken)}`)
                    if (!res.ok) throw new Error()
                    const blob = await res.blob()
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `QR-${qrModal.fullName.replace(/\s+/g, '-')}.png`
                    a.click()
                    URL.revokeObjectURL(url)
                  } catch {
                    alert('Download fehlgeschlagen.')
                  }
                }}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
              >
                Download
              </button>
              {qrModal.acceptToken && (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const res = await fetch(`/api/invitations/accept/${encodeURIComponent(qrModal!.acceptToken!)}/send-qr-pdf`, { method: 'POST' })
                      const data = await res.json()
                      if (!res.ok) throw new Error(data.error)
                      alert('PDF wurde an die E-Mail-Adresse gesendet.')
                      window.dispatchEvent(new Event('email-sent'))
                    } catch {
                      alert('E-Mail konnte nicht gesendet werden.')
                    }
                  }}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                >
                  E-Mail senden
                </button>
              )}
              <button
                type="button"
                onClick={() => setQrModal(null)}
                className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
              >
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
