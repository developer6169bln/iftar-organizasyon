'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import * as XLSX from 'xlsx'

export default function GuestsPage() {
  const router = useRouter()
  const [guests, setGuests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingGuest, setEditingGuest] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({})
  const [allColumns, setAllColumns] = useState<string[]>([])
  const [showNoResultsWarning, setShowNoResultsWarning] = useState(false)
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null)
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [selectedGuests, setSelectedGuests] = useState<string[]>([])
  const [editingCell, setEditingCell] = useState<{ guestId: string; column: string } | null>(null)
  const [editingValue, setEditingValue] = useState<string>('')
  const [invitations, setInvitations] = useState<Record<string, any>>({}) // guestId -> invitation
  const [checkboxStates, setCheckboxStates] = useState<Record<string, boolean>>({}) // key: `${guestId}-${column}` -> boolean
  const [pageIndex, setPageIndex] = useState(0)
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('')
  const PAGE_SIZE = 100

  // Suche debouncen (300ms), reduziert Re-Renders beim Tippen
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearchQuery(searchQuery), 300)
    return () => clearTimeout(t)
  }, [searchQuery])
  // Sofort zurücksetzen wenn Suche geleert wird
  useEffect(() => {
    if (!searchQuery.trim()) setDebouncedSearchQuery('')
  }, [searchQuery])

  // Geschützte Spalten (können nicht gelöscht werden) - nur "ID" und "İşlemler"
  const protectedColumns = ['ID', 'İşlemler']
  
  // Standard-Spalten (immer vorhanden)
  const standardColumns = [
    'Kategorie',
    'Name',
    'Partei / Organisation / Unternehmen',
    'Funktion',
    'Ebende',
    'E-Mail',
    'Status',
    'Tischnummer',
    'VIP Begleitung benötigt?',
    'VIP Begleiter (Name)',
    'VIP Anreise (Uhrzeit)',
    'Einladungspriorität',
    'Wahrscheinlichkeit',
    'Notiz',
    'Hinzugefügt am',
    'İşlemler'
  ]
  
  // Spalten ohne Filter
  const columnsWithoutFilter = [
    'Kategorie',
    'Partei / Organisation / Unternehmen',
    'Funktion',
    'Ebende',
    'E-Mail',
    'Status',
    'VIP Begleitung benötigt?',
    'VIP Begleiter (Name)',
    'VIP Anreise (Uhrzeit)',
    'Einladungspriorität',
    'Wahrscheinlichkeit',
    'Notiz',
    'İşlemler',
    'Telefon',
    'VIP',
    'Nimmt Teil',
    'Abgesagt',
    'Mail-Liste',
    'Anwesend',
    'Nummer',
    'Hinzugefügt am'
  ]
  
  // Gäste mit vorgeladenem additionalData (parsen nur einmal, nicht pro Zelle)
  const guestsWithParsed = useMemo(() => {
    return guests.map((g) => {
      let parsed: Record<string, unknown> = {}
      if (g.additionalData) {
        try {
          parsed = JSON.parse(g.additionalData) as Record<string, unknown>
        } catch {
          // ignore
        }
      }
      return { ...g, _additionalParsed: parsed }
    })
  }, [guests])

  // Hilfsfunktion: Hole Wert für eine Spalte (Standard-Feld oder additionalData)
  const getColumnValue = (guest: any, columnName: string, index?: number): any => {
    // Nummer-Spalte: Automatisch generierte fortlaufende Nummer
    if (columnName === 'Nummer') {
      return index !== undefined ? index.toString() : ''
    }

    // ZUERST: Prüfe additionalData (vorgeladen oder parsen)
    const additional = guest._additionalParsed ?? (() => {
      if (!guest.additionalData) return {}
      try {
        return JSON.parse(guest.additionalData) as Record<string, unknown>
      } catch {
        return {}
      }
    })()
    if (Object.prototype.hasOwnProperty.call(additional, columnName)) {
      const value = additional[columnName]
      return value !== null && value !== undefined ? value : ''
    }

    // DANN: Standard-Felder - Mapping zu neuen Spaltennamen (Fallback)
    if (columnName === 'Kategorie') {
      return guest.category || ''
    }
    if (columnName === 'Name' || columnName === 'name') {
      // Wenn Nachname in additionalData: Name-Spalte zeigt nur Nachname (nicht Vorname+Nachname)
      const nachname = String(additional['Nachname'] ?? additional['nachname'] ?? '').trim()
      if (nachname) return nachname
      return guest.name || ''
    }
    if (columnName === 'Partei / Organisation / Unternehmen') {
      return guest.organization || ''
    }
    if (columnName === 'Funktion') {
      return guest.title || ''
    }
    if (columnName === 'Ebende') {
      // Ebene - wird aus additionalData gelesen (siehe oben)
      return ''
    }
    if (columnName === 'E-Mail' || columnName === 'email' || columnName === 'E-Mail') {
      return guest.email || ''
    }
    if (columnName === 'Status' || columnName === 'status') {
      return guest.status || ''
    }
    if (columnName === 'Tischnummer' || columnName === 'tableNumber') {
      return guest.tableNumber?.toString() || ''
    }
    if (columnName === 'Anwesend') {
      return guest.status === 'ATTENDED' ? 'Ja' : 'Nein'
    }
    if (columnName === 'VIP Begleitung benötigt?') {
      return guest.needsSpecialReception ? 'Ja' : 'Nein'
    }
    if (columnName === 'VIP Begleiter (Name)') {
      return guest.receptionBy || ''
    }
    if (columnName === 'VIP Anreise (Uhrzeit)') {
      return guest.arrivalDate ? new Date(guest.arrivalDate).toLocaleString('de-DE') : ''
    }
    if (columnName === 'Einladungspriorität') {
      // Priorität - wird aus additionalData gelesen (siehe oben)
      return ''
    }
    if (columnName === 'Wahrscheinlichkeit') {
      // Wahrscheinlichkeit - wird aus additionalData gelesen (siehe oben)
      return ''
    }
    if (columnName === 'Notiz' || columnName === 'notes') {
      return guest.notes || ''
    }
    if (columnName === 'Hinzugefügt am') {
      return guest.createdAt
        ? new Date(guest.createdAt).toLocaleString('de-DE', {
            dateStyle: 'short',
            timeStyle: 'short',
          })
        : ''
    }
    if (columnName === 'İşlemler') {
      return '' // Aktionen-Spalte
    }
    
    return ''
  }
  const [formData, setFormData] = useState<Record<string, any>>({
    name: '',
    email: '',
    phone: '',
    title: '',
    organization: '',
    tableNumber: '',
    isVip: false,
    needsSpecialReception: false,
    receptionBy: '',
    arrivalDate: '',
    notes: '',
  })
  const [eventId, setEventId] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importMode, setImportMode] = useState<'replace' | 'append'>('replace')
  const [showDuplicateModal, setShowDuplicateModal] = useState(false)
  const [duplicateGroups, setDuplicateGroups] = useState<Array<{ type: 'name'; value: string; guests: any[] }>>([])
  const [checkingDuplicates, setCheckingDuplicates] = useState(false)

  // Vorname/Nachname aus additionalData oder aus guest.name splitten (nutzt _additionalParsed wenn vorhanden)
  const getVornameNachname = (guest: any): { vorname: string; nachname: string } => {
    let vorname = ''
    let nachname = ''
    const add = guest._additionalParsed ?? (guest.additionalData ? (() => { try { return JSON.parse(guest.additionalData) as Record<string, unknown> } catch { return {} } })() : {})
    if (add && typeof add === 'object') {
      vorname = String(add['Vorname'] ?? add['vorname'] ?? '').trim()
      nachname = String(add['Nachname'] ?? add['nachname'] ?? add['Name'] ?? '').trim()
    }
    if (!vorname && !nachname && guest.name) {
      const parts = String(guest.name).trim().split(/\s+/).filter(Boolean)
      vorname = parts[0] ?? ''
      nachname = parts.slice(1).join(' ') ?? ''
    }
    return { vorname, nachname }
  }

  // Doppelte Einträge nur wenn Vorname und Nachname identisch sind (z. B. Ali Koc = Ali Koc)
  const computeDuplicateGroups = (guestList: any[]): Array<{ type: 'name'; value: string; guests: any[] }> => {
    const norm = (s: string) => (s ?? '').trim().toLowerCase()
    const byVornameNachname = new Map<string, any[]>()
    for (const g of guestList) {
      const { vorname, nachname } = getVornameNachname(g)
      const key = `${norm(vorname)}|${norm(nachname)}`
      if (!byVornameNachname.has(key)) byVornameNachname.set(key, [])
      byVornameNachname.get(key)!.push(g)
    }
    const groups: Array<{ type: 'name'; value: string; guests: any[] }> = []
    byVornameNachname.forEach((arr, key) => {
      if (arr.length > 1) {
        const first = getVornameNachname(arr[0])
        const display = [first.vorname, first.nachname].filter(Boolean).join(' ') || key
        groups.push({ type: 'name', value: display, guests: arr })
      }
    })
    return groups
  }

  // ENTFERNT: dbFields (nicht mehr benötigt ohne Google Sheets)

  useEffect(() => {
    loadEventAndGuests()
    const onProjectChange = () => loadEventAndGuests()
    if (typeof window !== 'undefined') {
      window.addEventListener('dashboard-project-changed', onProjectChange)
      return () => window.removeEventListener('dashboard-project-changed', onProjectChange)
    }
  }, [])

  // Wende gespeicherte Reihenfolge an, wenn allColumns sich ändert
  // Entfernt: loadColumnOrder wird nicht mehr automatisch aufgerufen
  // Die Spaltenreihenfolge wird jetzt direkt im useEffect für guests gesetzt

  // Lade gespeicherte Spaltenreihenfolge aus localStorage
  const loadColumnOrder = () => {
    try {
      const savedOrder = localStorage.getItem('guestColumnsOrder')
      if (savedOrder) {
        const order = JSON.parse(savedOrder)
        applyColumnOrder(order)
      }
    } catch (e) {
      console.error('Fehler beim Laden der Spaltenreihenfolge:', e)
    }
  }

  // Wende gespeicherte Reihenfolge an (nur für Drag-and-Drop, nicht beim ersten Laden)
  const applyColumnOrder = (savedOrder: string[]) => {
    if (savedOrder.length === 0 || allColumns.length === 0) return
    
    // Stelle sicher, dass nur "Nummer" und "İşlemler" geschützt sind
    const protectedCols = ['ID', 'İşlemler']
    
    // Filtere gespeicherte Reihenfolge: Nur Spalten, die auch in allColumns existieren
    const validSavedOrder = savedOrder.filter(col => allColumns.includes(col))
    
    // Entferne nur geschützte Spalten aus der gespeicherten Reihenfolge
    const savedWithoutProtected = validSavedOrder.filter(col => 
      !protectedCols.includes(col)
    )
    
    // Baue neue Reihenfolge: Nummer zuerst, dann gespeicherte Reihenfolge, dann fehlende Spalten, dann İşlemler
    const missing = allColumns.filter(col => 
      !protectedCols.includes(col) && 
      !savedWithoutProtected.includes(col)
    )
    
    const newOrder = [
      'Nummer', // Immer an erster Stelle
      ...savedWithoutProtected,
      ...missing,
      'İşlemler' // Immer am Ende
    ]
    
    // Nur aktualisieren wenn sich etwas geändert hat
    if (JSON.stringify(newOrder) !== JSON.stringify(allColumns)) {
      setAllColumns(newOrder)
      saveColumnOrder(newOrder)
    }
  }

  // Speichere Spaltenreihenfolge in localStorage
  const saveColumnOrder = (columns: string[]) => {
    try {
      localStorage.setItem('guestColumnsOrder', JSON.stringify(columns))
    } catch (e) {
      console.error('Fehler beim Speichern der Spaltenreihenfolge:', e)
    }
  }

  // Speichere aktuelle Reihenfolge als Standard
  const handleSaveAsDefault = () => {
    if (allColumns.length === 0) {
      alert('Keine Spalten vorhanden')
      return
    }

    if (confirm('Möchten Sie die aktuelle Spaltenreihenfolge als Standard festlegen?\n\nDiese Reihenfolge wird bei neuen Imports automatisch verwendet.')) {
      try {
        // Speichere als Standard
        localStorage.setItem('guestColumnsOrderDefault', JSON.stringify(allColumns))
        // Aktualisiere auch die aktuelle Reihenfolge
        saveColumnOrder(allColumns)
        alert('✅ Spaltenreihenfolge wurde als Standard gespeichert!')
      } catch (e) {
        console.error('Fehler beim Speichern der Standard-Reihenfolge:', e)
        alert('Fehler beim Speichern der Standard-Reihenfolge')
      }
    }
  }

  // Lade Standard-Reihenfolge
  const loadDefaultColumnOrder = (): string[] | null => {
    try {
      const defaultOrder = localStorage.getItem('guestColumnsOrderDefault')
      if (defaultOrder) {
        return JSON.parse(defaultOrder)
      }
    } catch (e) {
      console.error('Fehler beim Laden der Standard-Reihenfolge:', e)
    }
    return null
  }

  // Drag-Handler
  const handleDragStart = (column: string) => {
    setDraggedColumn(column)
  }

  const handleDragOver = (e: React.DragEvent, column: string) => {
    e.preventDefault()
    if (draggedColumn && draggedColumn !== column) {
      setDragOverColumn(column)
    }
  }

  const handleDragLeave = () => {
    setDragOverColumn(null)
  }

  const handleDrop = (e: React.DragEvent, targetColumn: string) => {
    e.preventDefault()
    
    if (!draggedColumn || draggedColumn === targetColumn) {
      setDraggedColumn(null)
      setDragOverColumn(null)
      return
    }

    // Verhindere Verschieben von geschützten Spalten
    if (protectedColumns.includes(draggedColumn)) {
      setDraggedColumn(null)
      setDragOverColumn(null)
      return
    }

    // Verhindere Verschieben auf Position von "Nummer" (immer an erster Stelle)
    if (targetColumn === 'Nummer') {
      setDraggedColumn(null)
      setDragOverColumn(null)
      return
    }

    // Erstelle neue Spaltenreihenfolge
    const newColumns = [...allColumns]
    const draggedIndex = newColumns.indexOf(draggedColumn)
    const targetIndex = newColumns.indexOf(targetColumn)

    // Stelle sicher, dass "Nummer" an erster Stelle bleibt
    if (targetIndex === 0 && newColumns[0] === 'Nummer') {
      // Verschiebe nicht auf Position 0, wenn "Nummer" dort ist
      if (draggedIndex > 0) {
        // Entferne die gezogene Spalte
        newColumns.splice(draggedIndex, 1)
        // Füge sie nach "Nummer" ein (Position 1)
        newColumns.splice(1, 0, draggedColumn)
      }
    } else {
      // Entferne die gezogene Spalte
      newColumns.splice(draggedIndex, 1)
      // Füge sie an der neuen Position ein
      newColumns.splice(targetIndex, 0, draggedColumn)
    }

    // Stelle sicher, dass "Nummer" an erster Stelle ist
    const nummerIndex = newColumns.indexOf('Nummer')
    if (nummerIndex > 0) {
      newColumns.splice(nummerIndex, 1)
      newColumns.unshift('Nummer')
    }

    setAllColumns(newColumns)
    saveColumnOrder(newColumns)
    
    // Prüfe ob Standard-Reihenfolge gespeichert ist und aktualisiere sie
    const defaultOrder = loadDefaultColumnOrder()
    if (defaultOrder && JSON.stringify(defaultOrder) === JSON.stringify(newColumns)) {
      // Reihenfolge entspricht bereits dem Standard, nichts zu tun
    } else if (defaultOrder) {
      // Standard existiert, aber aktuelle Reihenfolge ist anders
      // Optional: Automatisch als Standard speichern? Nein, nur auf explizite Aktion
    }
    
    setDraggedColumn(null)
    setDragOverColumn(null)
  }

  const handleDragEnd = () => {
    setDraggedColumn(null)
    setDragOverColumn(null)
  }

  // Sortier-Handler
  const handleSort = (column: string) => {
    // Verhindere Sortierung für "İşlemler"
    if (column === 'İşlemler') {
      return
    }
    
    if (sortColumn === column) {
      // Wechsle Sortierrichtung
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      // Neue Spalte, starte mit aufsteigend
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  const getEventsUrl = () => {
    const projectId = typeof window !== 'undefined' ? localStorage.getItem('dashboard-project-id') : null
    return projectId ? `/api/events?projectId=${encodeURIComponent(projectId)}` : '/api/events'
  }

  const loadEventAndGuests = async () => {
    try {
      const eventResponse = await fetch(getEventsUrl())
      if (eventResponse.ok) {
        const event = await eventResponse.json()
        const id = event?.id ?? null
        setEventId(id)
        await loadGuests(id)
      } else {
        setEventId(null)
        setGuests([])
      }
    } catch (error) {
      console.error('Event yükleme hatası:', error)
      setEventId(null)
      setGuests([])
    } finally {
      setLoading(false)
    }
  }

  const handleFileImport = async () => {
    if (!importFile) {
      alert('Bitte wählen Sie eine Datei aus')
      return
    }
    if (!eventId) {
      alert('Event konnte nicht geladen werden (eventId fehlt). Bitte Seite neu laden.')
      return
    }

    const isAppend = importMode === 'append'
    const confirmMessage = isAppend
      ? 'Neue Einträge aus der Datei werden an die bestehende Gästeliste angehängt. Spalten werden wie beim Import zugeordnet.\n\nFortfahren?'
      : '⚠️ WICHTIG: Dieser Import wird:\n\n' +
        '• ALLE vorhandenen Einträge in der Einladungsliste löschen\n' +
        '• Die neue Datei als Master-Liste importieren\n\n' +
        'Diese Aktion kann nicht rückgängig gemacht werden!\n\nMöchten Sie fortfahren?'
    if (!window.confirm(confirmMessage)) return

    try {
      setImporting(true)
      const formData = new FormData()
      formData.append('file', importFile)
      formData.append('eventId', eventId)
      if (isAppend) formData.append('append', 'true')

      const response = await fetch('/api/import/csv-xls', {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        const result = await response.json()
        setImportFile(null)
        await loadGuests()
        if (isAppend) {
          const skipped = result.skipped ?? 0
          const msg =
            `✅ Liste angehängt.\n\n• ${result.imported} neue Einträge hinzugefügt\n• ${result.total} Zeilen in der Datei` +
            (skipped > 0 ? `\n• ${skipped} Doppelte übersprungen (bereits in der Liste)` : '')
          alert(msg)
        } else {
          alert(`✅ Import erfolgreich!\n\n• ${result.imported} Einträge importiert\n• ${result.total} Zeilen verarbeitet`)
        }
      } else {
        const error = await response.json()
        alert(error.error || 'Import fehlgeschlagen')
      }
    } catch (error) {
      console.error('Import-Fehler:', error)
      alert('Fehler beim Importieren der Datei')
    } finally {
      setImporting(false)
    }
  }

  const handleDeleteDuplicateGuest = async (guestId: string) => {
    if (!window.confirm('Diesen Eintrag wirklich löschen?')) return
    try {
      const res = await fetch(`/api/guests?id=${encodeURIComponent(guestId)}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Löschen fehlgeschlagen')
      }
      setGuests((prev) => prev.filter((g) => g.id !== guestId))
      setDuplicateGroups((prev) => {
        const next = prev
          .map((gr) => ({ ...gr, guests: gr.guests.filter((g) => g.id !== guestId) }))
          .filter((gr) => gr.guests.length > 1)
        if (next.length === 0) setShowDuplicateModal(false)
        return next
      })
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Löschen fehlgeschlagen')
    }
  }

  const handleEditDuplicateGuest = (guest: any) => {
    setEditingGuest(guest.id)
    setShowDuplicateModal(false)
  }

  const handleCheckDuplicates = async () => {
    if (guestsWithParsed.length === 0) {
      alert('Keine Gäste in der Liste. Bitte zuerst Gäste laden oder importieren.')
      return
    }
    const groups = computeDuplicateGroups(guestsWithParsed)
    if (groups.length === 0) {
      alert('Keine Dopplungen gefunden (gleicher Vorname + Nachname).')
      return
    }
    setCheckingDuplicates(true)
    let deletedCount = 0
    try {
      for (const group of groups) {
        // Ersten behalten, Rest löschen
        for (let i = 1; i < group.guests.length; i++) {
          const res = await fetch(`/api/guests?id=${encodeURIComponent(group.guests[i].id)}`, { method: 'DELETE' })
          if (res.ok) {
            deletedCount++
            setGuests((prev) => prev.filter((g) => g.id !== group.guests[i].id))
          }
        }
      }
      await loadGuests()
      alert(`✅ ${deletedCount} Doppelte Einträge automatisch gelöscht.`)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Fehler beim Löschen der Dopplungen')
    } finally {
      setCheckingDuplicates(false)
    }
  }

  // ENTFERNT: loadSheetHeaders - komplett entfernt

  // Hilfsfunktion: Prüft ob ein Wert TRUE/FALSE ist (für automatische Checkbox-Erkennung)
  const isBooleanValue = (value: any): boolean => {
    if (value === null || value === undefined) return false
    if (typeof value === 'boolean') return true
    const str = String(value).trim().toLowerCase()
    return str === 'true' || str === 'false' || str === '1' || str === '0' || str === 'ja' || str === 'nein' || str === 'yes' || str === 'no'
  }

  // Hilfsfunktion: Konvertiert einen Wert zu einem Boolean
  const toBoolean = (value: any): boolean => {
    if (value === null || value === undefined) return false
    if (typeof value === 'boolean') return value
    const str = String(value).trim().toLowerCase()
    return str === 'true' || str === '1' || str === 'ja' || str === 'yes' || str === 'y'
  }

  // Einmal berechnet: welche Spalten Boolean sind (nicht bei jedem Tastendruck im Formular)
  const booleanColumnsSet = useMemo(() => {
    const set = new Set<string>()
    if (guestsWithParsed.length === 0) return set
    const formColumns = allColumns.filter(col => col !== 'Nummer' && col !== 'İşlemler' && col !== 'ID' && col !== 'Hinzugefügt am')
    for (const column of formColumns) {
      const isBooleanCol = guestsWithParsed.some(g => {
        const value = getColumnValue(g, column, 0)
        return isBooleanValue(value)
      })
      if (isBooleanCol) set.add(column)
    }
    return set
  }, [guestsWithParsed, allColumns])

  // Boolean-Spalten pro Spalte (einmal berechnet, nicht pro Zelle) – großer Performance-Gewinn
  const isBooleanColumnMap = useMemo(() => {
    const map = new Map<string, boolean>()
    for (const column of allColumns) {
      if (['Nummer', 'İşlemler', 'ID'].includes(column)) continue
      const allValues = guestsWithParsed
        .map((g) => getColumnValue(g, column))
        .filter((v) => v !== null && v !== undefined && v !== '')
      if (allValues.length === 0) continue
      const boolCount = allValues.filter((v) => isBooleanValue(v)).length
      map.set(column, boolCount >= Math.max(1, allValues.length * 0.5))
    }
    return map
  }, [guestsWithParsed, allColumns])

  // Sammle NUR importierte Spalten aus additionalData (keine "gesammelten" Spalten)
  useEffect(() => {
    // Wenn keine Gäste vorhanden, setze minimale Struktur (nur Nummer)
    if (guests.length === 0) {
      if (allColumns.length === 2 && allColumns.includes('Nummer') && allColumns.includes('İşlemler')) {
        return // Behalte minimale Struktur
      }
      const minimalColumns = ['Nummer', 'İşlemler']
      setAllColumns(minimalColumns)
      saveColumnOrder(minimalColumns)
      return
    }
    
    // Sammle Spalten: Nummer, Hinzugefügt am (DB-Feld) + alle aus additionalData
    const columnsSet = new Set<string>(['Nummer', 'Hinzugefügt am'])
    
    // Sammle Spalten aus additionalData (nutze guestsWithParsed, kein doppeltes Parsen)
    guestsWithParsed.forEach((guest) => {
      const add = guest._additionalParsed ?? {}
      Object.keys(add).forEach((key) => {
        if (key && key.trim()) {
          const normalizedKey = key.trim()
          if (normalizedKey.toLowerCase() !== 'nummer') columnsSet.add(normalizedKey)
        }
      })
    })
    
    // Lade gespeicherte Reihenfolge aus localStorage (Standard hat Priorität)
    let savedOrder: string[] = []
    try {
      // Zuerst versuche Standard-Reihenfolge zu laden
      const defaultOrder = loadDefaultColumnOrder()
      if (defaultOrder && defaultOrder.length > 0) {
        savedOrder = defaultOrder
        console.log('📌 Verwende Standard-Spaltenreihenfolge')
      } else {
        // Fallback: Aktuelle gespeicherte Reihenfolge
        const savedOrderStr = localStorage.getItem('guestColumnsOrder')
        if (savedOrderStr) {
          savedOrder = JSON.parse(savedOrderStr)
        }
      }
    } catch (e) {
      console.error('Fehler beim Laden der gespeicherten Spaltenreihenfolge:', e)
    }
    
    // Baue finale Reihenfolge: Behalte gespeicherte Reihenfolge, füge neue Spalten am Ende hinzu
    const importedColumns = Array.from(columnsSet).filter(col => col !== 'Nummer' && col !== 'İşlemler' && col !== 'ID')
    
    // Entferne geschützte Spalten aus savedOrder
    const protectedCols = ['ID', 'İşlemler']
    const savedWithoutProtected = savedOrder.filter(col => 
      !protectedCols.includes(col) && col !== 'Nummer'
    )
    
    // Finde neue Spalten, die noch nicht in savedOrder sind
    const newColumns = importedColumns.filter(col => !savedWithoutProtected.includes(col))
    
    // Baue finale Reihenfolge:
    // 1. Nummer (immer zuerst)
    // 2. Gespeicherte Reihenfolge (nur Spalten, die noch existieren)
    // 3. Neue Spalten (die noch nicht in gespeicherter Reihenfolge sind)
    // 4. İşlemler (immer am Ende)
    const orderedColumns = [
      'Nummer',
      ...savedWithoutProtected.filter(col => importedColumns.includes(col)), // Nur existierende Spalten
      ...newColumns, // Neue Spalten am Ende
      'İşlemler'
    ]
    
    // Prüfe ob sich die Spalten geändert haben, bevor wir setzen (verhindert Endlosschleife)
    const currentColumnsStr = JSON.stringify([...allColumns].sort())
    const newColumnsStr = JSON.stringify([...orderedColumns].sort())
    
    if (currentColumnsStr !== newColumnsStr) {
      // Setze Spalten direkt
      setAllColumns(orderedColumns)
      // Speichere Reihenfolge IMMER (auch bei neuen Spalten)
      saveColumnOrder(orderedColumns)
      
      // Nur einmal loggen, nicht bei jedem Render
      if (guests.length > 0) {
        console.log('📊 Importierte Spalten:', {
          total: orderedColumns.length,
          imported: importedColumns.length,
          importedColumns: importedColumns,
          allColumns: orderedColumns,
          savedOrder: savedWithoutProtected,
          newColumns: newColumns
        })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guestsWithParsed]) // guestsWithParsed statt guests (nutzt vorgeladenes additionalData)

  // Ref um vorherige Gäste-Länge zu speichern
  const prevGuestsLengthRef = useRef(guests.length)
  
  // Reset checkbox states only when guests list length changes (new load, not updates)
  useEffect(() => {
    // Nur zurücksetzen wenn sich die Anzahl der Gäste ändert (neues Laden)
    // Nicht bei jedem Update, damit optimistische Updates funktionieren
    const currentLength = guests.length
    
    if (prevGuestsLengthRef.current !== currentLength && prevGuestsLengthRef.current > 0) {
      // Nur zurücksetzen wenn sich die Liste wirklich geändert hat (z.B. neuer Import)
      setCheckboxStates({})
    }
    
    prevGuestsLengthRef.current = currentLength
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guests.length]) // Nur Länge als Dependency, nicht die gesamte guests-Liste

  // Gefilterte/sortierte Gästeliste als useMemo (nutze guestsWithParsed für kein doppeltes Parsen)
  const filteredGuests = useMemo(() => {
    let filtered = guestsWithParsed

    if (debouncedSearchQuery.trim() !== '') {
      const query = debouncedSearchQuery.toLowerCase()
      filtered = filtered.filter((guest) => {
        const matchesStandard =
          guest.name?.toLowerCase().includes(query) ||
          guest.email?.toLowerCase().includes(query) ||
          guest.title?.toLowerCase().includes(query) ||
          guest.organization?.toLowerCase().includes(query)
        const add = guest._additionalParsed ?? {}
        const matchesAdditional = Object.values(add).some((val: unknown) =>
          String(val ?? '').toLowerCase().includes(query)
        )
        return matchesStandard || matchesAdditional
      })
    }

    Object.entries(columnFilters).forEach(([columnName, filterValue]) => {
      if (!filterValue) return
      const filter = filterValue.toLowerCase()
      filtered = filtered.filter(guest => {
        if (columnName === 'Name') return guest.name?.toLowerCase().includes(filter)
        if (columnName === 'Partei / Organisation / Unternehmen') return guest.organization?.toLowerCase().includes(filter)
        if (columnName === 'Funktion') return guest.title?.toLowerCase().includes(filter)
        if (columnName === 'E-Mail') return guest.email?.toLowerCase().includes(filter)
        if (columnName === 'Status') return guest.status?.toLowerCase().includes(filter)
        if (columnName === 'Tischnummer') return guest.tableNumber?.toString().toLowerCase().includes(filter)
        if (columnName === 'Anwesend') {
          const isAttended = guest.status === 'ATTENDED'
          return (isAttended && (filter === 'ja' || filter === 'yes')) || (!isAttended && (filter === 'nein' || filter === 'no'))
        }
        if (columnName === 'VIP Begleitung benötigt?') {
          const needsReception = guest.needsSpecialReception
          return (needsReception && (filter === 'ja' || filter === 'yes')) || (!needsReception && (filter === 'nein' || filter === 'no'))
        }
        if (columnName === 'VIP Begleiter (Name)') return guest.receptionBy?.toLowerCase().includes(filter)
        if (columnName === 'VIP Anreise (Uhrzeit)') {
          if (!guest.arrivalDate) return false
          return new Date(guest.arrivalDate).toLocaleString('de-DE').toLowerCase().includes(filter)
        }
        if (columnName === 'Notiz') return guest.notes?.toLowerCase().includes(filter)
        const add = guest._additionalParsed ?? {}
        const value = add[columnName]
        if (value !== undefined) return String(value).toLowerCase().includes(filter)
        return true
      })
    })

    if (sortColumn) {
      filtered = [...filtered].sort((a, b) => {
        const valueA = getColumnValue(a, sortColumn, 0)
        const valueB = getColumnValue(b, sortColumn, 0)
        if (sortColumn === 'Nummer') {
          const numA = parseInt(valueA) || 0
          const numB = parseInt(valueB) || 0
          return sortDirection === 'asc' ? numA - numB : numB - numA
        }
        if (sortColumn === 'Hinzugefügt am') {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0
          return sortDirection === 'asc' ? dateA - dateB : dateB - dateA
        }
        const numA = parseFloat(valueA)
        const numB = parseFloat(valueB)
        if (!isNaN(numA) && !isNaN(numB)) return sortDirection === 'asc' ? numA - numB : numB - numA
        const textA = String(valueA).toLowerCase()
        const textB = String(valueB).toLowerCase()
        if (textA < textB) return sortDirection === 'asc' ? -1 : 1
        if (textA > textB) return sortDirection === 'asc' ? 1 : -1
        return 0
      })
    }

    return filtered
  }, [guestsWithParsed, debouncedSearchQuery, columnFilters, sortColumn, sortDirection])

  // Pagination: Nur sichtbare Zeilen rendern (großer Performance-Gewinn bei vielen Gästen)
  const displayedGuests = useMemo(() => {
    const start = pageIndex * PAGE_SIZE
    return filteredGuests.slice(start, start + PAGE_SIZE)
  }, [filteredGuests, pageIndex])
  const totalPages = Math.max(1, Math.ceil(filteredGuests.length / PAGE_SIZE))

  // Seite zurücksetzen wenn Filter/Suche geändert
  useEffect(() => {
    setPageIndex(0)
  }, [searchQuery, columnFilters, sortColumn, sortDirection])

  // "Keine Ergebnisse"-Warnung und nach 2s Filter zurücksetzen
  useEffect(() => {
    const hasActiveFilters = searchQuery.trim() !== '' || Object.values(columnFilters).some(v => String(v).trim() !== '')
    if (filteredGuests.length === 0 && hasActiveFilters && guests.length > 0) {
      setShowNoResultsWarning(true)
      const t = setTimeout(() => {
        setSearchQuery('')
        setColumnFilters({})
        setShowNoResultsWarning(false)
      }, 2000)
      return () => clearTimeout(t)
    }
    setShowNoResultsWarning(false)
  }, [filteredGuests.length, guests.length, searchQuery, columnFilters])

  // Lade Gästeliste neu, wenn eine E-Mail gesendet wurde
  useEffect(() => {
    const handleEmailSent = () => {
      loadGuests()
    }

    // Event-Listener für localStorage-Event
    window.addEventListener('email-sent', handleEmailSent)
    
    // Prüfe auch localStorage für Updates (für Cross-Tab-Kommunikation)
    const checkForUpdates = () => {
      const lastUpdate = localStorage.getItem('email-sent-update')
      if (lastUpdate) {
        const updateTime = parseInt(lastUpdate, 10)
        const now = Date.now()
        // Wenn Update weniger als 10 Sekunden alt ist, lade neu
        if (now - updateTime < 10000) {
          loadGuests()
        }
      }
    }

    // Prüfe alle 2 Sekunden auf Updates
    const updateCheckInterval = setInterval(checkForUpdates, 2000)

    return () => {
      window.removeEventListener('email-sent', handleEmailSent)
      clearInterval(updateCheckInterval)
    }
  }, [])

  const loadGuests = async (overrideEventId?: string | null) => {
    const id = overrideEventId ?? eventId
    if (!id) {
      setGuests([])
      setLoading(false)
      return
    }
    try {
      const response = await fetch(`/api/guests?eventId=${encodeURIComponent(id)}`)
      if (response.ok) {
        const data = await response.json()
        setGuests(data)
        await loadInvitations(data.map((g: any) => g.id), id)
      }
    } catch (error) {
      console.error('Misafirler yüklenirken hata:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadInvitations = async (guestIds: string[], eventIdForInvitations?: string | null) => {
    const eid = eventIdForInvitations ?? eventId
    if (!eid) return
    try {
      const eventsRes = await fetch(getEventsUrl())
      if (eventsRes.ok) {
        const event = await eventsRes.json()
        const id = event?.id
        if (id) {
          const invitationsRes = await fetch(`/api/invitations/list?eventId=${encodeURIComponent(id)}`)
          if (invitationsRes.ok) {
            const invitationsData = await invitationsRes.json()
            const invitationsMap: Record<string, any> = {}
            invitationsData.forEach((inv: any) => {
              invitationsMap[inv.guestId] = inv
            })
            setInvitations(invitationsMap)
          }
        }
      }
    } catch (error) {
      console.error('Fehler beim Laden der Einladungen:', error)
    }
  }

  const handleCellEdit = (guestId: string, column: string, currentValue: any) => {
    setEditingCell({ guestId, column })
    setEditingValue(String(currentValue || ''))
  }

  const handleCellSave = async (guestId: string, column: string) => {
    try {
      const guest = guests.find(g => g.id === guestId)
      if (!guest) return

      let updateData: any = { id: guestId }

      // ALLE Spalten werden jetzt in additionalData gespeichert (direkter Import)
      // Keine Standard-Felder mehr - alles kommt aus additionalData
      const additional = guest.additionalData ? JSON.parse(guest.additionalData) : {}
      additional[column] = editingValue
      updateData.additionalData = JSON.stringify(additional)

      const response = await fetch('/api/guests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      })

      if (response.ok) {
        const updated = await response.json()
        setGuests(guests.map(g => g.id === guestId ? updated : g))
        setEditingCell(null)
        setEditingValue('')
      } else {
        const error = await response.json()
        alert('Fehler beim Speichern: ' + (error.error || 'Unbekannter Fehler'))
      }
    } catch (error) {
      console.error('Fehler beim Speichern:', error)
      alert('Fehler beim Speichern')
    }
  }

  const handleCellCancel = () => {
    setEditingCell(null)
    setEditingValue('')
  }

  const handleCheckboxChange = async (guestId: string, field: string, checked: boolean) => {
    console.log('🔘 Checkbox geändert:', { guestId, field, checked })
    try {
      const guest = guests.find(g => g.id === guestId)
      if (!guest) {
        console.error('Gast nicht gefunden:', guestId)
        return
      }

      if (field === 'vip') {
        const response = await fetch('/api/guests', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: guestId, isVip: checked }),
        })
        if (response.ok) {
          const updated = await response.json()
          setGuests(guests.map(g => g.id === guestId ? updated : g))
          console.log('✅ VIP gespeichert:', updated)
        } else {
          const error = await response.json()
          console.error('❌ Fehler beim Speichern von VIP:', error)
          alert('Fehler beim Speichern: ' + (error.error || 'Unbekannter Fehler'))
        }
      } else if (field === 'mailListe') {
        // Speichere Mail-Liste in additionalData
        const additional = guest.additionalData ? JSON.parse(guest.additionalData) : {}
        additional['Mail-Liste'] = checked
        
        const response = await fetch('/api/guests', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: guestId,
            additionalData: JSON.stringify(additional)
          }),
        })
        
        if (response.ok) {
          const updated = await response.json()
          setGuests(guests.map(g => g.id === guestId ? updated : g))
          console.log('✅ Mail-Liste gespeichert:', updated)
        } else {
          const error = await response.json()
          console.error('❌ Fehler beim Speichern von Mail-Liste:', error)
          alert('Fehler beim Speichern: ' + (error.error || 'Unbekannter Fehler'))
        }
      } else {
        // Für Invitation-Felder: Speichere in additionalData wenn keine Invitation existiert
        const invitation = invitations[guestId]
        
        if (!invitation) {
          // Keine Invitation vorhanden - speichere in additionalData
          const additional = guest.additionalData ? JSON.parse(guest.additionalData) : {}
          
          if (field === 'sentByPost') {
            additional['Einladung Post'] = checked
            if (checked) {
              additional['Einladung Post Datum'] = new Date().toISOString()
            }
          } else if (field === 'nimmtTeil') {
            additional['Nimmt Teil'] = checked
            if (checked) {
              additional['Nimmt Teil Datum'] = new Date().toISOString()
              additional['Abgesagt'] = false // Gegenseitig ausschließend
            }
          } else if (field === 'abgesagt') {
            additional['Abgesagt'] = checked
            if (checked) {
              additional['Abgesagt Datum'] = new Date().toISOString()
              additional['Nimmt Teil'] = false // Gegenseitig ausschließend
            }
          }
          
          const response = await fetch('/api/guests', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: guestId,
              additionalData: JSON.stringify(additional)
            }),
          })
          
          if (response.ok) {
            const updated = await response.json()
            setGuests(guests.map(g => g.id === guestId ? updated : g))
            console.log('✅ Invitation-Feld in additionalData gespeichert:', field, updated)
          } else {
            const error = await response.json()
            console.error('❌ Fehler beim Speichern in additionalData:', error)
            alert('Fehler beim Speichern: ' + (error.error || 'Unbekannter Fehler'))
          }
        } else {
          // Invitation existiert - aktualisiere Invitation
          const updateData: any = { id: invitation.id }
          
          if (field === 'sentByPost') {
            updateData.sentByPost = checked
            if (checked) {
              updateData.sentAt = new Date().toISOString()
            }
          } else if (field === 'nimmtTeil') {
            updateData.response = checked ? 'ACCEPTED' : 'PENDING'
            updateData.respondedAt = checked ? new Date().toISOString() : null
            // Wenn "Nimmt Teil" aktiviert wird, setze "Abgesagt" zurück
            if (checked) {
              updateData.response = 'ACCEPTED'
            }
          } else if (field === 'abgesagt') {
            updateData.response = checked ? 'DECLINED' : 'PENDING'
            updateData.respondedAt = checked ? new Date().toISOString() : null
            // Wenn "Abgesagt" aktiviert wird, setze "Nimmt Teil" zurück
            if (checked) {
              updateData.response = 'DECLINED'
            }
          }

          const response = await fetch('/api/invitations/update', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData),
          })

          if (response.ok) {
            const updated = await response.json()
            setInvitations({ ...invitations, [guestId]: updated })
            // Aktualisiere auch den Gast, falls nötig
            setGuests(guests.map(g => g.id === guestId ? { ...g } : g))
            console.log('✅ Invitation aktualisiert:', field, updated)
          } else {
            const error = await response.json()
            console.error('❌ Fehler beim Aktualisieren der Invitation:', error)
            alert('Fehler beim Speichern: ' + (error.error || 'Unbekannter Fehler'))
          }
        }
      }
    } catch (error) {
      console.error('❌ Fehler beim Speichern:', error)
      alert('Fehler beim Speichern: ' + (error instanceof Error ? error.message : 'Unbekannter Fehler'))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const eventResponse = await fetch(getEventsUrl())
      if (!eventResponse.ok) {
        alert('Event yüklenirken hata oluştu')
        return
      }
      const event = await eventResponse.json()
      const eventObj = event?.id ? event : null

      // Sammle alle Felder aus formData für additionalData
      const additionalData: Record<string, any> = {}
      const standardFields: Record<string, any> = {
        eventId: eventObj.id,
        name: formData.name || formData['Name'] || '',
        email: formData.email || formData['E-Mail'] || formData['E-Mail-Adresse'] || undefined,
        phone: formData.phone || formData['Telefon'] || formData['Phone'] || undefined,
        title: formData.title || formData['Ünvan'] || formData['Funktion'] || undefined,
        organization: formData.organization || formData['Kurum'] || formData['Partei / Organisation / Unternehmen'] || undefined,
        tableNumber: formData.tableNumber ? parseInt(formData.tableNumber) : undefined,
        isVip: formData.isVip || formData['VIP'] === true || formData['VIP'] === 'true',
        needsSpecialReception: formData.needsSpecialReception || formData['VIP Begleitung benötigt?'] === true || formData['VIP Begleitung benötigt?'] === 'true',
        receptionBy: formData.receptionBy || formData['VIP Begleiter (Name)'] || undefined,
        arrivalDate: formData.arrivalDate || formData['VIP Anreise (Uhrzeit)'] || undefined,
        notes: formData.notes || formData['Notiz'] || formData['Notizen'] || undefined,
      }

      // Alle anderen Felder in additionalData speichern
      allColumns
        .filter(col => col !== 'Nummer' && col !== 'İşlemler' && col !== 'ID')
        .forEach(col => {
          // Überspringe Standard-Felder, die bereits in standardFields sind
          if (['Name', 'name', 'E-Mail', 'E-Mail-Adresse', 'Telefon', 'Phone', 'Ünvan', 'Funktion', 'Kurum', 'Partei / Organisation / Unternehmen', 'VIP', 'VIP Begleitung benötigt?', 'VIP Begleiter (Name)', 'VIP Anreise (Uhrzeit)', 'Notiz', 'Notizen'].includes(col)) {
            return
          }
          
          const value = formData[col]
          if (value !== undefined && value !== null && value !== '') {
            // Konvertiere Boolean-Werte
            if (isBooleanValue(value)) {
              additionalData[col] = toBoolean(value)
            } else {
              additionalData[col] = value
            }
          }
        })

      // Füge auch Standard-Felder hinzu, die in additionalData gespeichert werden sollen
      if (formData['Status']) additionalData['Status'] = formData['Status']
      if (formData['Tischnummer']) additionalData['Tischnummer'] = formData['Tischnummer']
      if (formData['Kategorie']) additionalData['Kategorie'] = formData['Kategorie']
      if (formData['Ebende']) additionalData['Ebende'] = formData['Ebende']
      if (formData['Einladungspriorität']) additionalData['Einladungspriorität'] = formData['Einladungspriorität']
      if (formData['Wahrscheinlichkeit']) additionalData['Wahrscheinlichkeit'] = formData['Wahrscheinlichkeit']

      const response = await fetch('/api/guests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...standardFields,
          additionalData: Object.keys(additionalData).length > 0 ? JSON.stringify(additionalData) : undefined,
        }),
      })

      if (response.ok) {
        setShowAddForm(false)
        // Reset formData - behalte Struktur, aber setze alle Werte zurück
        const resetData: Record<string, any> = {}
        allColumns.forEach(col => {
          if (col !== 'Nummer' && col !== 'İşlemler' && col !== 'ID') {
            // Prüfe ob es eine Boolean-Spalte ist
            const isBooleanCol = guests.some(g => {
              const value = getColumnValue(g, col, 0)
              return isBooleanValue(value)
            })
            resetData[col] = isBooleanCol ? false : ''
          }
        })
        // Setze Standard-Felder
        resetData.name = ''
        resetData.email = ''
        resetData.phone = ''
        resetData.title = ''
        resetData.organization = ''
        resetData.tableNumber = ''
        resetData.isVip = false
        resetData.needsSpecialReception = false
        resetData.receptionBy = ''
        resetData.arrivalDate = ''
        resetData.notes = ''
        setFormData(resetData)
        await loadGuests()
        
      } else {
        const error = await response.json()
        alert(error.error || 'Misafir eklenirken hata oluştu')
      }
    } catch (error) {
      console.error('Misafir eklenirken hata:', error)
      alert('Misafir eklenirken hata oluştu')
    }
  }

  // ENTFERNT: Alle Google Sheets Funktionen

  const handleUpdate = async (guestId: string, updatedData: any) => {
    try {
      // Daten für Update vorbereiten
      const updatePayload: any = { id: guestId }
      
      if (updatedData.name !== undefined) updatePayload.name = updatedData.name
      if (updatedData.email !== undefined) updatePayload.email = updatedData.email || null
      if (updatedData.phone !== undefined) updatePayload.phone = updatedData.phone || null
      if (updatedData.title !== undefined) updatePayload.title = updatedData.title || null
      if (updatedData.organization !== undefined) updatePayload.organization = updatedData.organization || null
      if (updatedData.tableNumber !== undefined) {
        updatePayload.tableNumber = updatedData.tableNumber ? parseInt(updatedData.tableNumber) : null
      }
      if (updatedData.isVip !== undefined) updatePayload.isVip = Boolean(updatedData.isVip)
      if (updatedData.needsSpecialReception !== undefined) updatePayload.needsSpecialReception = Boolean(updatedData.needsSpecialReception)
      if (updatedData.receptionBy !== undefined) updatePayload.receptionBy = updatedData.receptionBy || null
      if (updatedData.arrivalDate !== undefined) updatePayload.arrivalDate = updatedData.arrivalDate || null
      if (updatedData.status !== undefined) updatePayload.status = updatedData.status
      if (updatedData.notes !== undefined) updatePayload.notes = updatedData.notes || null

      const response = await fetch('/api/guests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload),
      })

      if (response.ok) {
        setEditingGuest(null)
        loadGuests()
      } else {
        const error = await response.json()
        alert(error.error || error.details || 'Güncelleme başarısız')
      }
    } catch (error) {
      console.error('Güncelleme hatası:', error)
      alert('Güncelleme sırasında hata oluştu')
    }
  }

  const handleToggleVip = async (guestId: string, currentVip: boolean) => {
    try {
      const response = await fetch('/api/guests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: guestId,
          isVip: !currentVip,
        }),
      })

      if (response.ok) {
        await loadGuests()
        
      } else {
        const error = await response.json()
        alert(error.error || error.details || 'VIP durumu güncellenemedi')
      }
    } catch (error) {
      console.error('VIP toggle hatası:', error)
      alert('VIP durumu güncellenirken hata oluştu')
    }
  }

  const handleStatusChange = async (guestId: string, newStatus: string) => {
    await handleUpdate(guestId, { status: newStatus })
  }

  const handleDeleteColumn = async (columnName: string) => {
    if (!eventId) return
    
    // Prüfe ob Spalte geschützt ist
    if (protectedColumns.includes(columnName)) {
      alert(`Die Spalte "${columnName}" ist geschützt und kann nicht gelöscht werden.`)
      return
    }
    
    // Prüfe ob es eine Standard-Spalte ist (diese können nicht gelöscht werden)
    if (standardColumns.includes(columnName)) {
      alert('Standard-Spalten können nicht gelöscht werden')
      return
    }

    if (!confirm(`Möchten Sie die Spalte "${columnName}" wirklich löschen? Diese Aktion entfernt die Spalte aus allen Gästen.`)) {
      return
    }

    try {
      const response = await fetch(`/api/guests/delete-column?eventId=${eventId}&columnName=${encodeURIComponent(columnName)}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        alert(`Fehler beim Löschen der Spalte: ${error.error || 'Unbekannter Fehler'}`)
        return
      }

      const result = await response.json()
      alert(`✅ Spalte "${columnName}" erfolgreich gelöscht (${result.updatedCount} Gäste aktualisiert)`)
      
      // Lade Gäste neu
      loadGuests()
      
      // Entferne Spalte aus allColumns
      // Stelle sicher, dass "Nummer" immer erhalten bleibt
      const newColumns = allColumns.filter(col => col !== columnName)
      
      // Stelle sicher, dass "Nummer" an erster Stelle ist
      if (!newColumns.includes('Nummer')) {
        newColumns.unshift('Nummer')
      } else {
        const nummerIndex = newColumns.indexOf('Nummer')
        if (nummerIndex > 0) {
          newColumns.splice(nummerIndex, 1)
          newColumns.unshift('Nummer')
        }
      }
      
      setAllColumns(newColumns)
      saveColumnOrder(newColumns)
      
      // Entferne Filter für diese Spalte
      const newFilters = { ...columnFilters }
      delete newFilters[columnName]
      setColumnFilters(newFilters)
    } catch (error) {
      console.error('Fehler beim Löschen der Spalte:', error)
      alert('Fehler beim Löschen der Spalte')
    }
  }

  const handleDeleteAll = async () => {
    if (!eventId) return
    
    if (!confirm('⚠️ Möchten Sie wirklich ALLE Gäste löschen? Diese Aktion kann nicht rückgängig gemacht werden!')) {
      return
    }

    try {
      const response = await fetch(`/api/guests?eventId=${eventId}&deleteAll=true`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        alert(`Fehler beim Löschen: ${error.error || 'Unbekannter Fehler'}`)
        return
      }

      const result = await response.json()
      alert(`✅ ${result.deletedCount || 0} Gäste erfolgreich gelöscht`)
      
      // Lade Gäste neu
      loadGuests()
      
      // Setze Spalten zurück
      setAllColumns(standardColumns)
      saveColumnOrder(standardColumns)
      setColumnFilters({})
    } catch (error) {
      console.error('Fehler beim Löschen aller Gäste:', error)
      alert('Fehler beim Löschen aller Gäste')
    }
  }

  // Reset Tabelle: Löscht alle Gäste und setzt Struktur auf nur "Nummer" zurück
  const handleResetTable = async () => {
    if (!eventId) return
    
    const confirmMessage = 
      '⚠️ WICHTIG: Diese Aktion wird:\n\n' +
      '• ALLE Gäste löschen\n' +
      '• ALLE Spalten entfernen (außer "Nummer")\n' +
      '• Die Tabelle auf minimale Struktur zurücksetzen\n\n' +
      'Diese Aktion kann nicht rückgängig gemacht werden!\n\n' +
      'Möchten Sie fortfahren?'
    
    if (!confirm(confirmMessage)) {
      return
    }

    try {
      // Lösche alle Gäste
      const response = await fetch(`/api/guests?eventId=${eventId}&deleteAll=true`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        alert(`Fehler beim Löschen: ${error.error || 'Unbekannter Fehler'}`)
        return
      }

      // Setze Spalten auf nur "Nummer" und "İşlemler" zurück
      const minimalColumns = ['Nummer', 'İşlemler']
      setAllColumns(minimalColumns)
      saveColumnOrder(minimalColumns)
      setColumnFilters({})
      
      // Lade Gäste neu (sollte leer sein)
      await loadGuests()
      
      alert('✅ Tabelle zurückgesetzt:\n\n• Alle Gäste gelöscht\n• Struktur auf "Nummer" minimiert\n• Bereit für neuen Import')
    } catch (error) {
      console.error('Fehler beim Zurücksetzen der Tabelle:', error)
      alert('Fehler beim Zurücksetzen der Tabelle')
    }
  }

  const handleDelete = async (guestId: string) => {
    if (!confirm('Möchtest du diesen Gast wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.')) {
      return
    }

    try {
      const response = await fetch(`/api/guests?id=${guestId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        // Entferne Gast aus der Liste (filteredGuests leitet sich aus guests ab)
        setGuests(guests.filter(g => g.id !== guestId))
        setEditingGuest(null)
        
        
        alert('Gast erfolgreich gelöscht')
      } else {
        const error = await response.json()
        alert(error.error || 'Gast konnte nicht gelöscht werden')
      }
    } catch (error) {
      console.error('Löschen Fehler:', error)
      alert('Fehler beim Löschen des Gastes')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
        return 'bg-green-100 text-green-800'
      case 'ATTENDED':
        return 'bg-blue-100 text-blue-800'
      case 'CANCELLED':
        return 'bg-red-100 text-red-800'
      case 'NO_SHOW':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-yellow-100 text-yellow-800'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'INVITED':
        return 'Davet Edildi'
      case 'CONFIRMED':
        return 'Onaylandı'
      case 'ATTENDED':
        return 'Katıldı'
      case 'CANCELLED':
        return 'İptal Edildi'
      case 'NO_SHOW':
        return 'Gelmedi'
      default:
        return status
    }
  }

  // Export-Funktion für XLS und CSV
  const handleExport = (format: 'xls' | 'csv') => {
    try {
      // Bereite Daten vor: Verwende gefilterte Gäste oder alle Gäste
      const guestsToExport = filteredGuests.length > 0 ? filteredGuests : guests
      
      if (guestsToExport.length === 0) {
        alert('Keine Daten zum Exportieren vorhanden')
        return
      }

      // Erstelle Array von Objekten mit allen Spalten
      const exportData = guestsToExport.map((guest, index) => {
        const row: Record<string, any> = {}
        
        // Durchlaufe alle Spalten
        allColumns.forEach(column => {
          if (column === 'Nummer') {
            row[column] = index
          } else if (column === 'İşlemler') {
            // Überspringe Aktionen-Spalte
            return
          } else {
            // Hole Wert für diese Spalte
            const value = getColumnValue(guest, column, index)
            
            // Konvertiere Boolean zu String für bessere Lesbarkeit
            if (typeof value === 'boolean') {
              row[column] = value ? 'Ja' : 'Nein'
            } else {
              row[column] = value || ''
            }
          }
        })
        
        return row
      })

      if (format === 'xls') {
        // Erstelle Workbook
        const wb = XLSX.utils.book_new()
        const ws = XLSX.utils.json_to_sheet(exportData)
        
        // Füge Sheet zum Workbook hinzu
        XLSX.utils.book_append_sheet(wb, ws, 'Gästeliste')
        
        // Exportiere als XLSX
        const fileName = `Gästeliste_${new Date().toISOString().split('T')[0]}.xlsx`
        XLSX.writeFile(wb, fileName)
      } else {
        // CSV Export
        if (exportData.length === 0) {
          alert('Keine Daten zum Exportieren')
          return
        }

        // Hole alle Spalten (außer İşlemler)
        const columns = allColumns.filter(col => col !== 'İşlemler')
        
        // Erstelle CSV-Header
        const headers = columns.join(',')
        
        // Erstelle CSV-Zeilen
        const rows = exportData.map(row => {
          return columns.map(column => {
            const value = row[column] || ''
            // Escape Kommas und Anführungszeichen
            const stringValue = String(value)
            if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
              return `"${stringValue.replace(/"/g, '""')}"`
            }
            return stringValue
          }).join(',')
        })
        
        // Kombiniere Header und Zeilen
        const csvContent = [headers, ...rows].join('\n')
        
        // Erstelle Blob und Download
        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' }) // BOM für Excel
        const link = document.createElement('a')
        const url = URL.createObjectURL(blob)
        link.setAttribute('href', url)
        link.setAttribute('download', `Gästeliste_${new Date().toISOString().split('T')[0]}.csv`)
        link.style.visibility = 'hidden'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      }
      
      console.log(`✅ Export erfolgreich: ${exportData.length} Zeilen als ${format.toUpperCase()}`)
    } catch (error) {
      console.error('Fehler beim Exportieren:', error)
      alert('Fehler beim Exportieren: ' + (error instanceof Error ? error.message : 'Unbekannter Fehler'))
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard"
                className="text-gray-600 hover:text-gray-900"
              >
                ← Geri
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">Misafir Yönetimi</h1>
            </div>
            <div className="flex gap-2">
              {/* CSV/XLS Import */}
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="file"
                  accept=".csv,.xls,.xlsx"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) setImportFile(file)
                  }}
                  className="hidden"
                  id="file-import-input"
                />
                <label
                  htmlFor="file-import-input"
                  className="cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  📁 Datei auswählen
                </label>
                <div className="flex items-center gap-2 border-l border-gray-200 pl-2">
                  <span className="text-sm text-gray-600">Import:</span>
                  <label className="flex cursor-pointer items-center gap-1.5 text-sm">
                    <input
                      type="radio"
                      name="importMode"
                      checked={importMode === 'replace'}
                      onChange={() => setImportMode('replace')}
                      className="rounded border-gray-300 text-indigo-600"
                    />
                    Ersetzen
                  </label>
                  <label className="flex cursor-pointer items-center gap-1.5 text-sm">
                    <input
                      type="radio"
                      name="importMode"
                      checked={importMode === 'append'}
                      onChange={() => setImportMode('append')}
                      className="rounded border-gray-300 text-indigo-600"
                    />
                    Anhängen
                  </label>
                </div>
                {importFile && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">{importFile.name}</span>
                    <button
                      onClick={handleFileImport}
                      disabled={importing}
                      className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      {importing ? '⏳ Importiere...' : importMode === 'append' ? '📥 Liste anhängen' : '📥 Importieren'}
                    </button>
                    <button
                      onClick={() => setImportFile(null)}
                      className="rounded-lg bg-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
              {/* Doppelte prüfen (ohne Import) */}
              <button
                type="button"
                onClick={handleCheckDuplicates}
                disabled={guests.length === 0 || checkingDuplicates}
                className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
                title="Doppelte (Vorname+Nachname) automatisch löschen"
              >
                {checkingDuplicates ? '⏳ Lösche…' : '🔍 Doppelte prüfen'}
              </button>
              {/* Export Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleExport('xls')}
                  className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
                  title="Als Excel-Datei exportieren"
                >
                  📊 Excel Export
                </button>
                <button
                  onClick={() => handleExport('csv')}
                  className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
                  title="Als CSV-Datei exportieren"
                >
                  📄 CSV Export
                </button>
              </div>
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                + Yeni Misafir
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Links zu öffentlichen Anmeldeseiten */}
        <div className="mb-6 flex flex-wrap items-center gap-4 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3">
          <span className="text-sm font-medium text-indigo-900">Öffentliche Anmeldelinks:</span>
          <a
            href="/anmeldung/uid-iftar"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-medium text-indigo-700 shadow-sm ring-1 ring-indigo-200 hover:bg-indigo-100"
          >
            UID Iftar
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
          <a
            href="/anmeldung/sube-baskanlari"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-medium text-indigo-700 shadow-sm ring-1 ring-indigo-200 hover:bg-indigo-100"
          >
            Şube Başkanları
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
          <span className="text-xs text-indigo-600">(öffnen in neuem Tab, Link zum Teilen)</span>
        </div>

        {showAddForm && (
          <div className="mb-8 rounded-xl bg-white p-6 shadow-md">
            <h2 className="mb-4 text-xl font-semibold">Yeni Misafir Ekle</h2>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* Dynamische Felder basierend auf allColumns */}
              {allColumns
                .filter(col => col !== 'Nummer' && col !== 'İşlemler' && col !== 'ID' && col !== 'Hinzugefügt am')
                .map((column) => {
                  const isBooleanCol = booleanColumnsSet.has(column)
                  // Standard-Feld-Mappings (für direkte DB-Felder)
                  if (column === 'Name' || column === 'name') {
                    return (
                      <div key={column}>
                        <label className="block text-sm font-medium text-gray-700">
                          {column} *
                        </label>
                        <input
                          type="text"
                          required
                          value={formData[column] || formData.name || ''}
                          onChange={(e) => setFormData({ ...formData, [column]: e.target.value, name: e.target.value })}
                          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2"
                        />
                      </div>
                    )
                  }
                  
                  if (column === 'E-Mail' || column === 'E-Mail-Adresse') {
                    return (
                      <div key={column}>
                        <label className="block text-sm font-medium text-gray-700">{column}</label>
                        <input
                          type="email"
                          value={formData[column] || formData.email || ''}
                          onChange={(e) => setFormData({ ...formData, [column]: e.target.value, email: e.target.value })}
                          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2"
                        />
                      </div>
                    )
                  }
                  
                  if (column === 'Telefon' || column === 'Phone') {
                    return (
                      <div key={column}>
                        <label className="block text-sm font-medium text-gray-700">{column}</label>
                        <input
                          type="tel"
                          value={formData[column] || formData.phone || ''}
                          onChange={(e) => setFormData({ ...formData, [column]: e.target.value, phone: e.target.value })}
                          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2"
                        />
                      </div>
                    )
                  }
                  
                  // Boolean-Spalten als Checkboxen
                  if (isBooleanCol) {
                    return (
                      <div key={column} className="md:col-span-2">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={formData[column] === true || formData[column] === 'true'}
                            onChange={(e) => setFormData({ ...formData, [column]: e.target.checked })}
                            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="text-sm font-medium text-gray-700">{column}</span>
                        </label>
                      </div>
                    )
                  }
                  
                  // Alle anderen Spalten als Text-Input
                  return (
                    <div key={column}>
                      <label className="block text-sm font-medium text-gray-700">{column}</label>
                      <input
                        type="text"
                        value={formData[column] || ''}
                        onChange={(e) => setFormData({ ...formData, [column]: e.target.value })}
                        className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2"
                      />
                    </div>
                  )
                })}
              
              <div className="md:col-span-2 flex gap-2">
                <button
                  type="submit"
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                >
                  Kaydet
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
                >
                  İptal
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="rounded-xl bg-white shadow-md">
          <div className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Misafir Listesi</h2>
              <div className="flex items-center gap-4">
                {allColumns.length > 2 && (
                  <button
                    onClick={handleSaveAsDefault}
                    className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                    title="Aktuelle Spaltenreihenfolge als Standard speichern"
                  >
                    💾 Reihenfolge als Standard speichern
                  </button>
                )}
                {guests.length > 0 && (
                  <>
                    <button
                      onClick={handleResetTable}
                      className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700"
                      title="Tabelle zurücksetzen (nur Nummer-Spalte behalten)"
                    >
                      🔄 Tabelle zurücksetzen
                    </button>
                    <button
                      onClick={handleDeleteAll}
                      className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                      title="Alle Gäste löschen"
                    >
                      🗑️ Alle löschen
                    </button>
                  </>
                )}
                <div className="relative">
                  <input
                    type="text"
                    placeholder="İsim, e-posta, ünvan veya kurum ara..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-64 rounded-lg border border-gray-300 px-4 py-2 pl-10 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <svg
                    className="absolute left-3 top-2.5 h-5 w-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </div>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="text-sm text-gray-600 hover:text-gray-900"
                  >
                    Temizle
                  </button>
                )}
              </div>
            </div>
            {loading ? (
              <p className="text-gray-500">Yükleniyor...</p>
            ) : showNoResultsWarning ? (
              <div className="rounded-lg border-2 border-yellow-300 bg-yellow-50 p-8 text-center">
                <p className="text-yellow-800 font-medium">
                  ⚠️ Keine Ergebnisse gefunden
                </p>
                <p className="text-yellow-600 text-sm mt-2">
                  Filter werden zurückgesetzt...
                </p>
              </div>
            ) : filteredGuests.length === 0 ? (
              <div className="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center">
                <p className="text-gray-500">
                  {searchQuery ? 'Arama sonucu bulunamadı' : 'Henüz misafir eklenmemiş'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    {/* Header Row */}
                    <tr className="border-b border-gray-200">
                      {allColumns.map((column) => {
                        const isStandardColumn = standardColumns.includes(column)
                        const isDragging = draggedColumn === column
                        const isDragOver = dragOverColumn === column
                        return (
                          <th
                            key={column}
                            draggable={!protectedColumns.includes(column)}
                            onDragStart={() => !protectedColumns.includes(column) && handleDragStart(column)}
                            onDragOver={(e) => !protectedColumns.includes(column) && handleDragOver(e, column)}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => !protectedColumns.includes(column) && handleDrop(e, column)}
                            onDragEnd={handleDragEnd}
                            className={`px-4 py-3 text-left text-sm font-semibold text-gray-900 whitespace-nowrap select-none ${
                              protectedColumns.includes(column) ? 'cursor-default bg-gray-50' : 'cursor-move'
                            } ${
                              isDragging ? 'opacity-50' : ''
                            } ${
                              isDragOver ? 'bg-indigo-100 border-l-4 border-indigo-500' : ''
                            } transition-colors`}
                          >
                            <div className="flex items-center gap-2">
                              <span 
                                className={`flex items-center gap-1 ${
                                  column !== 'İşlemler' ? 'cursor-pointer hover:text-indigo-600' : ''
                                }`}
                                onClick={() => column !== 'İşlemler' && handleSort(column)}
                                title={column !== 'İşlemler' ? 'Klicken zum Sortieren' : ''}
                              >
                                {column !== 'İşlemler' && (
                                  <svg
                                    className="h-4 w-4 text-gray-400"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M4 8h16M4 16h16"
                                    />
                                  </svg>
                                )}
                                {column}
                                {sortColumn === column && column !== 'İşlemler' && (
                                  <span className="ml-1 text-indigo-600">
                                    {sortDirection === 'asc' ? (
                                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                      </svg>
                                    ) : (
                                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                      </svg>
                                    )}
                                  </span>
                                )}
                                {!sortColumn && column !== 'İşlemler' && (
                                  <svg className="h-3 w-3 ml-1 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                                  </svg>
                                )}
                              </span>
                              {!isStandardColumn && !protectedColumns.includes(column) && column !== 'Nummer' && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleDeleteColumn(column)
                                  }}
                                  className="text-red-500 hover:text-red-700"
                                  title={`Spalte "${column}" löschen`}
                                  onMouseDown={(e) => e.stopPropagation()}
                                >
                                  🗑️
                                </button>
                              )}
                              {(protectedColumns.includes(column) || column === 'Nummer') && (
                                <span className="text-xs text-gray-400" title="Geschützte Spalte">
                                  🔒
                                </span>
                              )}
                            </div>
                          </th>
                        )
                      })}
                    </tr>
                    {/* Filter Row */}
                    <tr className="border-b border-gray-200 bg-gray-50">
                      {allColumns.map((column) => {
                        const hasNoFilter = columnsWithoutFilter.includes(column)
                        return (
                          <th key={column} className="px-4 py-2">
                            {column === 'İşlemler' ? (
                              <button
                                onClick={() => {
                                  const newFilters: Record<string, string> = {}
                                  allColumns.forEach(col => {
                                    if (col !== 'İşlemler' && !columnsWithoutFilter.includes(col)) {
                                      newFilters[col] = ''
                                    }
                                  })
                                  setColumnFilters(newFilters)
                                }}
                                className="rounded bg-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-300"
                                title="Alle Filter zurücksetzen"
                              >
                                🔄
                              </button>
                            ) : hasNoFilter ? (
                              <span className="text-xs text-gray-400">-</span>
                            ) : (
                              <input
                                type="text"
                                placeholder={`${column} filtrele...`}
                                value={columnFilters[column] || ''}
                                onChange={(e) => setColumnFilters({ ...columnFilters, [column]: e.target.value })}
                                className="w-full rounded border border-gray-300 px-2 py-1 text-xs focus:border-indigo-500 focus:outline-none"
                              />
                            )}
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {displayedGuests.map((guest, idx) => {
                      const index = pageIndex * PAGE_SIZE + idx
                      return (
                      <tr
                        key={guest.id}
                        className={`border-b border-gray-100 hover:bg-gray-50 ${guest.isVip ? 'bg-yellow-50' : ''}`}
                      >
                        {allColumns.map((column) => {
                          // Nummer-Spalte: Automatisch generierte fortlaufende Nummer (0, 1, 2, ...)
                          if (column === 'Nummer') {
                            return (
                              <td key={column} className="px-4 py-3 text-center text-sm font-medium text-gray-600">
                                {index}
                              </td>
                            )
                          }
                          
                          // İşlemler-Spalte: Aktionen
                          if (column === 'İşlemler') {
                            return (
                              <td key={column} className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  {editingGuest === guest.id ? (
                                    <>
                                      <button
                                        onClick={() => setEditingGuest(null)}
                                        className="text-sm text-indigo-600 hover:text-indigo-800"
                                        title="Bearbeitung beenden"
                                      >
                                        ✓
                                      </button>
                                      <button
                                        onClick={() => handleDelete(guest.id)}
                                        className="text-sm text-red-600 hover:text-red-800"
                                        title="Gast löschen"
                                      >
                                        🗑️
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      onClick={() => setEditingGuest(guest.id)}
                                      className="text-sm text-gray-600 hover:text-indigo-600"
                                      title="Bearbeiten"
                                    >
                                      ✎
                                    </button>
                                  )}
                                </div>
                              </td>
                            )
                          }
                          
                          // ID-Spalte: Nicht editierbar
                          if (column === 'ID') {
                            const value = getColumnValue(guest, column)
                            return (
                              <td key={column} className="px-4 py-3 text-sm text-gray-500">
                                {value || '-'}
                              </td>
                            )
                          }
                          
                          // Hole Wert für diese Spalte
                          const rawValue = getColumnValue(guest, column, index)
                          const isBooleanColumn = isBooleanColumnMap.get(column) ?? false

                          // Wenn Boolean-Spalte: Rendere Checkbox
                          if (isBooleanColumn) {
                            const checkboxKey = `${guest.id}-${column}`
                            const hasLocalState = checkboxKey in checkboxStates
                            const add = guest._additionalParsed ?? {}
                            let dbValue: any = rawValue
                            if (Object.prototype.hasOwnProperty.call(add, column)) {
                              dbValue = add[column]
                              if (typeof dbValue === 'string') {
                                const lowerValue = dbValue.toLowerCase().trim()
                                dbValue = lowerValue === 'true' ? true : lowerValue === 'false' ? false : dbValue
                              }
                            }
                            
                            const checked = hasLocalState 
                              ? checkboxStates[checkboxKey]
                              : (typeof dbValue === 'boolean' ? dbValue : toBoolean(dbValue))
                            
                            return (
                              <td 
                                key={column} 
                                className="px-4 py-3 text-center"
                                onClick={(e) => {
                                  // Verhindere dass der td-Klick die Checkbox beeinflusst
                                  e.stopPropagation()
                                }}
                                onMouseDown={(e) => {
                                  // Verhindere dass mousedown die Checkbox beeinflusst
                                  e.stopPropagation()
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={async (e) => {
                                    // WICHTIG: Nur stopPropagation, NICHT preventDefault!
                                    e.stopPropagation()
                                    
                                    const newValue = e.target.checked
                                    const checkboxKey = `${guest.id}-${column}`
                                    
                                    // Optimistic Update: Setze sofort den lokalen State
                                    setCheckboxStates(prev => ({
                                      ...prev,
                                      [checkboxKey]: newValue
                                    }))
                                    
                                    console.log('🔘 Checkbox geändert:', { guestId: guest.id, column, checked: newValue })
                                    
                                    // Spezielle Behandlung für "Einladungsliste"
                                    if (column === 'Einladungsliste' || column.toLowerCase().includes('einladungsliste')) {
                                      try {
                                        // Verwende eventId aus State, oder lade es
                                        let currentEventId = eventId
                                        
                                        if (!currentEventId) {
                                          const eventsRes = await fetch(getEventsUrl())
                                          if (!eventsRes.ok) {
                                            throw new Error('Fehler beim Laden der Events')
                                          }
                                          const eventObj = await eventsRes.json()
                                          currentEventId = eventObj?.id ?? null
                                          
                                          if (!currentEventId) {
                                            throw new Error('Kein Event im gewählten Projekt. Bitte Projekt wechseln.')
                                          }
                                        }
                                        
                                        if (newValue) {
                                          // Erstelle Einladung (ohne E-Mail zu senden)
                                          const createInvitationRes = await fetch('/api/invitations/create', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                              guestId: guest.id,
                                              eventId: currentEventId,
                                            }),
                                          })
                                          
                                          if (createInvitationRes.ok) {
                                            const newInvitation = await createInvitationRes.json()
                                            setInvitations(prev => ({ ...prev, [guest.id]: newInvitation }))
                                            console.log('✅ Einladung erstellt:', newInvitation)
                                            
                                            // Benachrichtige andere Tabs/Seiten über neue Einladung
                                            if (typeof window !== 'undefined') {
                                              window.localStorage.setItem('invitation-updated', Date.now().toString())
                                              window.dispatchEvent(new Event('invitation-updated'))
                                            }
                                          } else {
                                            const errorData = await createInvitationRes.json().catch(() => ({ error: 'Unbekannter Fehler' }))
                                            const msg = [errorData.error, errorData.details].filter(Boolean).join(': ') || 'Fehler beim Erstellen der Einladung'
                                            throw new Error(msg)
                                          }
                                        } else {
                                          // Einladung bleibt in DB, wird nur aus local state entfernt
                                          // (Einladung wird nicht gelöscht, nur aus "Einladungsliste" entfernt)
                                          setInvitations(prev => {
                                            const newInvitations = { ...prev }
                                            delete newInvitations[guest.id]
                                            return newInvitations
                                          })
                                          console.log('✅ Einladung aus Liste entfernt (bleibt in DB)')
                                        }
                                      } catch (error) {
                                        console.error('❌ Fehler bei Einladungsliste:', error)
                                        // Setze Checkbox zurück bei Fehler
                                        setCheckboxStates(prev => {
                                          const newState = { ...prev }
                                          delete newState[checkboxKey]
                                          return newState
                                        })
                                        alert('Fehler beim Verarbeiten der Einladungsliste: ' + (error instanceof Error ? error.message : 'Unbekannter Fehler'))
                                        console.error('Einladungsliste Fehlerdetails:', error)
                                        return
                                      }
                                    }
                                    
                                    // Speichere in additionalData
                                    const additional = guest.additionalData ? JSON.parse(guest.additionalData) : {}
                                    additional[column] = newValue
                                    
                                    try {
                                      const response = await fetch('/api/guests', {
                                        method: 'PATCH',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                          id: guest.id,
                                          additionalData: JSON.stringify(additional)
                                        }),
                                      })
                                      
                                      if (response.ok) {
                                        const updated = await response.json()
                                        
                                        // Prüfe ob der Wert korrekt gespeichert wurde
                                        let savedValue: any = false
                                        if (updated?.additionalData) {
                                          try {
                                            const savedAdditional = JSON.parse(updated.additionalData)
                                            savedValue = savedAdditional[column]
                                            console.log(`💾 Gespeicherter Wert für ${column}:`, savedValue, typeof savedValue)
                                            
                                            // Konvertiere String-Booleans zu echten Booleans
                                            if (typeof savedValue === 'string') {
                                              const lowerValue = savedValue.toLowerCase().trim()
                                              if (lowerValue === 'true') {
                                                savedValue = true
                                              } else if (lowerValue === 'false') {
                                                savedValue = false
                                              }
                                            }
                                          } catch (e) {
                                            console.error('Fehler beim Parsen des gespeicherten additionalData:', e)
                                          }
                                        }
                                        
                                        // Aktualisiere den Gast im State
                                        setGuests(prevGuests => prevGuests.map(g => g.id === guest.id ? updated : g))
                                        
                                        // Entferne lokalen State NUR wenn der Wert korrekt gespeichert wurde
                                        // Vergleiche sowohl direkten Wert als auch toBoolean-Konvertierung
                                        const savedBoolean = typeof savedValue === 'boolean' ? savedValue : toBoolean(savedValue)
                                        if (savedBoolean === newValue) {
                                          setCheckboxStates(prev => {
                                            const newState = { ...prev }
                                            delete newState[checkboxKey]
                                            return newState
                                          })
                                          console.log('✅ Checkbox gespeichert und State entfernt:', { guestId: guest.id, column, checked: newValue, savedValue, savedBoolean })
                                        } else {
                                          console.warn('⚠️ Wert nicht korrekt gespeichert, behalte lokalen State:', { guestId: guest.id, column, expected: newValue, saved: savedValue, savedBoolean })
                                        }
                                      } else {
                                        const error = await response.json()
                                        console.error('❌ Fehler beim Speichern:', error)
                                        // Setze lokalen State zurück bei Fehler
                                        setCheckboxStates(prev => {
                                          const newState = { ...prev }
                                          delete newState[checkboxKey]
                                          return newState
                                        })
                                        alert('Fehler beim Speichern: ' + (error.error || 'Unbekannter Fehler'))
                                      }
                                    } catch (error) {
                                      console.error('❌ Fehler beim Speichern:', error)
                                      // Setze lokalen State zurück bei Fehler
                                      setCheckboxStates(prev => {
                                        const newState = { ...prev }
                                        delete newState[checkboxKey]
                                        return newState
                                      })
                                      alert('Fehler beim Speichern')
                                    }
                                  }}
                                  onClick={(e) => {
                                    // Verhindere dass der Klick weiter propagiert
                                    e.stopPropagation()
                                  }}
                                  onMouseDown={(e) => {
                                    // Verhindere dass mousedown weiter propagiert
                                    e.stopPropagation()
                                  }}
                                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer w-4 h-4"
                                  style={{ pointerEvents: 'auto', zIndex: 100, position: 'relative' }}
                                />
                              </td>
                            )
                          }
                          
                          // Normale Text-Spalte: Editierbar (außer ID)
                          const value = rawValue
                          const isEditing = editingCell?.guestId === guest.id && editingCell?.column === column
                          
                          return (
                            <td 
                              key={column} 
                              className="px-4 py-3 text-sm text-gray-600 cursor-pointer hover:bg-gray-50"
                              onClick={(e) => {
                                if (!isEditing && column !== 'ID') {
                                  handleCellEdit(guest.id, column, value)
                                }
                              }}
                            >
                              {isEditing ? (
                                <div className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    value={editingValue}
                                    onChange={(e) => setEditingValue(e.target.value)}
                                    onBlur={() => handleCellSave(guest.id, column)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        handleCellSave(guest.id, column)
                                      } else if (e.key === 'Escape') {
                                        handleCellCancel()
                                      }
                                    }}
                                    className="flex-1 rounded border border-indigo-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    autoFocus
                                  />
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleCellSave(guest.id, column)
                                    }}
                                    className="text-green-600 hover:text-green-700"
                                  >
                                    ✓
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleCellCancel()
                                    }}
                                    className="text-red-600 hover:text-red-700"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ) : (
                                <span className="hover:text-indigo-600" title={value || '-'}>
                                  {value || <span className="text-gray-400 italic">Klicken zum Bearbeiten</span>}
                                </span>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    )
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {filteredGuests.length > PAGE_SIZE && (
              <div className="mt-4 flex items-center justify-between border-t border-gray-200 pt-4">
                <span className="text-sm text-gray-600">
                  Seite {pageIndex + 1} von {totalPages} ({filteredGuests.length} Gäste)
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
                    disabled={pageIndex === 0}
                    className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    ← Zurück
                  </button>
                  <button
                    type="button"
                    onClick={() => setPageIndex((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={pageIndex >= totalPages - 1}
                    className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Weiter →
                  </button>
                </div>
              </div>
            )}
            {searchQuery && (
              <div className="mt-4 text-sm text-gray-600">
                {filteredGuests.length} misafir bulundu (toplam {guests.length})
              </div>
            )}
          </div>
        </div>

        {/* Modal: Doppelte Einträge (nach Anhängen) */}
        {showDuplicateModal && duplicateGroups.length > 0 && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-xl bg-white shadow-xl">
              <div className="border-b border-gray-200 px-6 py-4">
                <h2 className="text-xl font-semibold text-gray-900">Doppelte Einträge</h2>
                <p className="mt-1 text-sm text-gray-600">
                  Doppelte Einträge: gleicher Vorname und gleicher Nachname (z. B. „Ali Koc“ mehrfach). Bitte wählen Sie pro Gruppe, welchen Eintrag Sie löschen oder bearbeiten möchten.
                </p>
              </div>
              <div className="max-h-[60vh] overflow-y-auto px-6 py-4">
                {duplicateGroups.map((group, idx) => (
                  <div key={`${group.type}-${group.value}-${idx}`} className="mb-6">
                    <h3 className="mb-2 text-sm font-medium text-gray-700">
                      Gleicher Vorname + Nachname: {group.value || '(leer)'}
                    </h3>
                    <table className="min-w-full border border-gray-200 text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-gray-600">Vorname</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-600">Nachname</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-600">E-Mail</th>
                          <th className="px-3 py-2 text-right font-medium text-gray-600">Aktionen</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.guests.map((guest) => {
                          const { vorname, nachname } = getVornameNachname(guest)
                          return (
                          <tr key={guest.id} className="border-t border-gray-100">
                            <td className="px-3 py-2">{vorname || '-'}</td>
                            <td className="px-3 py-2">{nachname || '-'}</td>
                            <td className="px-3 py-2">{guest.email || '-'}</td>
                            <td className="px-3 py-2 text-right">
                              <button
                                type="button"
                                onClick={() => handleEditDuplicateGuest(guest)}
                                className="mr-2 text-indigo-600 hover:text-indigo-800"
                              >
                                Bearbeiten
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteDuplicateGuest(guest.id)}
                                className="text-red-600 hover:text-red-800"
                              >
                                Löschen
                              </button>
                            </td>
                          </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
              <div className="border-t border-gray-200 px-6 py-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => { setShowDuplicateModal(false); setDuplicateGroups([]) }}
                  className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
                >
                  Schließen
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ENTFERNT: Google Sheets Konfigurations-Modal - komplett entfernt */}
      </main>
    </div>
  )
}
