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

type GuestEntry = {
  id: string
  name: string
  email: string | null
  phone: string | null
  organization: string | null
  additionalData?: string | null
}

function getGuestVornameNachname(guest: GuestEntry): { vorname: string; nachname: string } {
  let vorname = ''
  let nachname = ''
  const additional = guest.additionalData
  if (additional) {
    try {
      const add = typeof additional === 'string' ? JSON.parse(additional) : additional
      if (add && typeof add === 'object') {
        vorname = String(add['Vorname'] ?? add['vorname'] ?? '').trim()
        nachname = String(add['Nachname'] ?? add['nachname'] ?? add['Name'] ?? '').trim()
      }
    } catch {
      /* ignore */
    }
  }
  if (!vorname && !nachname && guest.name) {
    const parts = String(guest.name).trim().split(/\s+/).filter(Boolean)
    vorname = parts[0] ?? ''
    nachname = parts.slice(1).join(' ') ?? ''
  }
  return { vorname, nachname }
}

function hasEinladungsliste(guest: GuestEntry): boolean {
  const additional = guest.additionalData
  if (!additional) return false
  try {
    const data = typeof additional === 'string' ? JSON.parse(additional) : additional
    if (!data || typeof data !== 'object') return false
    const key = Object.keys(data).find((k) => k.trim().toLowerCase() === 'einladungsliste')
    const value = key ? data[key] : undefined
    if (value === undefined) return false
    if (value === true || value === 1) return true
    if (typeof value === 'string') {
      const s = value.trim().toLowerCase()
      return s === 'true' || s === 'ja' || s === 'yes' || s === '1'
    }
    return false
  } catch {
    return false
  }
}

