'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'

type TableItem = {
  id: string
  type: 'table'
  x: number
  y: number
  /** Radius des runden Tischs (Mittelpunkt = x, y) */
  radius: number
  tableNumber: number
  isVip: boolean
  seats: number
  /** Gast-ID pro Stuhl (Index = Sitzplatz 0..seats-1), null = frei */
  seatAssignments?: (string | null)[]
}

type PodiumItem = {
  id: string
  type: 'podium'
  x: number
  y: number
  width: number
  height: number // 1:2 => height = width * 2
}

type PlanItem = TableItem | PodiumItem

function parseAdditionalData(additionalData: any): Record<string, unknown> {
  if (!additionalData) return {}
  try {
    if (typeof additionalData === 'string') return JSON.parse(additionalData)
    if (typeof additionalData === 'object') return additionalData as Record<string, unknown>
  } catch {
    // ignore
  }
  return {}
}

function isVipGuest(guest: any): boolean {
  if (guest.isVip) return true
  const add = parseAdditionalData(guest.additionalData)
  const v = add['VIP'] ?? add['vip']
  return v === true || v === 'true'
}

/** Alte Tische (width/height) in runde Tische (radius, Mittelpunkt) umwandeln */
function normalizeTable(t: Record<string, unknown>): TableItem {
  const id = String(t.id)
  const type = 'table' as const
  const tableNumber = Number(t.tableNumber) || 1
  const isVip = Boolean(t.isVip)
  const seats = Math.max(1, Number(t.seats) || 4)
  const seatAssignments = Array.isArray(t.seatAssignments)
    ? (t.seatAssignments as (string | null)[])
    : Array(seats).fill(null)

  if (typeof (t as TableItem).radius === 'number') {
    return {
      id,
      type,
      x: Number(t.x) || 0,
      y: Number(t.y) || 0,
      radius: (t as TableItem).radius,
      tableNumber,
      isVip,
      seats,
      seatAssignments: seatAssignments.slice(0, seats),
    }
  }
  const w = Number(t.width) || 80
  const h = Number(t.height) || 60
  const radius = Math.min(w, h) / 2
  const x = (Number(t.x) || 0) + w / 2
  const y = (Number(t.y) || 0) + h / 2
  return {
    id,
    type,
    x,
    y,
    radius,
    tableNumber,
    isVip,
    seats,
    seatAssignments: seatAssignments.slice(0, seats),
  }
}

