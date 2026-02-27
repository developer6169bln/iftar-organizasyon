'use client'

import { useEffect, useMemo, useState } from 'react'
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
  tableNumber?: number | null
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

/** Telefonnummer für wa.me (nur Ziffern, 49 für DE). */
function phoneForWhatsApp(phone: string | null): string {
  const trimmed = (phone || '').trim()
  const raw = trimmed.replace(/\D/g, '')
  if (raw.length === 0) return ''
  if (trimmed.startsWith('+') || trimmed.startsWith('00')) return raw.replace(/^0+/, '')
  if (raw.startsWith('49') && raw.length >= 10) return raw
  if (raw.startsWith('0')) return '49' + raw.slice(1)
  return '49' + raw
}

/** Nachricht für WhatsApp: Eventinfo + Link zum QR-PDF (Gastname, QR-Code, Eventinfos). */
function getWhatsAppPdfMessage(qrPdfUrl: string, guestName: string, eventTitle: string): string {
  return `UID BERLIN IFTAR – Ihr Eintritts-QR-Code

Gast: ${guestName}
Veranstaltung: ${eventTitle}

📅 Datum: 27.02.2026, 16:30 Uhr
📍 Moon Events – Festsaal, Oranienstraße 140–142, 10969 Berlin

Ihr persönliches PDF mit QR-Code und Eventinfos:
${qrPdfUrl}`
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

/** Spool-Tisch: Wartende Gäste/Platzhalter (700). Presse: 801–812. VIP: 901–918 (ein VIP-Tisch mit 18 Plätzen). */
const SPOOL_TABLE = 700
const PRESSE_TABLE_START = 801
const PRESSE_SLOTS = 12
const VIP_TABLE_START = 901
const VIP_SLOTS = 18
function getSpecialTableLabel(n: number): string {
  if (n >= PRESSE_TABLE_START && n < PRESSE_TABLE_START + PRESSE_SLOTS) return 'Presse'
  if (n >= VIP_TABLE_START && n < VIP_TABLE_START + VIP_SLOTS) return 'VIP'
  return ''
}
function getSpecialTablePlatz(n: number): number {
  if (n >= PRESSE_TABLE_START && n < PRESSE_TABLE_START + PRESSE_SLOTS) return n - PRESSE_TABLE_START + 1
  if (n >= VIP_TABLE_START && n < VIP_TABLE_START + VIP_SLOTS) return n - VIP_TABLE_START + 1
  return 0
}

/** 4 Tischfarben zur Kategorisierung – gleiche Farbe + gleiches Geschlecht = gleicher Tischblock. */
const TISCHFARBE_OPTIONS: { value: string; label: string; bg: string; ring: string }[] = [
  { value: '1', label: 'Rot', bg: 'bg-red-400', ring: 'ring-red-600' },
  { value: '2', label: 'Blau', bg: 'bg-blue-400', ring: 'ring-blue-600' },
  { value: '3', label: 'Grün', bg: 'bg-green-400', ring: 'ring-green-600' },
  { value: '4', label: 'Gelb', bg: 'bg-amber-400', ring: 'ring-amber-600' },
]

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
  const [numTables, setNumTables] = useState(() => {
    if (typeof window === 'undefined') return 10
    const v = localStorage.getItem('registrierungen-numTables')
    return v ? parseInt(v, 10) || 10 : 10
  })
  const [seatsPerTable, setSeatsPerTable] = useState(() => {
    if (typeof window === 'undefined') return 8
    const v = localStorage.getItem('registrierungen-seatsPerTable')
    return v ? parseInt(v, 10) || 8 : 8
  })
  const [assigningTables, setAssigningTables] = useState(false)
  const [resettingTables, setResettingTables] = useState(false)
  const [tischlistenPdfLoading, setTischlistenPdfLoading] = useState(false)
  const [swapModal, setSwapModal] = useState<
    | { step: 1; guest: GesamtEntry; fromTable: number }
    | { step: 2; guest: GesamtEntry; fromTable: number; targetTable: number }
    | null
  >(null)
  const [swapInProgress, setSwapInProgress] = useState(false)
  const [weiblichUpdatingId, setWeiblichUpdatingId] = useState<string | null>(null)
  const [presseUpdatingId, setPresseUpdatingId] = useState<string | null>(null)
  const [tischfarbeUpdatingId, setTischfarbeUpdatingId] = useState<string | null>(null)
  const [vipAssignSlot, setVipAssignSlot] = useState<number | null>(null)
  const [vipAssignSearch, setVipAssignSearch] = useState('')
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [quickAddForm, setQuickAddForm] = useState({ firstName: '', lastName: '', staatInstitution: '' })
  const [quickAddSubmitting, setQuickAddSubmitting] = useState(false)
  const [isAppOwner, setIsAppOwner] = useState(false)
  const [adminAnmeldungenOpen, setAdminAnmeldungenOpen] = useState(false)
  const [duplicatesModalOpen, setDuplicatesModalOpen] = useState(false)
  const [duplicateRenameDraft, setDuplicateRenameDraft] = useState<Record<string, string>>({})
  const [duplicateActionLoading, setDuplicateActionLoading] = useState<string | null>(null)

  const duplicateGroups = useMemo(() => {
    const byKey = new Map<string, GuestEntry[]>()
    for (const g of guests) {
      const { vorname, nachname } = getGuestVornameNachname(g)
      const key = `${vorname.trim().toLowerCase()}|${nachname.trim().toLowerCase()}`
      if (!key || key === '|') continue
      if (!byKey.has(key)) byKey.set(key, [])
      byKey.get(key)!.push(g)
    }
    return Array.from(byKey.entries())
      .filter(([, list]) => list.length > 1)
      .map(([, list]) => {
        const first = list[0]
        const { vorname, nachname } = getGuestVornameNachname(first)
        const name = [vorname, nachname].filter(Boolean).join(' ').trim() || first.name || '–'
        return { name, guests: list }
      })
  }, [guests])

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
    fetch(`/api/guests?eventId=${encodeURIComponent(selectedEventId)}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (cancelled) return
        const arr = Array.isArray(data) ? data : []
        setGuests(arr.map((g: { id?: string; name?: string; email?: string | null; phone?: string | null; organization?: string | null; additionalData?: string | null; tableNumber?: number | null }) => ({
          id: g.id ?? '',
          name: (g.name || '').trim(),
          email: g.email ?? null,
          phone: g.phone ?? null,
          organization: g.organization ?? null,
          additionalData: g.additionalData ?? null,
          tableNumber: g.tableNumber ?? null,
        })))
      })
      .catch(() => { if (!cancelled) setGuests([]) })
      .finally(() => { if (!cancelled) setLoadingGuests(false) })
    return () => { cancelled = true }
  }, [activeTab, selectedEventId, guestsRefreshKey])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('registrierungen-numTables', String(numTables))
      localStorage.setItem('registrierungen-seatsPerTable', String(seatsPerTable))
    }
  }, [numTables, seatsPerTable])

  useEffect(() => {
    const loadMe = async () => {
      try {
        const projectId = typeof window !== 'undefined' ? localStorage.getItem('dashboard-project-id') : null
        const url = projectId ? `/api/me?projectId=${encodeURIComponent(projectId)}` : '/api/me'
        const res = await fetch(url, { credentials: 'include' })
        if (!res.ok) return
        const data = await res.json()
        setIsAppOwner(!!data.isAdmin || !!data.isProjectOwner)
      } catch {
        setIsAppOwner(false)
      }
    }
    loadMe()
  }, [])

  const handleAssignRandomTables = async () => {
    if (!selectedEventId) {
      alert('Bitte Event wählen.')
      return
    }
    if (numTables < 1 || seatsPerTable < 1) {
      alert('Anzahl Tische und Sitzplätze pro Tisch müssen mindestens 1 sein.')
      return
    }
    setAssigningTables(true)
    try {
      const res = await fetch('/api/guests/assign-tables-random', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: selectedEventId,
          numTables: Number(numTables),
          seatsPerTable: Number(seatsPerTable),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Zuweisung fehlgeschlagen')
      setGuestsRefreshKey((k) => k + 1)
      const parts = [`${data.assigned} Gäste mit Zusage wurden Tischen zugewiesen.`]
      if (data.tablesAutoAdjusted && data.numTablesUsed != null) {
        setNumTables(data.numTablesUsed)
        if (typeof window !== 'undefined') localStorage.setItem('registrierungen-numTables', String(data.numTablesUsed))
        parts.push(` Anzahl Tische wurde automatisch auf ${data.numTablesUsed} angepasst (Gruppen: Geschlecht + Tischfarbe).`)
      }
      if (data.unassigned > 0) parts.push(`${data.unassigned} ohne Platz.`)
      if (data.skippedNoZusage > 0) parts.push(`${data.skippedNoZusage} ohne Zusage/Nimmt teil (kein Tisch).`)
      if (data.skippedVip) parts.push(`${data.skippedVip} VIP(s) unverändert.`)
      alert(parts.join(' '))
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Tischzuweisung fehlgeschlagen')
    } finally {
      setAssigningTables(false)
    }
  }

  const handleResetAllTables = async () => {
    if (!selectedEventId) {
      alert('Bitte Event wählen.')
      return
    }
    if (!confirm('Alle Tischnummern für dieses Event zurücksetzen? VIP-Gäste behalten ihre Zuweisung nicht.')) return
    setResettingTables(true)
    try {
      const res = await fetch('/api/guests/reset-tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: selectedEventId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Zurücksetzen fehlgeschlagen')
      setGuestsRefreshKey((k) => k + 1)
      alert(`${data.count} Gäste: Tische zurückgesetzt.`)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Zurücksetzen fehlgeschlagen')
    } finally {
      setResettingTables(false)
    }
  }

  const handleExportTischlistenPdf = async () => {
    if (!selectedEventId) {
      alert('Bitte Event wählen.')
      return
    }
    setTischlistenPdfLoading(true)
    try {
      const res = await fetch(`/api/guests/export-tischlisten-pdf?eventId=${encodeURIComponent(selectedEventId)}`, { credentials: 'include' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'PDF konnte nicht erstellt werden.')
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = res.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] || `Tischlisten_${new Date().toISOString().split('T')[0]}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error(e)
      alert(e instanceof Error ? e.message : 'PDF konnte nicht erstellt werden.')
    } finally {
      setTischlistenPdfLoading(false)
    }
  }

  const handleTableSwapStart = (guest: GesamtEntry, fromTable: number) => {
    if (!guest.guest?.id) return
    setSwapModal({ step: 1, guest, fromTable })
  }

  const handleMoveToSpool = async (g: GesamtEntry) => {
    if (!g.guest?.id) return
    setSwapInProgress(true)
    try {
      const res = await fetch('/api/guests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: g.guest.id, tableNumber: SPOOL_TABLE }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Verschieben fehlgeschlagen')
      }
      setGuestsRefreshKey((k) => k + 1)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Auf Spool verschieben fehlgeschlagen.')
    } finally {
      setSwapInProgress(false)
    }
  }

  const handleTableSwapSelectTarget = async (targetTable: number) => {
    if (!swapModal || swapModal.step !== 1) return
    if (swapModal.fromTable === SPOOL_TABLE) {
      setSwapInProgress(true)
      try {
        const res = await fetch('/api/guests', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: swapModal.guest.guest!.id, tableNumber: targetTable }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || 'Verschieben fehlgeschlagen')
        }
        setSwapModal(null)
        setGuestsRefreshKey((k) => k + 1)
      } catch (e) {
        alert(e instanceof Error ? e.message : 'Verschieben fehlgeschlagen.')
      } finally {
        setSwapInProgress(false)
      }
      return
    }
    setSwapModal({ step: 2, guest: swapModal.guest, fromTable: swapModal.fromTable, targetTable })
  }

  const handleTableSwapConfirm = async (otherGuest: GesamtEntry) => {
    if (!swapModal || swapModal.step !== 2 || !otherGuest.guest?.id || !swapModal.guest.guest?.id || !selectedEventId) return
    setSwapInProgress(true)
    try {
      const resA = await fetch('/api/guests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: swapModal.guest.guest.id, tableNumber: swapModal.targetTable }),
      })
      const resB = await fetch('/api/guests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: otherGuest.guest.id, tableNumber: swapModal.fromTable }),
      })
      if (!resA.ok || !resB.ok) {
        const errA = resA.ok ? null : await resA.json().catch(() => ({}))
        const errB = resB.ok ? null : await resB.json().catch(() => ({}))
        throw new Error((errA?.error || errB?.error) || 'Tausch fehlgeschlagen')
      }
      setSwapModal(null)
      setGuestsRefreshKey((k) => k + 1)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Tausch fehlgeschlagen')
    } finally {
      setSwapInProgress(false)
    }
  }

  function isGuestWeiblich(guest: GuestEntry | undefined): boolean {
    if (!guest?.additionalData) return false
    try {
      const add = typeof guest.additionalData === 'string' ? JSON.parse(guest.additionalData) : guest.additionalData
      const v = add?.['Weiblich'] ?? add?.['weiblich']
      return v === true || v === 1 || (typeof v === 'string' && ['true', 'ja', 'yes', '1'].includes(String(v).trim().toLowerCase()))
    } catch {
      return false
    }
  }

  const handleToggleWeiblich = async (g: GesamtEntry) => {
    if (!g.guest?.id) return
    setWeiblichUpdatingId(g.guest.id)
    try {
      const add = g.guest.additionalData ? JSON.parse(g.guest.additionalData) : {}
      const next = !isGuestWeiblich(g.guest)
      const updated = { ...add, Weiblich: next }
      const res = await fetch('/api/guests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: g.guest.id, additionalData: JSON.stringify(updated) }),
      })
      if (!res.ok) throw new Error('Aktualisierung fehlgeschlagen')
      setGuestsRefreshKey((k) => k + 1)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Änderung fehlgeschlagen')
    } finally {
      setWeiblichUpdatingId(null)
    }
  }

  function isGuestPresse(guest: GuestEntry | undefined): boolean {
    if (!guest?.additionalData) return false
    try {
      const add = typeof guest.additionalData === 'string' ? JSON.parse(guest.additionalData) : guest.additionalData
      const v = add?.['Presse'] ?? add?.['presse']
      return v === true || v === 1 || (typeof v === 'string' && ['true', 'ja', 'yes', '1'].includes(String(v).trim().toLowerCase()))
    } catch {
      return false
    }
  }

  const handleTogglePresse = async (g: GesamtEntry) => {
    if (!g.guest?.id) return
    setPresseUpdatingId(g.guest.id)
    try {
      const add = g.guest.additionalData ? JSON.parse(g.guest.additionalData) : {}
      const next = !isGuestPresse(g.guest)
      const updated = { ...add, Presse: next }
      const res = await fetch('/api/guests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: g.guest.id, additionalData: JSON.stringify(updated) }),
      })
      if (!res.ok) throw new Error('Aktualisierung fehlgeschlagen')
      setGuestsRefreshKey((k) => k + 1)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Änderung fehlgeschlagen')
    } finally {
      setPresseUpdatingId(null)
    }
  }

  function isGuestAnwesend(guest: GuestEntry | undefined): boolean {
    if (!guest?.additionalData) return false
    try {
      const add = typeof guest.additionalData === 'string' ? JSON.parse(guest.additionalData) : guest.additionalData
      const v = add?.['Anwesend'] ?? add?.['anwesend']
      return v === true || v === 1 || (typeof v === 'string' && ['true', 'ja', 'yes', '1'].includes(String(v).trim().toLowerCase()))
    } catch {
      return false
    }
  }

  function getGuestTischfarbe(guest: GuestEntry | undefined): string {
    if (!guest?.additionalData) return ''
    try {
      const add = typeof guest.additionalData === 'string' ? JSON.parse(guest.additionalData) : guest.additionalData
      const v = add?.['Tischfarbe'] ?? add?.['tischfarbe']
      const s = String(v ?? '').trim()
      return s === '1' || s === '2' || s === '3' || s === '4' ? s : ''
    } catch {
      return ''
    }
  }

  const handleAssignGuestToVipSlot = async (guestId: string, slotTableNum: number) => {
    try {
      const res = await fetch('/api/guests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: guestId, tableNumber: slotTableNum }),
      })
      if (!res.ok) throw new Error('Zuweisung fehlgeschlagen')
      setGuestsRefreshKey((k) => k + 1)
      setVipAssignSlot(null)
      setVipAssignSearch('')
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Zuweisung fehlgeschlagen')
    }
  }

  const handleClearVipSlot = async (guestId: string) => {
    try {
      const res = await fetch('/api/guests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: guestId, tableNumber: null }),
      })
      if (!res.ok) throw new Error('Entfernen fehlgeschlagen')
      setGuestsRefreshKey((k) => k + 1)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Entfernen fehlgeschlagen')
    }
  }

  const handleSetTischfarbe = async (g: GesamtEntry, value: string) => {
    if (!g.guest?.id) return
    setTischfarbeUpdatingId(g.guest.id)
    try {
      const add = g.guest.additionalData ? JSON.parse(g.guest.additionalData) : {}
      const updated = { ...add, Tischfarbe: value || undefined }
      if (value === '') delete updated.Tischfarbe
      const res = await fetch('/api/guests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: g.guest.id, additionalData: JSON.stringify(updated) }),
      })
      if (!res.ok) throw new Error('Aktualisierung fehlgeschlagen')
      setGuestsRefreshKey((k) => k + 1)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Änderung fehlgeschlagen')
    } finally {
      setTischfarbeUpdatingId(null)
    }
  }

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

  const guestNamesLower = new Set(
    guests.map((g) => {
      const { vorname, nachname } = getGuestVornameNachname(g)
      const full = [vorname, nachname].filter(Boolean).join(' ').trim() || g.name || ''
      return full.toLowerCase()
    }).filter(Boolean)
  )
  const mergedListForGesamt = mergeRegistrations(list, guestNamesLower)
  const gesamtList = mergeGesamtList(mergedListForGesamt, guests)
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

  const handleQuickAddSubmit = async () => {
    if (!selectedEventId) return
    const firstName = quickAddForm.firstName.trim()
    const lastName = quickAddForm.lastName.trim()
    if (!firstName && !lastName) {
      alert('Bitte Vorname oder Nachname eingeben.')
      return
    }
    setQuickAddSubmitting(true)
    try {
      const res = await fetch('/api/guests/quick-add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: selectedEventId,
          firstName,
          lastName,
          staatInstitution: quickAddForm.staatInstitution.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || data.details || 'Schnellerfassung fehlgeschlagen.')
        return
      }
      setQuickAddOpen(false)
      setQuickAddForm({ firstName: '', lastName: '', staatInstitution: '' })
      setGuestsRefreshKey((k) => k + 1)
      alert(data.message || 'Gast erfasst.')
    } catch (e) {
      console.error(e)
      alert('Schnellerfassung fehlgeschlagen.')
    } finally {
      setQuickAddSubmitting(false)
    }
  }

  const handleDuplicateRename = async (guestId: string, newName: string) => {
    const trimmed = newName.trim()
    if (!trimmed) return
    setDuplicateActionLoading(guestId)
    try {
      const res = await fetch('/api/guests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: guestId, name: trimmed }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Aktualisierung fehlgeschlagen')
      setDuplicateRenameDraft((prev) => {
        const next = { ...prev }
        delete next[guestId]
        return next
      })
      setGuestsRefreshKey((k) => k + 1)
    } catch (e) {
      console.error(e)
      alert(e instanceof Error ? e.message : 'Umbenennen fehlgeschlagen.')
    } finally {
      setDuplicateActionLoading(null)
    }
  }

  const handleDuplicateDeleteGroup = async (guestIds: string[]) => {
    if (!confirm(`Wirklich ${guestIds.length} Einträge löschen?`)) return
    setDuplicateActionLoading('delete-group')
    try {
      for (const id of guestIds) {
        const res = await fetch(`/api/guests?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Löschen fehlgeschlagen')
        }
      }
      setGuestsRefreshKey((k) => k + 1)
      setDuplicatesModalOpen(false)
    } catch (e) {
      console.error(e)
      alert(e instanceof Error ? e.message : 'Löschen fehlgeschlagen.')
    } finally {
      setDuplicateActionLoading(null)
    }
  }

  const handleDuplicateMoveToNewTable = async (guestsInGroup: GuestEntry[]) => {
    const normalTableNumbers = guests
      .map((g) => g.tableNumber)
      .filter((t): t is number => t != null && t < PRESSE_TABLE_START && t !== SPOOL_TABLE)
    const maxTable = normalTableNumbers.length > 0 ? Math.max(...normalTableNumbers) : 0
    const newTable = maxTable + 1
    setDuplicateActionLoading('move-group')
    try {
      for (const g of guestsInGroup) {
        const res = await fetch('/api/guests', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: g.id, tableNumber: newTable }),
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Verschieben fehlgeschlagen')
        }
      }
      setGuestsRefreshKey((k) => k + 1)
    } catch (e) {
      console.error(e)
      alert(e instanceof Error ? e.message : 'Verschieben fehlgeschlagen.')
    } finally {
      setDuplicateActionLoading(null)
    }
  }

  const handleWhatsAppShare = async (r: Registration) => {
    if (!selectedEventId) return
    const info = await fetchQrInfo(r.id)
    if (!info?.acceptToken) {
      alert('QR-PDF konnte nicht geladen werden.')
      return
    }
    const base = typeof window !== 'undefined' ? window.location.origin : ''
    const qrPdfUrl = `${base}/api/invitations/accept/${encodeURIComponent(info.acceptToken)}/qr-pdf`
    const guestName = info.fullName || [r.firstName, r.lastName].filter(Boolean).join(' ').trim()
    const eventTitle = events.find((e) => e.id === selectedEventId)?.title || 'Veranstaltung'
    const text = getWhatsAppPdfMessage(qrPdfUrl, guestName, eventTitle)
    const phone = phoneForWhatsApp(r.phone)
    if (phone) {
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer')
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer')
    }
  }

  const renderGesamtTable = (rows: GesamtEntry[]) => {
    const fromBoth = rows.filter((g) => g.fromRegistration && g.fromGuestList).length
    const onlyReg = rows.filter((g) => g.fromRegistration && !g.fromGuestList).length
    const onlyGuest = rows.filter((g) => !g.fromRegistration && g.fromGuestList).length
    const hasQrCount = rows.filter((g) => g.hasQr).length
    const withTable = rows.filter((g) => g.guest?.tableNumber != null).length
    const withoutTable = rows.length - withTable
    const byTable = new Map<number, GesamtEntry[]>()
    for (const g of rows) {
      const tn = g.guest?.tableNumber
      if (tn != null) {
        if (!byTable.has(tn)) byTable.set(tn, [])
        byTable.get(tn)!.push(g)
      }
    }
    if (!byTable.has(SPOOL_TABLE)) byTable.set(SPOOL_TABLE, [])
    for (let t = PRESSE_TABLE_START; t < PRESSE_TABLE_START + PRESSE_SLOTS; t++) if (!byTable.has(t)) byTable.set(t, [])
    for (let t = VIP_TABLE_START; t < VIP_TABLE_START + VIP_SLOTS; t++) if (!byTable.has(t)) byTable.set(t, [])
    const allTableNumbers = Array.from(byTable.keys()).sort((a, b) => a - b)
    const normalTableNumbers = allTableNumbers.filter((n) => n < PRESSE_TABLE_START && n !== SPOOL_TABLE)
    return (
      <div>
        <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
          <h3 className="mb-3 text-sm font-semibold text-gray-800">Tischzuweisung (Random)</h3>
          <p className="mb-3 text-xs text-gray-600">
            <strong>Presse</strong> (Checkbox „P“) sitzt immer an Tisch 1 (eigener Presse-Tisch). Keine gemischten Tische: Gruppierung nach Geschlecht (Weiblich) und Tischfarbe. Bei Bedarf wird die Anzahl Tische automatisch erhöht.
            Nur Gäste mit Zusage/Nimmt teil erhalten einen Tisch; VIP-Gäste werden nicht geändert.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2">
              <span className="text-sm text-gray-700">Anzahl Tische</span>
              <input
                type="number"
                min={1}
                value={numTables}
                onChange={(e) => setNumTables(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-20 rounded border border-gray-300 px-2 py-1 text-sm"
              />
            </label>
            <label className="flex items-center gap-2">
              <span className="text-sm text-gray-700">Sitzplätze pro Tisch</span>
              <input
                type="number"
                min={1}
                value={seatsPerTable}
                onChange={(e) => setSeatsPerTable(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-20 rounded border border-gray-300 px-2 py-1 text-sm"
              />
            </label>
            <button
              type="button"
              onClick={handleAssignRandomTables}
              disabled={!selectedEventId || assigningTables}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {assigningTables ? '… Zuweisung läuft' : 'Random Tischzuweisung'}
            </button>
            <button
              type="button"
              onClick={handleResetAllTables}
              disabled={!selectedEventId || resettingTables}
              className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {resettingTables ? '…' : 'Alle Tische zurücksetzen'}
            </button>
            <button
              type="button"
              onClick={handleExportTischlistenPdf}
              disabled={!selectedEventId || tischlistenPdfLoading}
              className="rounded-lg bg-slate-600 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {tischlistenPdfLoading ? '… PDF wird erstellt' : 'Tischlisten als PDF'}
            </button>
          </div>
        </div>
        {(normalTableNumbers.length > 0 || selectedEventId) && (
          <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-semibold text-gray-800">Tische nach Nummer (zugewiesene Gäste)</h3>
            <p className="mb-3 text-xs text-gray-500">„P“ = Presse; „W“ = Weiblich; 4 Farben = Tischfarbe. Anwesend = Name grün. „Auf Spool“ = Warteliste; „Verschieben“ = Tausch/Ziel. Spool (700), Presse (801–812), VIP (901–918, 18 Plätze) = Platzhalter.</p>
            <div className="grid grid-cols-2 gap-4">
              {normalTableNumbers.map((num) => {
                const guestsAtTable = byTable.get(num)!
                return (
                  <div key={num} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <div className="mb-2 font-semibold text-gray-800">Tisch {num}</div>
                    <ul className="space-y-2 text-sm text-gray-700">
                      {guestsAtTable.map((g) => {
                        const weiblich = isGuestWeiblich(g.guest)
                        const presse = isGuestPresse(g.guest)
                        const anwesend = isGuestAnwesend(g.guest)
                        const updating = g.guest?.id === weiblichUpdatingId
                        const presseUpd = g.guest?.id === presseUpdatingId
                        const farbeUpdating = g.guest?.id === tischfarbeUpdatingId
                        const currentFarbe = getGuestTischfarbe(g.guest)
                        const nameText = g.fullName || `${g.firstName} ${g.lastName}`.trim() || '–'
                        const nameClass = `min-w-0 flex-1 truncate ${anwesend ? 'rounded bg-emerald-100 px-1.5 py-0.5 font-medium text-emerald-800' : ''}`
                        return (
                          <li key={g.key} className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              {g.guest?.id ? (
                                <>
                                  <label className="flex shrink-0 items-center gap-0.5" title="Presse (Tisch 1)">
                                    <input
                                      type="checkbox"
                                      checked={presse}
                                      disabled={presseUpd}
                                      onChange={() => handleTogglePresse(g)}
                                      className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                                    />
                                    <span className="text-xs text-gray-500">P</span>
                                  </label>
                                  <label className="flex shrink-0 items-center gap-0.5" title="Weiblich">
                                    <input
                                      type="checkbox"
                                      checked={weiblich}
                                      disabled={updating}
                                      onChange={() => handleToggleWeiblich(g)}
                                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <span className="text-xs text-gray-500">W</span>
                                  </label>
                                  <span className={nameClass} title={anwesend ? 'Anwesend' : undefined}>{nameText}</span>
                                  <button
                                    type="button"
                                    disabled={swapInProgress}
                                    onClick={() => handleMoveToSpool(g)}
                                    className="shrink-0 rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 hover:bg-slate-200"
                                    title="Gast auf Spool (Warteliste) verschieben"
                                  >
                                    Auf Spool
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleTableSwapStart(g, num)}
                                    className="shrink-0 rounded bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-800 hover:bg-indigo-200"
                                    title="Gast an anderen Tisch tauschen"
                                  >
                                    Verschieben
                                  </button>
                                </>
                              ) : (
                                <span className={nameClass} title={anwesend ? 'Anwesend' : undefined}>{nameText}</span>
                              )}
                            </div>
                            {g.guest?.id && (
                              <div className="flex items-center gap-1 pl-6">
                                <span className="text-xs text-gray-400">Farbe:</span>
                                <button
                                  type="button"
                                  disabled={farbeUpdating}
                                  onClick={() => handleSetTischfarbe(g, '')}
                                  title="Keine Farbe"
                                  className={`h-5 w-5 rounded-full border-2 ${currentFarbe === '' ? 'border-gray-700 bg-gray-300' : 'border-gray-300 bg-gray-100 hover:bg-gray-200'}`}
                                />
                                {TISCHFARBE_OPTIONS.map((opt) => (
                                  <button
                                    key={opt.value}
                                    type="button"
                                    disabled={farbeUpdating}
                                    onClick={() => handleSetTischfarbe(g, opt.value)}
                                    title={opt.label}
                                    className={`h-5 w-5 rounded-full border-2 ${opt.bg} ${currentFarbe === opt.value ? `ring-2 ${opt.ring}` : 'border-gray-300 hover:opacity-90'}`}
                                  />
                                ))}
                              </div>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )
              })}
            </div>
            {/* Spool: Wartende Gäste / Platzhalter – von hier auf andere Tische verschieben */}
            <div className="mt-4 rounded-lg border-2 border-slate-300 bg-slate-50/80 p-3">
              <div className="mb-2 font-semibold text-slate-800">Spool (Warteliste)</div>
              <p className="mb-2 text-xs text-slate-600">Wartende Gäste und Platzhalter – mit „Verschieben“ auf einen Tisch setzen.</p>
              <ul className="space-y-2 text-sm text-gray-700">
                {(byTable.get(SPOOL_TABLE) ?? []).map((g) => {
                  const nameText = g.fullName || `${g.firstName} ${g.lastName}`.trim() || '–'
                  const anwesend = isGuestAnwesend(g.guest)
                  return (
                    <li key={g.key} className="flex items-center justify-between gap-2 rounded bg-white/70 px-2 py-1.5">
                      <span className={`min-w-0 flex-1 truncate ${anwesend ? 'rounded bg-emerald-100 px-1.5 py-0.5 font-medium text-emerald-800' : 'text-gray-800'}`}>{nameText}</span>
                      {g.guest?.id && (
                        <button
                          type="button"
                          disabled={swapInProgress}
                          onClick={() => handleTableSwapStart(g, SPOOL_TABLE)}
                          className="shrink-0 rounded bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-800 hover:bg-indigo-200"
                          title="Gast an Tisch verschieben"
                        >
                          Verschieben
                        </button>
                      )}
                    </li>
                  )
                })}
                {(byTable.get(SPOOL_TABLE) ?? []).length === 0 && (
                  <li className="rounded bg-white/50 px-2 py-2 text-gray-500">Keine Gäste auf Spool.</li>
                )}
              </ul>
            </div>
            {/* Presse (12) / VIP (18): Platzhalter – Gast zuweisen oder entfernen */}
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { label: 'Presse', start: PRESSE_TABLE_START, slots: PRESSE_SLOTS, border: 'border-slate-300', bg: 'bg-slate-50/80', title: 'text-slate-800', btn: 'bg-slate-200 text-slate-800 hover:bg-slate-300' },
                { label: 'VIP', start: VIP_TABLE_START, slots: VIP_SLOTS, border: 'border-amber-200', bg: 'bg-amber-50/80', title: 'text-amber-900', btn: 'bg-amber-200 text-amber-900 hover:bg-amber-300' },
              ].map(({ label, start, slots, border, bg, title, btn }) => (
                <div key={label} className={`rounded-lg border-2 ${border} ${bg} p-3`}>
                  <div className={`mb-2 font-semibold ${title}`}>{label}</div>
                  <ul className="space-y-1.5 text-sm text-gray-700">
                    {Array.from({ length: slots }, (_, i) => {
                      const slotNum = start + i
                      const guests = byTable.get(slotNum) ?? []
                      const g = guests[0]
                      const nameText = g ? (g.fullName || `${g.firstName} ${g.lastName}`.trim() || '–') : '–'
                      const anwesend = g && isGuestAnwesend(g.guest)
                      return (
                        <li key={slotNum} className="flex items-center justify-between gap-2 rounded bg-white/70 px-2 py-1">
                          <span className={`min-w-0 flex-1 truncate font-medium ${title}`}>Platz {i + 1}</span>
                          <span className={`min-w-0 flex-1 truncate ${anwesend ? 'rounded bg-emerald-100 px-1 font-medium text-emerald-800' : 'text-gray-700'}`}>{nameText}</span>
                          <div className="flex shrink-0 gap-1">
                            {g?.guest?.id ? (
                              <button
                                type="button"
                                onClick={() => handleClearVipSlot(g.guest!.id!)}
                                className="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 hover:bg-red-200"
                              >
                                Entfernen
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setVipAssignSlot(slotNum)}
                                className={`rounded px-2 py-0.5 text-xs font-medium ${btn}`}
                              >
                                Gast zuweisen
                              </button>
                            )}
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}
        {/* Modal: Tisch tauschen – Schritt 1 Zieltisch wählen, Schritt 2 Gast von Zieltisch wählen */}
        {swapModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !swapInProgress && setSwapModal(null)}>
            <div className="max-h-[90vh] w-full max-w-md overflow-auto rounded-xl bg-white p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
              {swapModal.step === 1 ? (
                <>
                  <h3 className="mb-2 text-sm font-semibold text-gray-800">Gast an anderen Tisch verschieben</h3>
                  <p className="mb-3 text-xs text-gray-600">
                    {swapModal.guest.fullName || [swapModal.guest.firstName, swapModal.guest.lastName].filter(Boolean).join(' ') || '–'} sitzt aktuell an Tisch {swapModal.fromTable}. Zu welchem Tisch soll gewechselt werden?
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {normalTableNumbers.filter((n) => n !== swapModal.fromTable).map((n) => (
                      <button
                        key={n}
                        type="button"
                        disabled={swapInProgress}
                        onClick={() => handleTableSwapSelectTarget(n)}
                        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                      >
                        Tisch {n}
                      </button>
                    ))}
                    {swapModal.fromTable !== SPOOL_TABLE && (
                      <button
                        type="button"
                        disabled={swapInProgress}
                        onClick={() => handleTableSwapSelectTarget(SPOOL_TABLE)}
                        className="rounded-lg bg-slate-600 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                      >
                        Spool
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <h3 className="mb-2 text-sm font-semibold text-gray-800">Tauschpartner wählen</h3>
                  <p className="mb-3 text-xs text-gray-600">
                    Wer soll von Tisch {swapModal.targetTable} zu Tisch {swapModal.fromTable} wechseln? (Klick auf einen Gast führt den Tausch aus.)
                  </p>
                  <ul className="space-y-2">
                    {(byTable.get(swapModal.targetTable) ?? []).map((g) => (
                      <li key={g.key}>
                        <button
                          type="button"
                          disabled={swapInProgress}
                          onClick={() => handleTableSwapConfirm(g)}
                          className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-left text-sm text-gray-800 hover:bg-indigo-50 hover:border-indigo-200 disabled:opacity-50"
                        >
                          {g.fullName || [g.firstName, g.lastName].filter(Boolean).join(' ') || '–'}
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => !swapInProgress && setSwapModal(null)}
                  className="rounded bg-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-300 disabled:opacity-50"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Modal: Gast für Presse-/VIP-Platz auswählen */}
        {vipAssignSlot != null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => { setVipAssignSlot(null); setVipAssignSearch('') }}>
            <div className="max-h-[90vh] w-full max-w-md overflow-auto rounded-xl bg-white p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <h3 className="mb-2 text-sm font-semibold text-gray-800">
                Gast für {getSpecialTableLabel(vipAssignSlot)} Platz {getSpecialTablePlatz(vipAssignSlot)} zuweisen
              </h3>
              <p className="mb-2 text-xs text-gray-600">Gast aus der Liste wählen (wird diesem Platz zugewiesen).</p>
              <input
                type="search"
                placeholder="Gast suchen…"
                value={vipAssignSearch}
                onChange={(e) => setVipAssignSearch(e.target.value)}
                className="mb-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
              <ul className="max-h-80 space-y-1 overflow-y-auto">
                {rows
                  .filter((g) => g.guest?.id)
                  .filter((g) => {
                    const q = vipAssignSearch.trim().toLowerCase()
                    if (!q) return true
                    const name = (g.fullName || [g.firstName, g.lastName].filter(Boolean).join(' ') || '').toLowerCase()
                    return name.includes(q)
                  })
                  .map((g) => (
                  <li key={g.guest!.id}>
                    <button
                      type="button"
                      onClick={() => handleAssignGuestToVipSlot(g.guest!.id!, vipAssignSlot)}
                      className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-left text-sm text-gray-800 hover:bg-amber-100 hover:border-amber-300"
                    >
                      {g.fullName || [g.firstName, g.lastName].filter(Boolean).join(' ') || '–'}
                    </button>
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex justify-end">
                <button type="button" onClick={() => { setVipAssignSlot(null); setVipAssignSearch('') }} className="rounded bg-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-300">
                  Abbrechen
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Modal: Schnellanmeldung – Vorname, Nachname, Staat/Institution */}
        {quickAddOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !quickAddSubmitting && setQuickAddOpen(false)}>
            <div className="w-full max-w-md rounded-xl bg-white p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <h3 className="mb-3 text-sm font-semibold text-gray-800">Schnellanmeldung</h3>
              <p className="mb-3 text-xs text-gray-600">
                Gast nur mit Vorname, Nachname und optional Staat/Institution erfassen. Wird sofort als <strong>Zusage / Nimmt teil</strong> markiert, in die <strong>Einladungsliste</strong> aufgenommen und auf die <strong>Spool-Warteliste</strong> gesetzt. Von dort kann der Gast an einen Tisch verschoben werden.
              </p>
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Vorname</label>
                  <input
                    type="text"
                    value={quickAddForm.firstName}
                    onChange={(e) => setQuickAddForm((f) => ({ ...f, firstName: e.target.value }))}
                    placeholder="Vorname"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Nachname</label>
                  <input
                    type="text"
                    value={quickAddForm.lastName}
                    onChange={(e) => setQuickAddForm((f) => ({ ...f, lastName: e.target.value }))}
                    placeholder="Nachname"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Staat/Institution (optional)</label>
                  <input
                    type="text"
                    value={quickAddForm.staatInstitution}
                    onChange={(e) => setQuickAddForm((f) => ({ ...f, staatInstitution: e.target.value }))}
                    placeholder="z. B. Botschaft, Verein"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => !quickAddSubmitting && setQuickAddOpen(false)}
                  className="rounded bg-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-300 disabled:opacity-50"
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  onClick={handleQuickAddSubmit}
                  disabled={quickAddSubmitting || (!quickAddForm.firstName.trim() && !quickAddForm.lastName.trim())}
                  className="rounded bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {quickAddSubmitting ? '… Erfassen' : 'Erfassen'}
                </button>
              </div>
            </div>
          </div>
        )}
        <p className="mb-3 text-sm text-gray-600">
          <span className="font-medium">Gesamtanzahl: {rows.length} Einträge</span>
          {' · '}
          <span className="font-medium text-green-700">Mit Tisch: {withTable}</span>
          {withoutTable > 0 && (
            <>
              {' · '}
              <span className="font-medium text-red-700">Ohne Tisch: {withoutTable}</span>
            </>
          )}
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
                <th className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500">Einladungsliste</th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500">Zusage</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">E-Mail</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Telefon</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Bezirk</th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500">Tisch</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">QR</th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500">Aktion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-sm text-gray-500">
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
                    <td className="whitespace-nowrap px-4 py-3 text-center">
                      {g.fromGuestList ? (
                        <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">Ja</span>
                      ) : (
                        <span className="text-gray-400">–</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-center">
                      {g.hasQr ? (
                        <span className="inline-flex rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-800">Ja</span>
                      ) : (
                        <span className="text-gray-400">–</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">{g.email || '–'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">{g.phone || '–'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">{g.district || '–'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-center text-sm font-medium text-gray-900">
                      {g.guest?.tableNumber != null ? g.guest.tableNumber : '–'}
                    </td>
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
                <th className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500">Einladungsliste</th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500">Zusage</th>
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
                  <td colSpan={showSube ? 14 : 13} className="px-4 py-8 text-center text-sm text-gray-500">
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
                    <td className="whitespace-nowrap px-4 py-3 text-center">
                      {r.invitationSentAt ? (
                        <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">Ja</span>
                      ) : (
                        <span className="text-gray-400">–</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-center">
                      {r.invitationSentAt ? (
                        <span className="inline-flex rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-800">Ja</span>
                      ) : (
                        <span className="text-gray-400">–</span>
                      )}
                    </td>
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
              {activeTab === 'gesamtliste' && selectedEventId && (
                <button
                  type="button"
                  onClick={() => setQuickAddOpen(true)}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                  title="Gast nur mit Vorname, Nachname, Staat/Institution erfassen – sofort Zusage/Nimmt teil und Einladungsliste"
                >
                  ＋ Schnellanmeldung
                </button>
              )}
              {isAppOwner && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setAdminAnmeldungenOpen((o) => !o)}
                    className="rounded-lg border border-gray-400 bg-gray-100 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-200"
                    title="Nur für App-Inhaber: Admin-Aktionen zu Anmeldungen"
                  >
                    Admin Anmeldungen ▾
                  </button>
                  {adminAnmeldungenOpen && (
                    <>
                      <div className="fixed inset-0 z-10" aria-hidden onClick={() => setAdminAnmeldungenOpen(false)} />
                      <div className="absolute left-0 top-full z-20 mt-1 min-w-[280px] rounded-lg border border-gray-200 bg-white py-2 shadow-lg">
                        <div className="border-b border-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-500">Admin Anmeldungen</div>
                        <button
                          type="button"
                          onClick={() => { handleImportToGuests(activeTab === 'gesamtliste' ? 'all' : activeTab); setAdminAnmeldungenOpen(false) }}
                          disabled={!selectedEventId || importing !== null}
                          className="block w-full px-3 py-2 text-left text-sm text-gray-800 hover:bg-indigo-50 disabled:opacity-50"
                        >
                          {importing === (activeTab === 'gesamtliste' ? 'all' : activeTab) ? 'Import läuft …' : activeTab === 'gesamtliste' ? 'Alle in Gästeliste übernehmen' : 'In Gästeliste übernehmen'}
                        </button>
                        <button
                          type="button"
                          onClick={() => { handleFixImportedGuests(activeTab === 'gesamtliste' ? 'all' : activeTab); setAdminAnmeldungenOpen(false) }}
                          disabled={!selectedEventId || fixing !== null}
                          className="block w-full px-3 py-2 text-left text-sm text-gray-800 hover:bg-amber-50 disabled:opacity-50"
                        >
                          {fixing === (activeTab === 'gesamtliste' ? 'all' : activeTab) ? 'Korrektur läuft …' : 'Bereits importierte korrigieren'}
                        </button>
                        <button
                          type="button"
                          onClick={() => { handleRemoveDuplicates(); setAdminAnmeldungenOpen(false) }}
                          disabled={removingDuplicates}
                          className="block w-full px-3 py-2 text-left text-sm text-gray-800 hover:bg-red-50 disabled:opacity-50"
                        >
                          {removingDuplicates ? 'Duplikate werden entfernt …' : 'Duplikate entfernen'}
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!selectedEventId) { alert('Bitte wählen Sie ein Ziel-Event aus.'); return }
                            if (!confirm('Abgleich durchführen? Gäste mit bestätigter Teilnahme in den Formular-Ergebnissen werden in der Einladungsliste als Zusage markiert.')) return
                            setAdminAnmeldungenOpen(false)
                            setSyncingToInvitations(true)
                            try {
                              const res = await fetch('/api/invitations/sync-from-registrations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventId: selectedEventId }) })
                              const data = await res.json()
                              if (!res.ok) throw new Error(data.error || 'Abgleich fehlgeschlagen')
                              alert(`${data.updated} Einladung(en) als Zusage markiert.`)
                            } catch (e) { alert(e instanceof Error ? e.message : 'Abgleich fehlgeschlagen') }
                            finally { setSyncingToInvitations(false) }
                          }}
                          disabled={!selectedEventId || syncingToInvitations}
                          className="block w-full px-3 py-2 text-left text-sm text-gray-800 hover:bg-green-50 disabled:opacity-50"
                        >
                          {syncingToInvitations ? 'Abgleich läuft…' : 'Mit Einladungsliste abgleichen'}
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!selectedEventId) { alert('Bitte wählen Sie ein Ziel-Event aus.'); return }
                            if (!confirm('Alle Personen aus den Ergebnissen der Anmeldung in der Gästeliste als „Zusage“, „Nimmt teil“ und „Einladungsliste“ markieren?\n\nGäste werden per Name zugeordnet; fehlende Einladungen werden angelegt.')) return
                            setAdminAnmeldungenOpen(false)
                            setMarkingAllAsZusage(true)
                            try {
                              const res = await fetch('/api/registrations/mark-all-as-zusage-in-guests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventId: selectedEventId }) })
                              const data = await res.json()
                              if (!res.ok) throw new Error(data.error || 'Markierung fehlgeschlagen')
                              loadRegistrations()
                              setGuestsRefreshKey((k) => k + 1)
                              alert(data.message || `${data.guestsUpdated ?? 0} Gäste markiert.`)
                            } catch (e) { alert(e instanceof Error ? e.message : 'Markierung fehlgeschlagen') }
                            finally { setMarkingAllAsZusage(false) }
                          }}
                          disabled={!selectedEventId || markingAllAsZusage}
                          className="block w-full px-3 py-2 text-left text-sm text-gray-800 hover:bg-green-50 disabled:opacity-50"
                        >
                          {markingAllAsZusage ? 'Markierung läuft…' : 'Alle in Gästeliste + Einladungsliste als Zusage/Nimmt teil'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
              <span className="text-sm text-gray-500">
                Doppelte Namen werden übersprungen.
              </span>
            </div>
            {activeTab === 'gesamtliste' ? (
              <>
                <h2 className="mb-4 text-lg font-semibold text-gray-900">
                  Gesamtliste – alle Anmeldungen + Gästeliste (Einladungsliste) zusammengeführt
                </h2>
                {selectedEventId && !loadingGuests && (
                  <div className="mb-3 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setDuplicatesModalOpen(true)}
                      className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700"
                    >
                      Doppelte Namen anzeigen
                      {duplicateGroups.length > 0 && (
                        <span className="ml-2 rounded-full bg-white/25 px-2 py-0.5 text-xs">
                          {duplicateGroups.length}
                        </span>
                      )}
                    </button>
                  </div>
                )}
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

      {/* Modal: Doppelte Namen – Anzeige und Aktionen */}
      {duplicatesModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setDuplicatesModalOpen(false)}>
          <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-xl bg-white p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-2 text-sm font-semibold text-gray-800">Doppelte Namen bei den Tischen</h3>
            <p className="mb-4 text-xs text-gray-600">
              Gäste mit gleichem Vor- und Nachnamen. Sie können umbenennen, löschen oder alle Einträge einer Gruppe auf einen neuen leeren Tisch verschieben.
            </p>
            {duplicateGroups.length === 0 ? (
              <p className="rounded-lg bg-gray-100 p-4 text-sm text-gray-600">Keine doppelten Vor- und Nachnamen gefunden.</p>
            ) : (
              <ul className="space-y-4">
                {duplicateGroups.map(({ name, guests: groupGuests }) => (
                  <li key={name} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <div className="mb-2 font-medium text-gray-800">&quot;{name}&quot;</div>
                    <ul className="mb-3 space-y-2">
                      {groupGuests.map((g) => (
                        <li key={g.id} className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="text-gray-600">
                            {g.name} {g.tableNumber != null ? `(Tisch ${g.tableNumber})` : '(ohne Tisch)'}
                          </span>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={duplicateRenameDraft[g.id] ?? g.name}
                              onChange={(e) => setDuplicateRenameDraft((prev) => ({ ...prev, [g.id]: e.target.value }))}
                              placeholder="Neuer Name"
                              className="w-40 rounded border border-gray-300 px-2 py-1 text-sm"
                            />
                            <button
                              type="button"
                              disabled={duplicateActionLoading !== null}
                              onClick={() => handleDuplicateRename(g.id, duplicateRenameDraft[g.id] ?? g.name)}
                              className="rounded bg-slate-600 px-2 py-1 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                            >
                              {duplicateActionLoading === g.id ? '…' : 'Umbenennen'}
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={duplicateActionLoading !== null}
                        onClick={() => handleDuplicateMoveToNewTable(groupGuests)}
                        className="rounded bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                      >
                        {duplicateActionLoading === 'move-group' ? '…' : 'Alle auf neuen Tisch verschieben'}
                      </button>
                      <button
                        type="button"
                        disabled={duplicateActionLoading !== null}
                        onClick={() => handleDuplicateDeleteGroup(groupGuests.map((g) => g.id))}
                        className="rounded bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        {duplicateActionLoading === 'delete-group' ? '…' : 'Alle löschen'}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setDuplicatesModalOpen(false)}
                className="rounded bg-gray-200 px-4 py-1.5 text-sm text-gray-700 hover:bg-gray-300"
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