type GesamtEntry = {
  key: string
  firstName: string
  lastName: string
  fullName: string
  email: string | null
  phone: string | null
  district: string | null
  sources: string[]
  fromRegistration: boolean
  fromGuestList: boolean
  hasQr: boolean
  primaryReg?: Registration
  guest?: GuestEntry
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

function mergeGesamtList(mergedList: MergedEntry[], guests: GuestEntry[]): GesamtEntry[] {
  const map = new Map<string, GesamtEntry>()
  const nameKey = (name: string) => (name || '').trim().toLowerCase()

  for (const m of mergedList) {
    const k = nameKey(m.fullName)
    if (!k) continue
    const sources = [...m.sources]
    if (m.inGuestList) sources.push('Gästeliste')
    map.set(k, {
      key: k,
      firstName: m.firstName ?? '',
      lastName: m.lastName ?? '',
      fullName: m.fullName,
      email: m.email || null,
      phone: m.phone,
      district: m.district,
      sources: [...new Set(sources)],
      fromRegistration: true,
      fromGuestList: m.inGuestList,
      hasQr: m.hasQr,
      primaryReg: m.primaryReg,
    })
  }

  for (const g of guests) {
    const { vorname: guestFirstName, nachname: guestLastName } = getGuestVornameNachname(g)
    const fullName = [guestFirstName, guestLastName].filter(Boolean).join(' ').trim() || g.name
    const k = nameKey(fullName) || nameKey(g.name)
    if (!k) continue
    const existing = map.get(k)
    if (existing) {
      existing.fromGuestList = true
      if (!existing.sources.includes('Gästeliste')) existing.sources.push('Gästeliste')
      existing.guest = g
      if (!existing.firstName && guestFirstName) existing.firstName = guestFirstName
      if (!existing.lastName && guestLastName) existing.lastName = guestLastName
      existing.email = existing.email || g.email
      existing.phone = existing.phone || g.phone
      existing.district = existing.district || g.organization
    } else {
      map.set(k, {
        key: k,
        firstName: guestFirstName,
        lastName: guestLastName || g.name,
        fullName: fullName || g.name,
        email: g.email,
        phone: g.phone,
        district: g.organization,
        sources: ['Gästeliste'],
        fromRegistration: false,
        fromGuestList: true,
        hasQr: false,
        guest: g,
      })
    }
  }

  return Array.from(map.values()).sort((a, b) => a.fullName.localeCompare(b.fullName))
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

function filterGesamtBySearch(rows: GesamtEntry[], query: string): GesamtEntry[] {
  if (!query.trim()) return rows
  const q = query.trim().toLowerCase()
  return rows.filter(
    (g) =>
      g.firstName?.toLowerCase().includes(q) ||
      g.lastName?.toLowerCase().includes(q) ||
      g.fullName?.toLowerCase().includes(q) ||
      g.email?.toLowerCase().includes(q) ||
      g.district?.toLowerCase().includes(q) ||
      g.phone?.includes(q) ||
      g.sources.some((s) => s.toLowerCase().includes(q))
  )
}

function filterGesamtByNoQr(rows: GesamtEntry[], filterNoQr: boolean): GesamtEntry[] {
  if (!filterNoQr) return rows
  return rows.filter((g) => !g.hasQr)
}

export default function RegistrierungenPage() {
  const [list, setList] = useState<Registration[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterNoQr, setFilterNoQr] = useState(false)
  const [activeTab, setActiveTab] = useState<'gesamtliste' | 'uid-iftar' | 'sube-baskanlari' | 'kadin-kollari' | 'genclik-kollari' | 'fatihgruppe' | 'omerliste' | 'kemalettingruppe'>('gesamtliste')
  const [events, setEvents] = useState<EventOption[]>([])
  const [selectedEventId, setSelectedEventId] = useState<string>('')
  const [importing, setImporting] = useState<string | null>(null)
  const [fixing, setFixing] = useState<string | null>(null)
  const [acceptingId, setAcceptingId] = useState<string | null>(null)
  const [addingToInvitationListId, setAddingToInvitationListId] = useState<string | null>(null)
  const [sendingEmailId, setSendingEmailId] = useState<string | null>(null)
  const [updatingCalledId, setUpdatingCalledId] = useState<string | null>(null)
  const [removingDuplicates, setRemovingDuplicates] = useState(false)
  const [syncingToInvitations, setSyncingToInvitations] = useState(false)
  const [syncingFromInvitations, setSyncingFromInvitations] = useState(false)
  const [markingAllAsZusage, setMarkingAllAsZusage] = useState(false)
  const [guests, setGuests] = useState<GuestEntry[]>([])
  const [loadingGuests, setLoadingGuests] = useState(false)
  const [guestsRefreshKey, setGuestsRefreshKey] = useState(0)
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
    if (activeTab !== 'gesamtliste' || !selectedEventId) {
      setGuests([])
      return
    }
    let cancelled = false
    setLoadingGuests(true)
    fetch(`/api/guests?eventId=${encodeURIComponent(selectedEventId)}&einladungslisteOnly=true`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (cancelled) return
        const arr = Array.isArray(data) ? data : []
        setGuests(arr.map((g: { id?: string; name?: string; email?: string | null; phone?: string | null; organization?: string | null; additionalData?: string | null }) => ({
          id: g.id ?? '',
          name: (g.name || '').trim(),
          email: g.email ?? null,
          phone: g.phone ?? null,
          organization: g.organization ?? null,
          additionalData: g.additionalData ?? null,
        })))
      })
      .catch(() => { if (!cancelled) setGuests([]) })
      .finally(() => { if (!cancelled) setLoadingGuests(false) })
    return () => { cancelled = true }
  }, [activeTab, selectedEventId, guestsRefreshKey])

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

  const guestsWithEinladungsliste = guests.filter(hasEinladungsliste)
  const guestNamesLowerEinladungsliste = new Set(guestsWithEinladungsliste.map((g) => g.name.toLowerCase()).filter(Boolean))
  const mergedListForGesamt = mergeRegistrations(list, guestNamesLowerEinladungsliste)
  const gesamtList = mergeGesamtList(mergedListForGesamt, guestsWithEinladungsliste)
  const gesamtFiltered = filterGesamtByNoQr(filterGesamtBySearch(gesamtList, searchQuery), filterNoQr)

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

  const renderGesamtTable = (rows: GesamtEntry[]) => {
    const fromBoth = rows.filter((g) => g.fromRegistration && g.fromGuestList).length
    const onlyReg = rows.filter((g) => g.fromRegistration && !g.fromGuestList).length
    const onlyGuest = rows.filter((g) => !g.fromRegistration && g.fromGuestList).length
    const hasQrCount = rows.filter((g) => g.hasQr).length
    return (
      <div>
        <p className="mb-3 text-sm text-gray-600">
          <span className="font-medium">Gesamtanzahl: {rows.length} Einträge</span>
          {' · '}
          <span className="font-medium text-green-700">In beiden: {fromBoth}</span>
          {' · '}
          <span className="font-medium text-amber-700">Nur Anmeldungen: {onlyReg}</span>
          {' · '}
          <span className="font-medium text-blue-700">Nur Gästeliste: {onlyGuest}</span>
          {' · '}
          <span className="font-medium text-indigo-700">QR gesendet: {hasQrCount}</span>
        </p>
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Vorname</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Quelle</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">E-Mail</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Telefon</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Bezirk</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">QR</th>
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
                        : !selectedEventId
                          ? 'Bitte Event wählen.'
                          : 'Keine Einträge.'}
                  </td>
                </tr>
              ) : (
                rows.map((g) => (
                  <tr
                    key={g.key}
                    className={`hover:bg-gray-50 ${
                      g.fromRegistration && g.fromGuestList ? 'bg-green-50/50' : ''
                    } ${g.fromGuestList && !g.fromRegistration ? 'bg-blue-50/30' : ''} ${g.hasQr ? 'bg-indigo-50/30' : ''}`}
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">{g.firstName || '–'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">{g.lastName || g.fullName || '–'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      <span className="inline-flex flex-wrap gap-1">
                        {g.sources.map((s) => (
                          <span
                            key={s}
                            className={`rounded px-1.5 py-0.5 text-xs ${
                              s === 'Gästeliste' ? 'bg-blue-200' : 'bg-gray-200'
                            }`}
                          >
                            {s}
                          </span>
                        ))}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">{g.email || '–'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">{g.phone || '–'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">{g.district || '–'}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {g.hasQr ? (
                        <span className="inline-flex rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-800">Gesendet</span>
                      ) : (
                        <span className="text-gray-400">–</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-center">
                      {g.primaryReg && (
                        <div className="flex flex-wrap justify-center gap-1">
                          {g.hasQr ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleWhatsAppShare(g.primaryReg!)}
                                disabled={!selectedEventId}
                                className="rounded bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                              >
                                WhatsApp
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDownloadQr(g.primaryReg!)}
                                disabled={!selectedEventId}
                                className="rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                              >
                                Download
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSendEmailAgain(g.primaryReg!)}
                                disabled={!selectedEventId || sendingEmailId !== null}
                                className="rounded bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                              >
                                {sendingEmailId === g.primaryReg!.id ? '…' : 'E-Mail'}
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleAcceptParticipation(g.primaryReg!.id)}
                              disabled={!selectedEventId || acceptingId !== null}
                              className="rounded bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                            >
                              {acceptingId === g.primaryReg!.id ? '…' : 'QR erstellen'}
                            </button>
                          )}
                        </div>
                      )}
                      {!g.primaryReg && <span className="text-gray-400 text-xs">–</span>}
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
                      <div className="flex flex-wrap justify-center gap-1">
                        {r.invitationSentAt ? (
                          <>
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
                          </>
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
                        <button
                          type="button"
                          onClick={async () => {
                            if (!selectedEventId) return
                            setAddingToInvitationListId(r.id)
                            try {
                              const res = await fetch('/api/registrations/add-to-invitation-list', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ registrationId: r.id, eventId: selectedEventId }),
                              })
                              const data = await res.json()
                              if (!res.ok) throw new Error(data.error || 'Übernahme fehlgeschlagen')
                              loadRegistrations()
                              setGuestsRefreshKey((k) => k + 1)
                              alert(data.message || 'In Einladungsliste übernommen.')
                            } catch (e) {
                              alert(e instanceof Error ? e.message : 'Übernahme fehlgeschlagen')
                            } finally {
                              setAddingToInvitationListId(null)
                            }
                          }}
                          disabled={!selectedEventId || addingToInvitationListId !== null}
                          className="rounded bg-amber-600 px-2 py-1 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Diesen Eintrag in die Gästeliste und Einladungsliste übernehmen (z. B. wenn Name nicht automatisch zugeordnet wurde)"
                        >
                          {addingToInvitationListId === r.id ? '…' : 'In Einladungsliste'}
                        </button>
                      </div>
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
            onClick={() => setActiveTab('gesamtliste')}
            className={`rounded-t-lg px-4 py-2 text-sm font-medium ${
              activeTab === 'gesamtliste'
                ? 'border border-b-0 border-gray-200 bg-white text-indigo-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Gesamtliste ({gesamtList.length})
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
                onClick={() => handleImportToGuests(activeTab === 'gesamtliste' ? 'all' : activeTab)}
                disabled={!selectedEventId || importing !== null}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {importing === (activeTab === 'gesamtliste' ? 'all' : activeTab)
                  ? 'Import läuft …'
                  : activeTab === 'gesamtliste'
                    ? 'Alle in Gästeliste übernehmen'
                    : 'In Gästeliste übernehmen'}
              </button>
              <button
                type="button"
                onClick={() => handleFixImportedGuests(activeTab === 'gesamtliste' ? 'all' : activeTab)}
                disabled={!selectedEventId || fixing !== null}
                className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Vorname und Nachname in die richtigen Spalten übertragen (für bereits importierte Gäste)"
              >
                {fixing === (activeTab === 'gesamtliste' ? 'all' : activeTab) ? 'Korrektur läuft …' : 'Bereits importierte korrigieren'}
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
              <button
                type="button"
                onClick={async () => {
                  if (!selectedEventId) {
                    alert('Bitte wählen Sie ein Ziel-Event aus.')
                    return
                  }
                  if (!confirm('Abgleich durchführen? Gäste mit bestätigter Teilnahme in den Formular-Ergebnissen werden in der Einladungsliste als Zusage markiert.')) return
                  setSyncingToInvitations(true)
                  try {
                    const res = await fetch('/api/invitations/sync-from-registrations', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ eventId: selectedEventId }),
                    })
                    const data = await res.json()
                    if (!res.ok) throw new Error(data.error || 'Abgleich fehlgeschlagen')
                    alert(`${data.updated} Einladung(en) als Zusage markiert.`)
                  } catch (e) {
                    alert(e instanceof Error ? e.message : 'Abgleich fehlgeschlagen')
                  } finally {
                    setSyncingToInvitations(false)
                  }
                }}
                disabled={!selectedEventId || syncingToInvitations}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Teilnahme bestätigt in Formular-Ergebnissen → Einladungsliste als Zusage markieren"
              >
                {syncingToInvitations ? 'Abgleich läuft…' : '↔ Mit Einladungsliste abgleichen'}
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!selectedEventId) {
                    alert('Bitte wählen Sie ein Ziel-Event aus.')
                    return
                  }
                  if (!confirm('Zusagen und Absagen aus der Einladungsliste in die Ergebnisse der Anmeldung übernehmen?\n\nAnmeldungen werden per Name zugeordnet; Teilnahme (Ja/Nein) wird aus der Einladungsliste gesetzt.')) return
                  setSyncingFromInvitations(true)
                  try {
                    const res = await fetch('/api/registrations/sync-from-invitations', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ eventId: selectedEventId }),
                    })
                    const data = await res.json()
                    if (!res.ok) throw new Error(data.error || 'Übernahme fehlgeschlagen')
                    loadRegistrations()
                    alert(data.message || `${data.updated ?? 0} Anmeldung(en) aktualisiert.`)
                  } catch (e) {
                    alert(e instanceof Error ? e.message : 'Übernahme fehlgeschlagen')
                  } finally {
                    setSyncingFromInvitations(false)
                  }
                }}
                disabled={!selectedEventId || syncingFromInvitations}
                className="rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-50 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Zusagen/Absagen aus Einladungsliste in die Spalte Teilnahme (Ergebnisse der Anmeldung) zurückspielen"
              >
                {syncingFromInvitations ? 'Übernahme läuft…' : '↩ Zusagen/Absagen aus Einladungsliste wiederherstellen'}
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!selectedEventId) {
                    alert('Bitte wählen Sie ein Ziel-Event aus.')
                    return
                  }
                  if (!confirm('Alle Personen aus den Ergebnissen der Anmeldung in der Gästeliste als „Zusage“, „Nimmt teil“ und „Einladungsliste“ markieren?\n\nGäste werden per Name zugeordnet; fehlende Einladungen werden angelegt.')) return
                  setMarkingAllAsZusage(true)
                  try {
                    const res = await fetch('/api/registrations/mark-all-as-zusage-in-guests', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ eventId: selectedEventId }),
                    })
                    const data = await res.json()
                    if (!res.ok) throw new Error(data.error || 'Markierung fehlgeschlagen')
                    loadRegistrations()
                    setGuestsRefreshKey((k) => k + 1)
                    alert(data.message || `${data.guestsUpdated ?? 0} Gäste markiert.`)
                  } catch (e) {
                    alert(e instanceof Error ? e.message : 'Markierung fehlgeschlagen')
                  } finally {
                    setMarkingAllAsZusage(false)
                  }
                }}
                disabled={!selectedEventId || markingAllAsZusage}
                className="rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Alle Anmeldungen in der Gästeliste als Zusage, Nimmt teil und Einladungsliste markieren"
              >
                {markingAllAsZusage ? 'Markierung läuft…' : '✓ Alle in Gästeliste + Einladungsliste als Zusage/Nimmt teil'}
              </button>
              <span className="text-sm text-gray-500">
                Doppelte Namen werden übersprungen.
              </span>
            </div>
            {activeTab === 'gesamtliste' ? (
              <>
                <h2 className="mb-4 text-lg font-semibold text-gray-900">
                  Gesamtliste – alle Anmeldungen + Gästeliste (Einladungsliste) zusammengeführt
                </h2>
                {!selectedEventId ? (
                  <p className="text-amber-600">Bitte wählen Sie ein Ziel-Event für den Gästelisten-Vergleich.</p>
                ) : loadingGuests ? (
                  <p className="text-gray-500">Lade Gästeliste …</p>
                ) : (
                  renderGesamtTable(gesamtFiltered)
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