export default function TischplanungPage() {
  const [chairWidth, setChairWidth] = useState(28)
  const [chairHeight, setChairHeight] = useState(28)
  const [eventId, setEventId] = useState<string | null>(null)
  const [floorPlanUrl, setFloorPlanUrl] = useState<string | null>(null)
  const [floorPlanDisplayUrl, setFloorPlanDisplayUrl] = useState<string | null>(null)
  const [floorPlanLoadError, setFloorPlanLoadError] = useState(false)
  const [planData, setPlanData] = useState<{ tables: TableItem[]; podiums: PodiumItem[] }>({
    tables: [],
    podiums: [],
  })
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [nextTableNumber, setNextTableNumber] = useState(1)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [guests, setGuests] = useState<any[]>([])
  const [guestNameMap, setGuestNameMap] = useState<Record<string, string>>({})
  const [assigningSeats, setAssigningSeats] = useState<(string | null)[]>([])
  const [assigning, setAssigning] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{
    id: string
    mouseStartX: number
    mouseStartY: number
    itemStartX: number
    itemStartY: number
  } | null>(null)
  const resizeRef = useRef<{ id: string; startW: number; startH: number; item: PodiumItem } | null>(null)

  const loadEvent = useCallback(async () => {
    try {
      const projectId = typeof window !== 'undefined' ? localStorage.getItem('dashboard-project-id') : null
      const eventsUrl = projectId ? `/api/events?projectId=${encodeURIComponent(projectId)}` : '/api/events'
      const res = await fetch(eventsUrl)
      if (!res.ok) return
      const data = await res.json()
      const events = Array.isArray(data) ? data : [data]
      const event = events[0]
      if (event?.id) setEventId(event.id)
    } catch (e) {
      console.error(e)
    }
  }, [])

  const loadPlan = useCallback(async () => {
    if (!eventId) return
    setLoadError(null)
    try {
      const res = await fetch(`/api/table-plan?eventId=${eventId}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setLoadError(err.details || err.error || `Fehler ${res.status}`)
        return
      }
      const data = await res.json()
      setFloorPlanUrl(data.floorPlanUrl || null)
      setFloorPlanLoadError(false)
      const rawTables = (data.planData?.tables || []) as Record<string, unknown>[]
      const rawPodiums = (data.planData?.podiums || []) as PodiumItem[]
      setPlanData({
        tables: rawTables.map(normalizeTable),
        podiums: rawPodiums,
      })
      const maxNum =
        (data.planData?.tables?.length &&
          Math.max(0, ...(data.planData.tables as TableItem[]).map((t) => t.tableNumber))) ||
        0
      setNextTableNumber(maxNum + 1)
    } catch (e) {
      console.error(e)
      setLoadError(e instanceof Error ? e.message : 'Laden fehlgeschlagen')
    } finally {
      setLoading(false)
    }
  }, [eventId])

  useEffect(() => {
    loadEvent()
  }, [loadEvent])

  useEffect(() => {
    const onProjectChange = () => loadEvent()
    if (typeof window !== 'undefined') {
      window.addEventListener('dashboard-project-changed', onProjectChange)
      return () => window.removeEventListener('dashboard-project-changed', onProjectChange)
    }
  }, [loadEvent])

  useEffect(() => {
    if (eventId) loadPlan()
  }, [eventId, loadPlan])

  useEffect(() => {
    if (!floorPlanUrl) {
      setFloorPlanDisplayUrl(null)
      setFloorPlanLoadError(false)
      return
    }
    setFloorPlanLoadError(false)
    if (typeof window !== 'undefined' && !floorPlanUrl.startsWith('http')) {
      setFloorPlanDisplayUrl(window.location.origin + floorPlanUrl)
    } else {
      setFloorPlanDisplayUrl(floorPlanUrl)
    }
  }, [floorPlanUrl])

  useEffect(() => {
    if (!eventId || planData.tables.length === 0) return
    let cancelled = false
    fetch(`/api/guests?eventId=${eventId}`)
      .then((r) => r.ok ? r.json() : [])
      .then((list: any[]) => {
        if (cancelled) return
        const map: Record<string, string> = {}
        list.forEach((g) => { map[g.id] = g.name || '' })
        setGuestNameMap(map)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [eventId, planData.tables.length])

  const handleUploadFloorPlan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !eventId) return
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('eventId', eventId)
      const res = await fetch('/api/table-plan/upload', { method: 'POST', body: form })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        const msg = [err.error, err.details].filter(Boolean).join(': ') || 'Upload fehlgeschlagen'
        alert(msg)
        return
      }
      const { url } = await res.json()
      setFloorPlanUrl(url)
      await fetch('/api/table-plan', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, floorPlanUrl: url, planData: planData }),
      })
    } catch (e) {
      console.error(e)
      alert('Upload fehlgeschlagen')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const savePlan = async () => {
    if (!eventId) return
    setSaving(true)
    try {
      const res = await fetch('/api/table-plan', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, planData }),
      })
      if (!res.ok) throw new Error('Speichern fehlgeschlagen')
    } catch (e) {
      console.error(e)
      alert('Speichern fehlgeschlagen')
    } finally {
      setSaving(false)
    }
  }

  const handleResetAll = async () => {
    if (!eventId) return
    if (
      !confirm(
        'Alle Tische und Podiums löschen? Der Grundriss bleibt erhalten. Diese Aktion kann nicht rückgängig gemacht werden.'
      )
    )
      return
    setResetting(true)
    try {
      const res = await fetch('/api/table-plan', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          floorPlanUrl: floorPlanUrl ?? undefined,
          planData: { tables: [], podiums: [] },
        }),
      })
      if (!res.ok) throw new Error('Reset fehlgeschlagen')
      setPlanData({ tables: [], podiums: [] })
      setNextTableNumber(1)
      setSelectedId(null)
    } catch (e) {
      console.error(e)
      alert('Reset fehlgeschlagen')
    } finally {
      setResetting(false)
    }
  }

  const addTable = () => {
    const id = `table-${Date.now()}`
    const seats = 6
    const newTable: TableItem = {
      id,
      type: 'table',
      x: 120 + planData.tables.length * 100,
      y: 120 + planData.tables.length * 100,
      radius: 40,
      tableNumber: nextTableNumber,
      isVip: false,
      seats,
      seatAssignments: Array(seats).fill(null),
    }
    setPlanData((prev) => ({
      ...prev,
      tables: [...prev.tables, newTable],
    }))
    setNextTableNumber((n) => n + 1)
    setSelectedId(id)
  }

  const addPodium = () => {
    const id = `podium-${Date.now()}`
    const w = 60
    const newPodium: PodiumItem = {
      id,
      type: 'podium',
      x: 150,
      y: 150,
      width: w,
      height: w * 2,
    }
    setPlanData((prev) => ({
      ...prev,
      podiums: [...prev.podiums, newPodium],
    }))
    setSelectedId(id)
  }

  const updateTable = (id: string, updates: Partial<TableItem>) => {
    setPlanData((prev) => ({
      ...prev,
      tables: prev.tables.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    }))
  }

  const updatePodium = (id: string, updates: Partial<PodiumItem>) => {
    setPlanData((prev) => ({
      ...prev,
      podiums: prev.podiums.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    }))
  }

  const deleteSelected = () => {
    if (!selectedId) return
    if (selectedId.startsWith('table-')) {
      setPlanData((prev) => ({ ...prev, tables: prev.tables.filter((t) => t.id !== selectedId) }))
    } else {
      setPlanData((prev) => ({ ...prev, podiums: prev.podiums.filter((p) => p.id !== selectedId) }))
    }
    setSelectedId(null)
  }

  const handleMouseDown = (e: React.MouseEvent, item: PlanItem) => {
    e.stopPropagation()
    setSelectedId(item.id)
    dragRef.current = {
      id: item.id,
      mouseStartX: e.clientX,
      mouseStartY: e.clientY,
      itemStartX: item.x,
      itemStartY: item.y,
    }
  }

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (dragRef.current) {
        const dx = e.clientX - dragRef.current.mouseStartX
        const dy = e.clientY - dragRef.current.mouseStartY
        const newX = Math.max(0, dragRef.current.itemStartX + dx)
        const newY = Math.max(0, dragRef.current.itemStartY + dy)
        const id = dragRef.current.id
        dragRef.current = {
          ...dragRef.current,
          mouseStartX: e.clientX,
          mouseStartY: e.clientY,
          itemStartX: newX,
          itemStartY: newY,
        }
        if (id.startsWith('table-')) {
          setPlanData((prev) => ({
            ...prev,
            tables: prev.tables.map((t) =>
              t.id === id ? { ...t, x: newX, y: newY } : t
            ),
          }))
        } else {
          setPlanData((prev) => ({
            ...prev,
            podiums: prev.podiums.map((p) =>
              p.id === id ? { ...p, x: newX, y: newY } : p
            ),
          }))
        }
      }
      if (resizeRef.current) {
        const { item, startW } = resizeRef.current
        const dx = e.clientX - (item.x + startW)
        const newW = Math.max(40, startW + dx)
        setPlanData((prev) => ({
          ...prev,
          podiums: prev.podiums.map((p) =>
            p.id === item.id ? { ...p, width: newW, height: newW * 2 } : p
          ),
        }))
      }
    },
    []
  )

  const handleMouseUp = useCallback(() => {
    dragRef.current = null
    resizeRef.current = null
  }, [])

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [handleMouseMove, handleMouseUp])

  const openAssignModal = async () => {
    if (!selectedId || !eventId) return
    const table = planData.tables.find((t) => t.id === selectedId)
    if (!table) return
    const seats = Array(table.seats).fill(null).map((_, i) => table.seatAssignments?.[i] ?? null)
    setAssigningSeats(seats)
    setShowAssignModal(true)
    try {
      const res = await fetch(`/api/guests?eventId=${eventId}`)
      if (!res.ok) return
      const list = await res.json()
      if (table.isVip) {
        setGuests(list.filter((g: any) => isVipGuest(g)))
      } else {
        setGuests(list)
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleAssign = async () => {
    const table = planData.tables.find((t) => t.id === selectedId)
    if (!table || !eventId) return
    const assignments = assigningSeats
      .map((guestId, seatIndex) => ({ seatIndex, guestId }))
      .filter((a) => a.guestId != null && a.guestId !== '')
    setAssigning(true)
    try {
      const res = await fetch('/api/table-plan/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          tableNumber: table.tableNumber,
          assignments: assignments.map((a) => ({ seatIndex: a.seatIndex, guestId: a.guestId })),
        }),
      })
      if (!res.ok) throw new Error('Zuweisung fehlgeschlagen')
      updateTable(table.id, { seatAssignments: assigningSeats })
      setShowAssignModal(false)
    } catch (e) {
      console.error(e)
      alert('Zuweisung fehlgeschlagen')
    } finally {
      setAssigning(false)
    }
  }

  const selectedTable = selectedId ? planData.tables.find((t) => t.id === selectedId) : null
  const isPdf = floorPlanUrl?.toLowerCase().endsWith('.pdf')
  // Grundriss immer über API laden (liest vom Server – funktioniert mit Railway Volume / public/uploads)
  const urlForDisplay =
    eventId && floorPlanUrl
      ? `/api/table-plan/floor-plan?eventId=${eventId}`
      : (floorPlanDisplayUrl ?? floorPlanUrl)

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-gray-500">Lade Tischplanung…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="text-gray-600 hover:text-gray-900"
            >
              ← Zurück
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">Tischplanung</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleResetAll}
              disabled={resetting || saving}
              className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
              title="Alle Tische und Podiums löschen, von null anfangen"
            >
              {resetting ? 'Wird gelöscht…' : 'Resetten / Alle löschen'}
            </button>
            <button
              onClick={savePlan}
              disabled={saving}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? 'Speichern…' : 'Plan speichern'}
            </button>
          </div>
        </div>
      </header>

      {loadError && (
        <div className="mx-auto max-w-7xl px-4 py-2 sm:px-6 lg:px-8">
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <strong>Tischplanung konnte nicht geladen werden:</strong> {loadError}
            <br />
            <span className="text-red-600">
              Falls „relation &quot;table_plans&quot; does not exist&quot;: Auf Railway Migration ausführen (railway run npx prisma migrate deploy).
            </span>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-center gap-4 rounded-xl bg-white p-4 shadow">
          <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-amber-50/80 px-3 py-2 text-sm">
            <span className="font-medium text-amber-800">VIP-Plätze:</span>
            <span className="font-semibold text-amber-900">
              {planData.tables.filter((t) => t.isVip).reduce((sum, t) => sum + t.seats, 0)}
            </span>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-sky-50/80 px-3 py-2 text-sm">
            <span className="font-medium text-sky-800">Übrige Plätze:</span>
            <span className="font-semibold text-sky-900">
              {planData.tables.filter((t) => !t.isVip).reduce((sum, t) => sum + t.seats, 0)}
            </span>
          </div>
          <div className="mr-2 h-6 w-px bg-gray-300" aria-hidden />
          <div>
            <label className="block text-sm font-medium text-gray-700">Grundriss (PDF oder Bild)</label>
            <input
              type="file"
              accept=".pdf,image/*"
              onChange={handleUploadFloorPlan}
              disabled={uploading || !eventId}
              className="mt-1 block w-full text-sm text-gray-500 file:mr-2 file:rounded file:border-0 file:bg-indigo-50 file:px-3 file:py-1 file:text-indigo-700"
            />
          </div>
          <button
            type="button"
            onClick={addTable}
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
          >
            + Tisch
          </button>
          <button
            type="button"
            onClick={addPodium}
            className="rounded-lg bg-gray-600 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
          >
            + Podest (1:2)
          </button>
          <label className="flex items-center gap-2">
            <span className="text-sm text-gray-700">Stuhl Breite</span>
            <input
              type="number"
              min={12}
              max={60}
              value={chairWidth}
              onChange={(e) => setChairWidth(Math.max(12, Math.min(60, parseInt(e.target.value, 10) || 28)))}
              className="w-14 rounded border border-gray-300 px-2 py-1 text-sm"
            />
          </label>
          <label className="flex items-center gap-2">
            <span className="text-sm text-gray-700">Stuhl Länge</span>
            <input
              type="number"
              min={12}
              max={60}
              value={chairHeight}
              onChange={(e) => setChairHeight(Math.max(12, Math.min(60, parseInt(e.target.value, 10) || 28)))}
              className="w-14 rounded border border-gray-300 px-2 py-1 text-sm"
            />
          </label>
          {selectedId && (
            <>
              {selectedTable && (
                <>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedTable.isVip}
                      onChange={(e) => updateTable(selectedId, { isVip: e.target.checked })}
                    />
                    <span className="text-sm">VIP-Tisch</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <span className="text-sm">Radius</span>
                    <input
                      type="number"
                      min={20}
                      max={80}
                      value={selectedTable.radius}
                      onChange={(e) =>
                        updateTable(selectedId, {
                          radius: Math.max(20, Math.min(80, parseInt(e.target.value, 10) || 40)),
                        })
                      }
                      className="w-14 rounded border border-gray-300 px-2 py-1 text-sm"
                    />
                  </label>
                  <label className="flex items-center gap-2">
                    <span className="text-sm">Sitzplätze</span>
                    <input
                      type="number"
                      min={1}
                      max={24}
                      value={selectedTable.seats}
                      onChange={(e) => {
                        const newSeats = Math.max(1, Math.min(24, parseInt(e.target.value, 10) || 1))
                        const cur = selectedTable.seatAssignments ?? []
                        const next = [...cur.slice(0, newSeats)]
                        while (next.length < newSeats) next.push(null)
                        updateTable(selectedId, { seats: newSeats, seatAssignments: next })
                      }}
                      className="w-16 rounded border border-gray-300 px-2 py-1 text-sm"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={openAssignModal}
                    className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
                  >
                    Gäste zuweisen
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={deleteSelected}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Löschen
              </button>
            </>
          )}
        </div>

        <div
          ref={containerRef}
          className="relative min-h-[600px] overflow-auto rounded-xl border-2 border-gray-300 bg-gray-100"
          style={{ minHeight: '70vh' }}
        >
          {floorPlanUrl && (
            <div
              className="absolute inset-0 flex items-center justify-center bg-gray-200"
              style={{ pointerEvents: 'none' }}
            >
              {floorPlanLoadError ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-center text-amber-800">
                  <p className="font-medium">Grundriss konnte nicht geladen werden.</p>
                  <p className="mt-1 text-sm">
                    Auf Railway gehen hochgeladene Dateien nach einem Neustart verloren. Bitte laden Sie den Grundriss erneut hoch.
                  </p>
                </div>
              ) : isPdf ? (
                <object
                  data={urlForDisplay || undefined}
                  type="application/pdf"
                  className="h-full w-full min-h-[600px]"
                  style={{ minHeight: 600 }}
                />
              ) : (
                <img
                  src={urlForDisplay || undefined}
                  alt="Grundriss"
                  className="max-h-full max-w-full object-contain"
                  onError={() => setFloorPlanLoadError(true)}
                />
              )}
            </div>
          )}
          {!floorPlanUrl && (
            <div className="flex h-64 items-center justify-center text-gray-500">
              Bitte zuerst einen Grundriss (PDF oder Bild) hochladen.
            </div>
          )}

          <div className="absolute left-0 top-0 h-full w-full" style={{ pointerEvents: 'auto' }}>
            {floorPlanUrl && (
              <>
                {planData.tables.map((t) => {
                  const chairExtent = Math.max(chairWidth, chairHeight) / 2
                  const totalR = t.radius + chairExtent
                  return (
                    <div
                      key={t.id}
                      onMouseDown={(e) => {
                        e.stopPropagation()
                        handleMouseDown(e, t)
                      }}
                      style={{
                        position: 'absolute',
                        left: t.x - totalR,
                        top: t.y - totalR,
                        width: totalR * 2,
                        height: totalR * 2,
                        pointerEvents: 'auto',
                        cursor: 'move',
                      }}
                    >
                      <div
                        style={{
                          position: 'absolute',
                          left: totalR - t.radius,
                          top: totalR - t.radius,
                          width: t.radius * 2,
                          height: t.radius * 2,
                          borderRadius: '50%',
                          backgroundColor: t.isVip ? '#fef08a' : '#bae6fd',
                          border: selectedId === t.id ? '3px solid #4f46e5' : '2px solid #0ea5e9',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 11,
                          fontWeight: 'bold',
                        }}
                      >
                        Tisch {t.tableNumber}
                      </div>
                      {Array.from({ length: t.seats }, (_, i) => {
                        const angle = (2 * Math.PI * i) / t.seats - Math.PI / 2
                        const chairR = t.radius
                        const cx = totalR + chairR * Math.cos(angle)
                        const cy = totalR + chairR * Math.sin(angle)
                        const guestId = t.seatAssignments?.[i] ?? null
                        const label = guestId ? (guestNameMap[guestId] || `Platz ${i + 1}`) : `Platz ${i + 1}`
                        return (
                          <div
                            key={i}
                            title={label}
                            style={{
                              position: 'absolute',
                              left: cx - chairWidth / 2,
                              top: cy - chairHeight / 2,
                              width: chairWidth,
                              height: chairHeight,
                              backgroundColor: guestId ? '#86efac' : '#e5e7eb',
                              border: '1px solid #6b7280',
                              borderRadius: 4,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: Math.max(8, Math.min(11, Math.min(chairWidth, chairHeight) - 4)),
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              padding: 2,
                            }}
                          >
                            {guestId ? (guestNameMap[guestId] ? guestNameMap[guestId].slice(0, 6) : i + 1) : i + 1}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
                {planData.podiums.map((p) => (
                  <div
                    key={p.id}
                    onMouseDown={(e) => handleMouseDown(e, p)}
                    style={{
                      position: 'absolute',
                      left: p.x,
                      top: p.y,
                      width: p.width,
                      height: p.height,
                      pointerEvents: 'auto',
                      cursor: 'move',
                      backgroundColor: '#c4b5fd',
                      border: selectedId === p.id ? '3px solid #4f46e5' : '2px solid #7c3aed',
                      borderRadius: 4,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                    }}
                  >
                    Podest
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </main>

      {showAssignModal && selectedTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="max-h-[80vh] w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-xl">
            <div className="border-b p-4">
              <h2 className="text-lg font-semibold">
                Stühle Tisch {selectedTable.tableNumber} zuweisen
                {selectedTable.isVip && ' (nur VIP-Gäste)'}
              </h2>
            </div>
            <div className="max-h-96 overflow-y-auto p-4">
              {guests.length === 0 ? (
                <p className="text-gray-500">Keine passenden Gäste.</p>
              ) : (
                <div className="space-y-3">
                  {Array.from({ length: selectedTable.seats }, (_, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <label className="w-16 shrink-0 text-sm font-medium text-gray-700">
                        Platz {i + 1}
                      </label>
                      <select
                        value={assigningSeats[i] ?? ''}
                        onChange={(e) => {
                          const v = e.target.value || null
                          setAssigningSeats((prev) => {
                            const next = [...prev]
                            next[i] = v
                            return next
                          })
                        }}
                        className="flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm"
                      >
                        <option value="">— Kein Gast —</option>
                        {guests
                          .filter(
                            (g) =>
                              g.id === (assigningSeats[i] ?? '') ||
                              !assigningSeats.some((id, j) => j !== i && id === g.id)
                          )
                          .map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.name}
                              {g.tableNumber && g.tableNumber !== selectedTable.tableNumber
                                ? ` (Tisch ${g.tableNumber})`
                                : ''}
                            </option>
                          ))}
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t p-4">
              <button
                type="button"
                onClick={() => setShowAssignModal(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={handleAssign}
                disabled={assigning}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {assigning ? 'Wird zugewiesen…' : 'Zuweisen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
