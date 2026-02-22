'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { getKnownCategoryKeys, getCategoryLabel } from '@/lib/guestCategory'
import { getAuthHeaders } from '@/lib/authClient'

/** Fetch mit Auth (Cookie + Bearer) für zuverlässige Session. */
function fetchAuth(url: string, init?: RequestInit) {
  return fetch(url, {
    ...init,
    credentials: 'include',
    headers: { ...getAuthHeaders(), ...init?.headers },
  })
}

function sanitizePdfText(s: string): string {
  return (s || '').replace(/[İıŞşĞğÜüÖöÇç]/g, (c) => ({ İ: 'I', ı: 'i', Ş: 'S', ş: 's', Ğ: 'G', ğ: 'g', Ü: 'U', ü: 'u', Ö: 'O', ö: 'o', Ç: 'C', ç: 'c' }[c] ?? c))
}

/** E-Mail aus guest.email oder additionalData: E-Mail kurumsal / E-Mail privat (erstes vorhandenes). */
function getGuestDisplayEmail(guest: any): string {
  if (!guest) return ''
  const main = guest.email && String(guest.email).trim()
  if (main) return main
  if (!guest.additionalData) return ''
  try {
    const ad = typeof guest.additionalData === 'string' ? JSON.parse(guest.additionalData) : guest.additionalData
    const kurumsal = ad['E-Mail kurumsal']
    const privat = ad['E-Mail privat']
    const k = kurumsal != null && String(kurumsal).trim() ? String(kurumsal).trim() : ''
    const p = privat != null && String(privat).trim() ? String(privat).trim() : ''
    if (k) return k
    if (p) return p
    return ''
  } catch {
    return ''
  }
}

function parseAdditionalData(guest: any): Record<string, unknown> {
  if (!guest?.additionalData) return {}
  try {
    const ad = typeof guest.additionalData === 'string' ? JSON.parse(guest.additionalData) : guest.additionalData
    return ad && typeof ad === 'object' ? (ad as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

function getFromAdditional(add: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(add, key) && add[key] != null) {
      const v = String(add[key]).trim()
      if (v !== '') return v
    }
  }
  return ''
}

/** Vorname aus guest.name (erstes Wort) oder additionalData „Vorname“. */
function getGuestVorname(guest: any): string {
  if (!guest) return ''
  const add = parseAdditionalData(guest)
  const fromAdd = getFromAdditional(add, ['Vorname', 'vorname', 'Vorname ', 'FirstName'])
  if (fromAdd) return fromAdd
  const name = guest.name ? String(guest.name).trim() : ''
  const parts = name.split(/\s+/).filter((p: string) => p.trim() !== '')
  return parts[0] || ''
}

/** Nachname aus additionalData oder guest.name (Rest nach erstem Wort). */
function getGuestNachname(guest: any): string {
  if (!guest) return ''
  const add = parseAdditionalData(guest)
  const fromAdd = getFromAdditional(add, ['Nachname', 'nachname', 'Name'])
  if (fromAdd) return fromAdd
  const name = guest.name ? String(guest.name).trim() : ''
  const parts = name.split(/\s+/).filter((p: string) => p.trim() !== '')
  return parts.slice(1).join(' ') || ''
}

/** Staat/Institution aus guest.organization oder additionalData. */
function getGuestStaatInstitution(guest: any): string {
  if (!guest) return ''
  if (guest.organization && String(guest.organization).trim() !== '') return String(guest.organization).trim()
  const add = parseAdditionalData(guest)
  const fromAdd = getFromAdditional(add, ['Staat/Institution', 'Staat / Institution', 'StaatInstitution', 'Institution', 'Staat'])
  if (fromAdd) return fromAdd
  for (const [key, value] of Object.entries(add)) {
    const k = String(key).toLowerCase()
    if ((k.includes('staat') || k.includes('institution')) && value != null && String(value).trim() !== '') return String(value).trim()
  }
  return ''
}

/** Telefon aus guest.phone oder additionalData (Telefon, Phone, Mobil). */
function getGuestDisplayPhone(guest: any): string {
  if (!guest) return ''
  const main = guest.phone && String(guest.phone).trim()
  if (main) return main
  const add = parseAdditionalData(guest)
  return getFromAdditional(add, ['Telefon', 'telefon', 'Phone', 'phone', 'Mobil', 'mobil'])
}

function getWhatsAppMessage(linkUrl: string, isAccepted: boolean): string {
  const base = `UID BERLIN IFTAR HATIRLATMA VE GİRİŞ KODUNUZ:

Tarih: 27 Şubat 2026, Cuma

🕰 Giriş: 16:30

🕰 Program Başlangıcı: 17:00

🕰 İftar Saati: 17:47

📍 Yer: Moon Events – Festsaal
Oranienstraße 140–142
10969 Berlin

`
  if (isAccepted) {
    return base + `Ihr QR-Code (PDF zum Download): ${linkUrl}`
  }
  return base + `Bitte bestätigen Sie Ihre Teilnahme, um Ihren QR-Code zu erhalten: ${linkUrl}`
}

/** Telefonnummer für wa.me: Ziffern für WhatsApp-Link. Ausländische Nummern (+/00) nicht mit 49 versehen. */
function phoneForWhatsApp(phone: string): string {
  const trimmed = (phone || '').trim()
  const raw = trimmed.replace(/\D/g, '')
  if (raw.length === 0) return ''
  // Ausländische Nummer: + oder 00 am Anfang → Ländervorwahl bereits enthalten
  if (trimmed.startsWith('+') || trimmed.startsWith('00')) {
    return raw.replace(/^0+/, '') // 0049... → 49..., +90... → 90...
  }
  // Deutsche Nummer: 0 durch 49 ersetzen
  if (raw.startsWith('49') && raw.length >= 10) return raw
  if (raw.startsWith('0')) return '49' + raw.slice(1)
  return '49' + raw
}

/** Anrede 2 aus guest.additionalData (Gästeliste-Spalte „Anrede 2“). */
function getGuestAnrede2(guest: any): string {
  if (!guest) return ''
  const add = parseAdditionalData(guest)
  return getFromAdditional(add, ['Anrede 2', 'Anrede2', 'Anrede_2'])
}

/** Bemerkungen aus guest.notes oder additionalData. */
function getGuestBemerkungen(guest: any): string {
  if (!guest) return ''
  if (guest.notes != null && String(guest.notes).trim() !== '') return String(guest.notes).trim()
  const add = parseAdditionalData(guest)
  return getFromAdditional(add, ['Bemerkungen', 'bemerkungen', 'Notizen', 'notizen', 'Notes', 'Anmerkungen'])
}

export default function InvitationsPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [invitations, setInvitations] = useState<any[]>([])
  const [guests, setGuests] = useState<any[]>([])
  const [templates, setTemplates] = useState<any[]>([])
  const [emailConfigs, setEmailConfigs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedGuests, setSelectedGuests] = useState<string[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')
  const [selectedLanguage, setSelectedLanguage] = useState<string>('de')
  const [sending, setSending] = useState(false)
  const [activeTab, setActiveTab] = useState<'send' | 'list' | 'templates' | 'config'>('send')
  const [eventId, setEventId] = useState<string>('')
  const [selectedInvitations, setSelectedInvitations] = useState<string[]>([])
  const [editingCell, setEditingCell] = useState<{ invitationId: string; field: string } | null>(null)
  const [editingValue, setEditingValue] = useState<string>('')
  const [includeLinks, setIncludeLinks] = useState<boolean>(true) // Standard: Links einbeziehen
  const [listSortBy, setListSortBy] = useState<'bemerkungen' | null>(null)
  const [listSortDir, setListSortDir] = useState<'asc' | 'desc'>('asc')
  const [listResponseFilter, setListResponseFilter] = useState<'all' | 'ACCEPTED' | 'DECLINED' | 'PENDING'>('all')
  const [listSearchQuery, setListSearchQuery] = useState('')
  const [listPage, setListPage] = useState(1)
  const [listPageSize, setListPageSize] = useState(25)
  const [editingTemplate, setEditingTemplate] = useState<any>(null)
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([])
  const [templateForm, setTemplateForm] = useState({
    name: '',
    language: 'de',
    category: '' as string,
    subject: '',
    body: '',
    plainText: '',
    isDefault: false,
  })
  const [configForm, setConfigForm] = useState({
    name: '',
    type: 'GMAIL' as 'GMAIL' | 'ICLOUD' | 'IMAP' | 'MAILJET',
    email: '',
    senderName: '',
    appPassword: '',
    password: '',
    smtpHost: '',
    smtpPort: 587,
    smtpUseStartTls: false,
    imapHost: '',
    imapPort: 993,
    mailjetApiKey: '',
    mailjetApiSecret: '',
    isActive: false,
  })
  const [editingConfig, setEditingConfig] = useState<any>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [testEmailForm, setTestEmailForm] = useState({
    email: '',
    templateId: '',
    includeLinks: true,
  })
  const [sendingTestEmail, setSendingTestEmail] = useState(false)
  const [testingConfig, setTestingConfig] = useState(false)
  const [testConfigEmail, setTestConfigEmail] = useState('')
  const [resendSending, setResendSending] = useState(false)
  const [currentEvent, setCurrentEvent] = useState<{ id: string; maxAccompanyingGuests?: number } | null>(null)
  const [maxAccompanyingGuestsInput, setMaxAccompanyingGuestsInput] = useState<string>('5')
  const [savingMaxAccompanying, setSavingMaxAccompanying] = useState(false)
  const [syncFromRegistrations, setSyncFromRegistrations] = useState(false)
  const [formattingPhones, setFormattingPhones] = useState(false)
  const [revertingResponses, setRevertingResponses] = useState(false)
  const [previewModal, setPreviewModal] = useState<{ guestName: string; subject: string; body: string } | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [statsListFilter, setStatsListFilter] = useState<'sent' | 'sentRead' | 'sentNotRead' | 'openedAccepted' | 'openedDeclined' | 'total' | null>(null)
  const [regeneratingQrId, setRegeneratingQrId] = useState<string | null>(null)
  const [linkPreviewInvitation, setLinkPreviewInvitation] = useState<{ acceptToken: string; guestName?: string } | null>(null)
  const [acceptingOnBehalfId, setAcceptingOnBehalfId] = useState<string | null>(null)
  const [verifyingQrId, setVerifyingQrId] = useState<string | null>(null)

  useEffect(() => {
    const getCookie = (name: string) => {
      if (typeof document === 'undefined') return null
      const value = `; ${document.cookie}`
      const parts = value.split(`; ${name}=`)
      if (parts.length === 2) {
        return parts.pop()?.split(';').shift() || null
      }
      return null
    }

    const token = getCookie('auth-token') || localStorage.getItem('auth-token')
    if (!token) {
      router.push('/login')
      return
    }

    setUser({ name: 'User' })
    loadData()
  }, [router])

  useEffect(() => {
    const onProjectChange = () => loadData()
    if (typeof window !== 'undefined') {
      window.addEventListener('dashboard-project-changed', onProjectChange)
      return () => window.removeEventListener('dashboard-project-changed', onProjectChange)
    }
  }, [])

  // Lade Gäste, wenn Tab "send" aktiviert wird (Lazy Loading)
  useEffect(() => {
    if (activeTab !== 'send' || !eventId) return
    loadGuests(eventId)
  }, [activeTab, eventId])

  // Lade E-Mail-Konfigurationen, wenn Tab "config" aktiviert wird (Lazy Loading)
  useEffect(() => {
    if (activeTab !== 'config') return
    loadEmailConfigs()
  }, [activeTab])

  // Lade Einladungen neu, wenn Tab "list" aktiviert wird (Event ggf. nachladen)
  useEffect(() => {
    if (activeTab !== 'list') return
    const ensureEventAndLoadList = async () => {
      let evId = eventId
      if (!evId) {
        const projectId = typeof window !== 'undefined' ? localStorage.getItem('dashboard-project-id') : null
        const eventsUrl = projectId ? `/api/events?projectId=${encodeURIComponent(projectId)}` : '/api/events'
        const res = await fetchAuth(eventsUrl)
        if (res.ok) {
          const eventData = await res.json()
          const event = Array.isArray(eventData) ? eventData[0] : eventData
          if (event?.id) {
            setEventId(event.id)
            evId = event.id
          }
        }
      }
      if (evId) loadInvitations(evId)
    }
    ensureEventAndLoadList()
  }, [activeTab, eventId])

  // Polling: Lade Einladungen alle 30 Sekunden, wenn Tab "list" aktiv ist (reduziert für Performance)
  useEffect(() => {
    if (activeTab !== 'list' || !eventId) return

    const interval = setInterval(() => {
      loadInvitations(eventId)
    }, 30000) // Alle 30 Sekunden

    return () => clearInterval(interval)
  }, [activeTab, eventId])

  // Lade Einladungen neu, wenn Fenster fokussiert wird
  useEffect(() => {
    const handleFocus = () => {
      if (activeTab === 'list' && eventId) {
        loadInvitations(eventId)
      }
    }

    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [activeTab, eventId])

  // Lade Einladungen sofort neu, wenn eine neue Einladung erstellt wurde (von Gästeliste)
  useEffect(() => {
    const handleInvitationUpdate = () => {
      if (activeTab === 'list' && eventId) {
        loadInvitations(eventId)
      }
    }

    window.addEventListener('invitation-updated', handleInvitationUpdate)
    
    // Prüfe auch localStorage für Updates (für Cross-Tab-Kommunikation)
    const checkForUpdates = () => {
      const lastUpdate = localStorage.getItem('invitation-updated')
      if (lastUpdate) {
        const updateTime = parseInt(lastUpdate, 10)
        const now = Date.now()
        // Wenn Update weniger als 10 Sekunden alt ist, lade neu
        if (now - updateTime < 10000) {
          if (activeTab === 'list' && eventId) {
            loadInvitations(eventId)
          }
        }
      }
    }

    // Prüfe alle 10 Sekunden auf Updates (reduziert für Performance)
    const updateCheckInterval = setInterval(checkForUpdates, 10000)

    return () => {
      window.removeEventListener('invitation-updated', handleInvitationUpdate)
      clearInterval(updateCheckInterval)
    }
  }, [activeTab, eventId])

  const loadData = async () => {
    try {
      setLoading(true)
      const projectId = typeof window !== 'undefined' ? localStorage.getItem('dashboard-project-id') : null
      const eventsUrl = projectId ? `/api/events?projectId=${encodeURIComponent(projectId)}` : '/api/events'
      const eventsRes = await fetchAuth(eventsUrl)
      if (eventsRes.ok) {
        const eventData = await eventsRes.json()
        let event = Array.isArray(eventData) ? (eventData.length > 0 ? eventData[0] : null) : eventData
        if (event?.id) {
          setEventId(event.id)
          setCurrentEvent(event)
          setMaxAccompanyingGuestsInput(String(event.maxAccompanyingGuests ?? 5))
          // Nur Events + Templates initial laden (schneller Start)
          await loadTemplates()
          // Gäste und Einladungen lazy bei Tab-Wechsel
          if (activeTab === 'send') await loadGuests(event.id)
          if (activeTab === 'list') await loadInvitations(event.id)
          if (activeTab === 'config') await loadEmailConfigs()
        } else {
          setEventId('')
          setCurrentEvent(null)
          setGuests([])
          setInvitations([])
        }
      } else {
        setEventId('')
        setCurrentEvent(null)
        setGuests([])
        setInvitations([])
      }
    } catch (error) {
      console.error('Fehler beim Laden:', error)
      setEventId('')
      setCurrentEvent(null)
      setGuests([])
      setInvitations([])
    } finally {
      setLoading(false)
    }
  }

  const loadGuests = async (evId: string) => {
    try {
      const response = await fetchAuth(`/api/guests?eventId=${evId}`)
      if (response.ok) {
        const data = await response.json()
        setGuests(data.filter((g: any) => getGuestDisplayEmail(g))) // Gäste mit E-Mail (guest.email oder E-Mail kurumsal/privat)
      }
    } catch (error) {
      console.error('Fehler beim Laden der Gäste:', error)
    }
  }

  const loadInvitations = async (evId: string) => {
    if (!evId) return
    try {
      const response = await fetchAuth(`/api/invitations/list?eventId=${evId}`)
      const data = await response.json().catch(() => [])
      setInvitations(response.ok && Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Fehler beim Laden der Einladungen:', error)
      setInvitations([])
    }
  }

  const loadTemplates = async () => {
    try {
      const response = await fetchAuth('/api/email-templates')
      if (response.ok) {
        const data = await response.json()
        setTemplates(data)
        // Setze Standard-Template für Sprache
        const defaultTemplate = data.find((t: any) => t.language === selectedLanguage && t.isDefault)
        if (defaultTemplate) {
          setSelectedTemplate(defaultTemplate.id)
        }
      }
    } catch (error) {
      console.error('Fehler beim Laden der Templates:', error)
    }
  }

  const loadEmailConfigs = async () => {
    try {
      const response = await fetchAuth('/api/email-config')
      if (response.ok) {
        const data = await response.json()
        setEmailConfigs(data)
      }
    } catch (error) {
      console.error('Fehler beim Laden der Email-Konfigurationen:', error)
    }
  }

  const handleSaveConfig = async () => {
    try {
      if (!configForm.name || !configForm.email) {
        alert('Name und E-Mail sind erforderlich')
        return
      }

      if (configForm.type === 'GMAIL' && !configForm.appPassword) {
        alert('Gmail App-Passwort ist erforderlich')
        return
      }

      if (configForm.type === 'ICLOUD' && !configForm.appPassword) {
        alert('iCloud App-Passwort ist erforderlich')
        return
      }

      if (configForm.type === 'IMAP' && (!configForm.smtpHost || !configForm.smtpPort)) {
        alert('SMTP Host und Port sind erforderlich')
        return
      }

      if (configForm.type === 'MAILJET' && (!configForm.mailjetApiKey || !configForm.mailjetApiSecret)) {
        alert('Mailjet API Key und API Secret sind erforderlich')
        return
      }

      const url = editingConfig ? '/api/email-config' : '/api/email-config'
      const method = editingConfig ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingConfig ? { id: editingConfig.id, ...configForm } : configForm),
      })

      if (response.ok) {
        await loadEmailConfigs()
        setConfigForm({
          name: '',
          type: 'GMAIL',
          email: '',
          senderName: '',
          appPassword: '',
          password: '',
          smtpHost: '',
          smtpPort: 587,
          smtpUseStartTls: false,
          imapHost: '',
          imapPort: 993,
          mailjetApiKey: '',
          mailjetApiSecret: '',
          isActive: false,
        })
        setEditingConfig(null)
        alert('Email-Konfiguration gespeichert')
      } else {
        const error = await response.json()
        const msg = [error.error || 'Unbekannter Fehler', error.details, error.hint].filter(Boolean).join('\n\n')
        alert('Fehler: ' + msg)
      }
    } catch (error) {
      console.error('Fehler beim Speichern:', error)
      alert('Fehler beim Speichern')
    }
  }

  const handleEditConfig = (config: any) => {
    setEditingConfig(config)
    setConfigForm({
      name: config.name,
      type: config.type,
      email: config.email,
      senderName: config.senderName || '',
      appPassword: '',
      password: '',
      smtpHost: config.smtpHost || '',
      smtpPort: config.smtpPort || 587,
      smtpUseStartTls: config.smtpUseStartTls || false,
      imapHost: config.imapHost || '',
      imapPort: config.imapPort || 993,
      mailjetApiKey: config.mailjetApiKey || '',
      mailjetApiSecret: '',
      isActive: config.isActive || false,
    })
  }

  const handleTestConfig = async (configId?: string) => {
    if (!testConfigEmail) {
      alert('Bitte geben Sie eine Test-E-Mail-Adresse ein')
      return
    }

    setTestingConfig(true)
    try {
      const response = await fetch('/api/email-config/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          configId: configId || undefined,
          testEmail: testConfigEmail,
        }),
      })

      const result = await response.json()
      
      if (response.ok) {
        alert('✅ Test-E-Mail erfolgreich gesendet!\n\nDie Email-Konfiguration funktioniert korrekt.')
        setTestConfigEmail('')
      } else {
        const errorMsg = result.error || 'Unbekannter Fehler'
        const detailsMsg = result.details ? `\n\n${result.details}` : ''
        const analysisMsg = result.analysis ? `\n\n--- Analyse / Hinweise ---\n${result.analysis}` : ''
        const techMsg = [result.code, result.responseCode, result.response].filter(Boolean).length
          ? `\n\nTechnisch: ${[result.code && `Code ${result.code}`, result.responseCode && `Response ${result.responseCode}`, result.response].filter(Boolean).join(', ')}`
          : ''
        alert(`❌ ${errorMsg}${detailsMsg}${analysisMsg}${techMsg}`)
      }
    } catch (error) {
      console.error('Fehler beim Testen der Email-Konfiguration:', error)
      alert('Fehler beim Testen der Email-Konfiguration')
    } finally {
      setTestingConfig(false)
    }
  }

  const handleDeleteConfig = async (id: string) => {
    if (!confirm('Möchten Sie diese Email-Konfiguration wirklich löschen?')) {
      return
    }

    try {
      const response = await fetch(`/api/email-config?id=${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        await loadEmailConfigs()
        alert('Email-Konfiguration gelöscht')
      } else {
        const error = await response.json()
        alert('Fehler: ' + (error.error || 'Unbekannter Fehler'))
      }
    } catch (error) {
      console.error('Fehler beim Löschen:', error)
      alert('Fehler beim Löschen')
    }
  }

  const handleDeleteAllConfigs = async () => {
    if (!confirm('Möchten Sie wirklich alle E-Mail-Konfigurationen löschen?')) {
      return
    }
    try {
      const response = await fetch('/api/email-config?all=true', { method: 'DELETE' })
      if (response.ok) {
        const data = await response.json()
        await loadEmailConfigs()
        alert(`Alle E-Mail-Konfigurationen gelöscht (${data.deleted ?? 0} Einträge)`)
      } else {
        const error = await response.json()
        alert('Fehler: ' + (error.error || 'Unbekannter Fehler'))
      }
    } catch (error) {
      console.error('Fehler beim Löschen aller Konfigurationen:', error)
      alert('Fehler beim Löschen')
    }
  }

  // Template-Funktionen
  const handleSaveTemplate = async () => {
    try {
      if (!templateForm.name || !templateForm.subject || !templateForm.body) {
        alert('Name, Betreff und Body sind erforderlich')
        return
      }

      const url = '/api/email-templates'
      const method = editingTemplate ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingTemplate ? { id: editingTemplate.id, ...templateForm } : templateForm),
      })

      if (response.ok) {
        await loadTemplates()
        setTemplateForm({
          name: '',
          language: 'de',
          category: '',
          subject: '',
          body: '',
          plainText: '',
          isDefault: false,
        })
        setEditingTemplate(null)
        alert('Template gespeichert')
      } else {
        const error = await response.json()
        alert('Fehler: ' + (error.error || 'Unbekannter Fehler'))
      }
    } catch (error) {
      console.error('Fehler beim Speichern:', error)
      alert('Fehler beim Speichern')
    }
  }

  const handleEditTemplate = (template: any) => {
    setEditingTemplate(template)
    setTemplateForm({
      name: template.name,
      language: template.language,
      category: template.category ?? '',
      subject: template.subject,
      body: template.body,
      plainText: template.plainText || '',
      isDefault: template.isDefault ?? false,
    })
  }

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('Möchten Sie dieses Template wirklich löschen?')) {
      return
    }

    try {
      const response = await fetch(`/api/email-templates?id=${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        await loadTemplates()
        setSelectedTemplateIds((prev) => prev.filter((x) => x !== id))
        alert('Template gelöscht')
      } else {
        const error = await response.json()
        alert('Fehler: ' + (error.error || 'Unbekannter Fehler'))
      }
    } catch (error) {
      console.error('Fehler beim Löschen:', error)
      alert('Fehler beim Löschen')
    }
  }

  const handleDeleteSelectedTemplates = async () => {
    if (selectedTemplateIds.length === 0) {
      alert('Bitte wählen Sie mindestens ein Template aus.')
      return
    }
    if (!confirm(`Möchten Sie ${selectedTemplateIds.length} Template(s) wirklich löschen?`)) {
      return
    }
    try {
      const response = await fetch(
        `/api/email-templates?ids=${selectedTemplateIds.map(encodeURIComponent).join(',')}`,
        { method: 'DELETE' }
      )
      if (response.ok) {
        await loadTemplates()
        setSelectedTemplateIds([])
        alert(`${selectedTemplateIds.length} Template(s) gelöscht`)
      } else {
        const error = await response.json()
        alert('Fehler: ' + (error.error || 'Unbekannter Fehler'))
      }
    } catch (error) {
      console.error('Fehler beim Löschen:', error)
      alert('Fehler beim Löschen')
    }
  }

  const handleCreateDefaultTemplates = async () => {
    if (!confirm('Möchten Sie Standard-Templates für alle Sprachen erstellen?')) {
      return
    }

    try {
      const defaultTemplates = [
        {
          name: 'Standard Einladung (Deutsch)',
          language: 'de',
          category: '',
          subject: 'Einladung zum Iftar-Essen - {{EVENT_TITLE}}',
          body: `<p>Liebe/r {{GUEST_NAME}},</p>
<p>wir laden Sie herzlich ein zum Iftar-Essen am {{EVENT_DATE}} um {{EVENT_LOCATION}}.</p>
<p>Wir würden uns sehr freuen, Sie bei dieser besonderen Veranstaltung begrüßen zu dürfen.</p>
<p>Bitte bestätigen Sie Ihre Teilnahme:</p>
<p><a href="{{ACCEPT_LINK}}">Zusage</a> | <a href="{{DECLINE_LINK}}">Absage</a></p>
<p>Mit freundlichen Grüßen<br>Ihr Organisationsteam</p>`,
          plainText: `Liebe/r {{GUEST_NAME}},\n\nwir laden Sie herzlich ein zum Iftar-Essen am {{EVENT_DATE}} um {{EVENT_LOCATION}}.\n\nWir würden uns sehr freuen, Sie bei dieser besonderen Veranstaltung begrüßen zu dürfen.\n\nBitte bestätigen Sie Ihre Teilnahme über die Links in der E-Mail.\n\nMit freundlichen Grüßen\nIhr Organisationsteam`,
          isDefault: true,
        },
        {
          name: 'Standard Einladung (Türkisch)',
          language: 'tr',
          category: '',
          subject: 'İftar Yemeği Daveti - {{EVENT_TITLE}}',
          body: `<p>Sayın {{GUEST_NAME}},</p>
<p>{{EVENT_DATE}} tarihinde {{EVENT_LOCATION}} adresinde düzenlenecek İftar Yemeği'ne sizleri davet etmekten mutluluk duyarız.</p>
<p>Bu özel etkinlikte sizleri ağırlamaktan memnuniyet duyarız.</p>
<p>Lütfen katılımınızı onaylayın:</p>
<p><a href="{{ACCEPT_LINK}}">Kabul</a> | <a href="{{DECLINE_LINK}}">Red</a></p>
<p>Saygılarımızla<br>Organizasyon Ekibi</p>`,
          plainText: `Sayın {{GUEST_NAME}},\n\n{{EVENT_DATE}} tarihinde {{EVENT_LOCATION}} adresinde düzenlenecek İftar Yemeği'ne sizleri davet etmekten mutluluk duyarız.\n\nBu özel etkinlikte sizleri ağırlamaktan memnuniyet duyarız.\n\nLütfen katılımınızı onaylayın.\n\nSaygılarımızla\nOrganizasyon Ekibi`,
          isDefault: true,
        },
      ]

      for (const template of defaultTemplates) {
        await fetch('/api/email-templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(template),
        })
      }

      await loadTemplates()
      alert('Standard-Templates erstellt')
    } catch (error) {
      console.error('Fehler beim Erstellen der Standard-Templates:', error)
      alert('Fehler beim Erstellen der Standard-Templates')
    }
  }

  const handleCreate3Templates = async () => {
    if (!confirm('Möchten Sie 3 fertige Templates in 3 Sprachen (Deutsch, Türkisch, Englisch) erstellen?')) {
      return
    }

    try {
      const templates = [
        // Template 1: Formelle Einladung
        {
          name: 'Formelle Einladung (Deutsch)',
          language: 'de',
          category: '',
          subject: 'Offizielle Einladung zum Iftar-Essen - {{EVENT_TITLE}}',
          body: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
<h2 style="color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px;">Offizielle Einladung</h2>
<p>Sehr geehrte/r {{GUEST_NAME}},</p>
<p>wir haben die Ehre, Sie herzlich zum Iftar-Essen einzuladen, das am <strong>{{EVENT_DATE}}</strong> um <strong>{{EVENT_LOCATION}}</strong> stattfindet.</p>
<p>Diese Veranstaltung bietet eine wunderbare Gelegenheit, gemeinsam den heiligen Monat Ramadan zu würdigen und in einer festlichen Atmosphäre zusammenzukommen.</p>
<p>Wir würden uns sehr freuen, Sie als unseren geschätzten Gast begrüßen zu dürfen.</p>
<p><strong>Bitte bestätigen Sie Ihre Teilnahme bis zum angegebenen Datum:</strong></p>
<p style="text-align: center; margin: 30px 0;">
  <a href="{{ACCEPT_LINK}}" style="background-color: #27ae60; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin-right: 10px; display: inline-block;">Zusage</a>
  <a href="{{DECLINE_LINK}}" style="background-color: #e74c3c; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Absage</a>
</p>
<p>Mit freundlichen Grüßen,<br><strong>Ihr Organisationsteam</strong></p>
</div>`,
          plainText: `Sehr geehrte/r {{GUEST_NAME}},\n\nwir haben die Ehre, Sie herzlich zum Iftar-Essen einzuladen, das am {{EVENT_DATE}} um {{EVENT_LOCATION}} stattfindet.\n\nDiese Veranstaltung bietet eine wunderbare Gelegenheit, gemeinsam den heiligen Monat Ramadan zu würdigen und in einer festlichen Atmosphäre zusammenzukommen.\n\nWir würden uns sehr freuen, Sie als unseren geschätzten Gast begrüßen zu dürfen.\n\nBitte bestätigen Sie Ihre Teilnahme über die Links in der E-Mail.\n\nMit freundlichen Grüßen\nIhr Organisationsteam`,
          isDefault: false,
        },
        {
          name: 'Formelle Einladung (Türkisch)',
          language: 'tr',
          category: '',
          subject: 'Resmi İftar Yemeği Daveti - {{EVENT_TITLE}}',
          body: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
<h2 style="color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px;">Resmi Davet</h2>
<p>Sayın {{GUEST_NAME}},</p>
<p>Sizleri, <strong>{{EVENT_DATE}}</strong> tarihinde <strong>{{EVENT_LOCATION}}</strong> adresinde düzenlenecek İftar Yemeği'ne davet etmekten onur duyarız.</p>
<p>Bu etkinlik, kutsal Ramazan ayını birlikte onurlandırmak ve neşeli bir atmosferde bir araya gelmek için harika bir fırsat sunmaktadır.</p>
<p>Değerli misafirimiz olarak sizleri ağırlamaktan mutluluk duyacağız.</p>
<p><strong>Lütfen katılımınızı belirtilen tarihe kadar onaylayın:</strong></p>
<p style="text-align: center; margin: 30px 0;">
  <a href="{{ACCEPT_LINK}}" style="background-color: #27ae60; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin-right: 10px; display: inline-block;">Kabul</a>
  <a href="{{DECLINE_LINK}}" style="background-color: #e74c3c; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Red</a>
</p>
<p>Saygılarımızla,<br><strong>Organizasyon Ekibi</strong></p>
</div>`,
          plainText: `Sayın {{GUEST_NAME}},\n\nSizleri, {{EVENT_DATE}} tarihinde {{EVENT_LOCATION}} adresinde düzenlenecek İftar Yemeği'ne davet etmekten onur duyarız.\n\nBu etkinlik, kutsal Ramazan ayını birlikte onurlandırmak ve neşeli bir atmosferde bir araya gelmek için harika bir fırsat sunmaktadır.\n\nDeğerli misafirimiz olarak sizleri ağırlamaktan mutluluk duyacağız.\n\nLütfen katılımınızı onaylayın.\n\nSaygılarımızla\nOrganizasyon Ekibi`,
          isDefault: false,
        },
        {
          name: 'Formelle Einladung (Englisch)',
          language: 'en',
          category: '',
          subject: 'Official Invitation to Iftar Dinner - {{EVENT_TITLE}}',
          body: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
<h2 style="color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px;">Official Invitation</h2>
<p>Dear {{GUEST_NAME}},</p>
<p>We have the honor to cordially invite you to the Iftar Dinner, which will take place on <strong>{{EVENT_DATE}}</strong> at <strong>{{EVENT_LOCATION}}</strong>.</p>
<p>This event offers a wonderful opportunity to honor the holy month of Ramadan together and come together in a festive atmosphere.</p>
<p>We would be delighted to welcome you as our esteemed guest.</p>
<p><strong>Please confirm your attendance by the specified date:</strong></p>
<p style="text-align: center; margin: 30px 0;">
  <a href="{{ACCEPT_LINK}}" style="background-color: #27ae60; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin-right: 10px; display: inline-block;">Accept</a>
  <a href="{{DECLINE_LINK}}" style="background-color: #e74c3c; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Decline</a>
</p>
<p>Best regards,<br><strong>Your Organization Team</strong></p>
</div>`,
          plainText: `Dear {{GUEST_NAME}},\n\nWe have the honor to cordially invite you to the Iftar Dinner, which will take place on {{EVENT_DATE}} at {{EVENT_LOCATION}}.\n\nThis event offers a wonderful opportunity to honor the holy month of Ramadan together and come together in a festive atmosphere.\n\nWe would be delighted to welcome you as our esteemed guest.\n\nPlease confirm your attendance via the links in this email.\n\nBest regards\nYour Organization Team`,
          isDefault: false,
        },
        // Template 2: Persönliche Einladung
        {
          name: 'Persönliche Einladung (Deutsch)',
          language: 'de',
          category: '',
          subject: 'Herzliche Einladung zum Iftar-Essen - {{EVENT_TITLE}}',
          body: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
<h2 style="color: #e67e22; border-bottom: 2px solid #f39c12; padding-bottom: 10px;">Herzliche Einladung</h2>
<p>Liebe/r {{GUEST_NAME}},</p>
<p>wir möchten Sie ganz herzlich zu unserem Iftar-Essen einladen!</p>
<p>Am <strong>{{EVENT_DATE}}</strong> kommen wir zusammen, um gemeinsam das Fastenbrechen zu feiern und eine schöne Zeit zu verbringen. Die Veranstaltung findet in <strong>{{EVENT_LOCATION}}</strong> statt.</p>
<p>Es wird ein abwechslungsreiches Programm mit leckerem Essen, inspirierenden Gesprächen und einer warmherzigen Gemeinschaft geben.</p>
<p>Wir freuen uns sehr darauf, Sie dabei zu haben und gemeinsam diesen besonderen Moment zu teilen.</p>
<p style="text-align: center; margin: 30px 0;">
  <a href="{{ACCEPT_LINK}}" style="background-color: #27ae60; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin-right: 10px; display: inline-block;">Ja, ich komme gerne!</a>
  <a href="{{DECLINE_LINK}}" style="background-color: #95a5a6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Leider nicht möglich</a>
</p>
<p>Wir freuen uns auf Sie!<br><strong>Ihr Organisationsteam</strong></p>
</div>`,
          plainText: `Liebe/r {{GUEST_NAME}},\n\nwir möchten Sie ganz herzlich zu unserem Iftar-Essen einladen!\n\nAm {{EVENT_DATE}} kommen wir zusammen, um gemeinsam das Fastenbrechen zu feiern und eine schöne Zeit zu verbringen. Die Veranstaltung findet in {{EVENT_LOCATION}} statt.\n\nEs wird ein abwechslungsreiches Programm mit leckerem Essen, inspirierenden Gesprächen und einer warmherzigen Gemeinschaft geben.\n\nWir freuen uns sehr darauf, Sie dabei zu haben und gemeinsam diesen besonderen Moment zu teilen.\n\nBitte bestätigen Sie Ihre Teilnahme über die Links in der E-Mail.\n\nWir freuen uns auf Sie!\nIhr Organisationsteam`,
          isDefault: false,
        },
        {
          name: 'Persönliche Einladung (Türkisch)',
          language: 'tr',
          category: '',
          subject: 'Samimi İftar Yemeği Daveti - {{EVENT_TITLE}}',
          body: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
<h2 style="color: #e67e22; border-bottom: 2px solid #f39c12; padding-bottom: 10px;">Samimi Davet</h2>
<p>Sevgili {{GUEST_NAME}},</p>
<p>Sizleri İftar Yemeğimize çok samimi bir şekilde davet etmek istiyoruz!</p>
<p><strong>{{EVENT_DATE}}</strong> tarihinde birlikte oruç açmak ve güzel bir zaman geçirmek için bir araya geliyoruz. Etkinlik <strong>{{EVENT_LOCATION}}</strong> adresinde gerçekleşecek.</p>
<p>Lezzetli yemekler, ilham verici sohbetler ve sıcak bir toplulukla dolu çeşitli bir program olacak.</p>
<p>Sizleri aramızda görmekten ve bu özel anı birlikte paylaşmaktan çok mutlu olacağız.</p>
<p style="text-align: center; margin: 30px 0;">
  <a href="{{ACCEPT_LINK}}" style="background-color: #27ae60; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin-right: 10px; display: inline-block;">Evet, memnuniyetle gelirim!</a>
  <a href="{{DECLINE_LINK}}" style="background-color: #95a5a6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Maalesef katılamam</a>
</p>
<p>Sizleri görmeyi dört gözle bekliyoruz!<br><strong>Organizasyon Ekibi</strong></p>
</div>`,
          plainText: `Sevgili {{GUEST_NAME}},\n\nSizleri İftar Yemeğimize çok samimi bir şekilde davet etmek istiyoruz!\n\n{{EVENT_DATE}} tarihinde birlikte oruç açmak ve güzel bir zaman geçirmek için bir araya geliyoruz. Etkinlik {{EVENT_LOCATION}} adresinde gerçekleşecek.\n\nLezzetli yemekler, ilham verici sohbetler ve sıcak bir toplulukla dolu çeşitli bir program olacak.\n\nSizleri aramızda görmekten ve bu özel anı birlikte paylaşmaktan çok mutlu olacağız.\n\nLütfen katılımınızı onaylayın.\n\nSizleri görmeyi dört gözle bekliyoruz!\nOrganizasyon Ekibi`,
          isDefault: false,
        },
        {
          name: 'Persönliche Einladung (Englisch)',
          language: 'en',
          category: '',
          subject: 'Warm Invitation to Iftar Dinner - {{EVENT_TITLE}}',
          body: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
<h2 style="color: #e67e22; border-bottom: 2px solid #f39c12; padding-bottom: 10px;">Warm Invitation</h2>
<p>Dear {{GUEST_NAME}},</p>
<p>We would like to warmly invite you to our Iftar Dinner!</p>
<p>On <strong>{{EVENT_DATE}}</strong>, we will come together to break the fast together and spend a wonderful time. The event will take place at <strong>{{EVENT_LOCATION}}</strong>.</p>
<p>There will be a varied program with delicious food, inspiring conversations, and a warm community.</p>
<p>We are very much looking forward to having you with us and sharing this special moment together.</p>
<p style="text-align: center; margin: 30px 0;">
  <a href="{{ACCEPT_LINK}}" style="background-color: #27ae60; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin-right: 10px; display: inline-block;">Yes, I'd love to come!</a>
  <a href="{{DECLINE_LINK}}" style="background-color: #95a5a6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Unfortunately not possible</a>
</p>
<p>We look forward to seeing you!<br><strong>Your Organization Team</strong></p>
</div>`,
          plainText: `Dear {{GUEST_NAME}},\n\nWe would like to warmly invite you to our Iftar Dinner!\n\nOn {{EVENT_DATE}}, we will come together to break the fast together and spend a wonderful time. The event will take place at {{EVENT_LOCATION}}.\n\nThere will be a varied program with delicious food, inspiring conversations, and a warm community.\n\nWe are very much looking forward to having you with us and sharing this special moment together.\n\nPlease confirm your attendance via the links in this email.\n\nWe look forward to seeing you!\nYour Organization Team`,
          isDefault: false,
        },
        // Template 3: VIP Einladung
        {
          name: 'VIP Einladung (Deutsch)',
          language: 'de',
          category: '',
          subject: 'Exklusive VIP-Einladung zum Iftar-Essen - {{EVENT_TITLE}}',
          body: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px; color: white;">
<h2 style="color: #fff; border-bottom: 2px solid rgba(255,255,255,0.3); padding-bottom: 10px;">Exklusive VIP-Einladung</h2>
<p style="font-size: 16px;">Sehr geehrte/r {{GUEST_NAME}},</p>
<p>als geschätzter Partner und wichtiger Gast möchten wir Sie ganz besonders zum Iftar-Essen einladen.</p>
<p>Am <strong style="color: #f1c40f;">{{EVENT_DATE}}</strong> freuen wir uns darauf, Sie in <strong style="color: #f1c40f;">{{EVENT_LOCATION}}</strong> begrüßen zu dürfen.</p>
<p>Diese exklusive Veranstaltung bietet Ihnen:</p>
<ul style="line-height: 1.8;">
  <li>Premium-Gastronomie und kulinarische Köstlichkeiten</li>
  <li>Persönliche Betreuung und VIP-Service</li>
  <li>Inspirierende Gespräche in exklusivem Rahmen</li>
  <li>Ein unvergessliches Erlebnis in festlicher Atmosphäre</li>
</ul>
<p>Ihre Anwesenheit würde unserer Veranstaltung eine besondere Note verleihen.</p>
<p style="text-align: center; margin: 30px 0;">
  <a href="{{ACCEPT_LINK}}" style="background-color: #27ae60; color: white; padding: 15px 35px; text-decoration: none; border-radius: 5px; margin-right: 10px; display: inline-block; font-weight: bold;">Mit Freude annehmen</a>
  <a href="{{DECLINE_LINK}}" style="background-color: rgba(255,255,255,0.2); color: white; padding: 15px 35px; text-decoration: none; border-radius: 5px; display: inline-block;">Absagen</a>
</p>
<p>Mit höchster Wertschätzung,<br><strong>Ihr Organisationsteam</strong></p>
</div>`,
          plainText: `Sehr geehrte/r {{GUEST_NAME}},\n\nals geschätzter Partner und wichtiger Gast möchten wir Sie ganz besonders zum Iftar-Essen einladen.\n\nAm {{EVENT_DATE}} freuen wir uns darauf, Sie in {{EVENT_LOCATION}} begrüßen zu dürfen.\n\nDiese exklusive Veranstaltung bietet Ihnen:\n- Premium-Gastronomie und kulinarische Köstlichkeiten\n- Persönliche Betreuung und VIP-Service\n- Inspirierende Gespräche in exklusivem Rahmen\n- Ein unvergessliches Erlebnis in festlicher Atmosphäre\n\nIhre Anwesenheit würde unserer Veranstaltung eine besondere Note verleihen.\n\nBitte bestätigen Sie Ihre Teilnahme über die Links in der E-Mail.\n\nMit höchster Wertschätzung\nIhr Organisationsteam`,
          isDefault: false,
        },
        {
          name: 'VIP Einladung (Türkisch)',
          language: 'tr',
          category: '',
          subject: 'Özel VIP İftar Yemeği Daveti - {{EVENT_TITLE}}',
          body: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px; color: white;">
<h2 style="color: #fff; border-bottom: 2px solid rgba(255,255,255,0.3); padding-bottom: 10px;">Özel VIP Daveti</h2>
<p style="font-size: 16px;">Sayın {{GUEST_NAME}},</p>
<p>Değerli bir ortak ve önemli bir misafir olarak sizleri İftar Yemeği'ne özellikle davet etmek istiyoruz.</p>
<p><strong style="color: #f1c40f;">{{EVENT_DATE}}</strong> tarihinde sizleri <strong style="color: #f1c40f;">{{EVENT_LOCATION}}</strong> adresinde ağırlamaktan mutluluk duyacağız.</p>
<p>Bu özel etkinlik size şunları sunmaktadır:</p>
<ul style="line-height: 1.8;">
  <li>Premium gastronomi ve mutfak lezzetleri</li>
  <li>Kişisel hizmet ve VIP servis</li>
  <li>Özel bir ortamda ilham verici sohbetler</li>
  <li>Festival atmosferinde unutulmaz bir deneyim</li>
</ul>
<p>Varlığınız etkinliğimize özel bir değer katacaktır.</p>
<p style="text-align: center; margin: 30px 0;">
  <a href="{{ACCEPT_LINK}}" style="background-color: #27ae60; color: white; padding: 15px 35px; text-decoration: none; border-radius: 5px; margin-right: 10px; display: inline-block; font-weight: bold;">Memnuniyetle Kabul Ediyorum</a>
  <a href="{{DECLINE_LINK}}" style="background-color: rgba(255,255,255,0.2); color: white; padding: 15px 35px; text-decoration: none; border-radius: 5px; display: inline-block;">Reddet</a>
</p>
<p>En yüksek saygılarımızla,<br><strong>Organizasyon Ekibi</strong></p>
</div>`,
          plainText: `Sayın {{GUEST_NAME}},\n\nDeğerli bir ortak ve önemli bir misafir olarak sizleri İftar Yemeği'ne özellikle davet etmek istiyoruz.\n\n{{EVENT_DATE}} tarihinde sizleri {{EVENT_LOCATION}} adresinde ağırlamaktan mutluluk duyacağız.\n\nBu özel etkinlik size şunları sunmaktadır:\n- Premium gastronomi ve mutfak lezzetleri\n- Kişisel hizmet ve VIP servis\n- Özel bir ortamda ilham verici sohbetler\n- Festival atmosferinde unutulmaz bir deneyim\n\nVarlığınız etkinliğimize özel bir değer katacaktır.\n\nLütfen katılımınızı onaylayın.\n\nEn yüksek saygılarımızla\nOrganizasyon Ekibi`,
          isDefault: false,
        },
        {
          name: 'VIP Einladung (Englisch)',
          language: 'en',
          category: '',
          subject: 'Exclusive VIP Invitation to Iftar Dinner - {{EVENT_TITLE}}',
          body: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px; color: white;">
<h2 style="color: #fff; border-bottom: 2px solid rgba(255,255,255,0.3); padding-bottom: 10px;">Exclusive VIP Invitation</h2>
<p style="font-size: 16px;">Dear {{GUEST_NAME}},</p>
<p>As a valued partner and important guest, we would like to especially invite you to the Iftar Dinner.</p>
<p>On <strong style="color: #f1c40f;">{{EVENT_DATE}}</strong>, we look forward to welcoming you at <strong style="color: #f1c40f;">{{EVENT_LOCATION}}</strong>.</p>
<p>This exclusive event offers you:</p>
<ul style="line-height: 1.8;">
  <li>Premium gastronomy and culinary delights</li>
  <li>Personal care and VIP service</li>
  <li>Inspiring conversations in an exclusive setting</li>
  <li>An unforgettable experience in a festive atmosphere</li>
</ul>
<p>Your presence would add a special touch to our event.</p>
<p style="text-align: center; margin: 30px 0;">
  <a href="{{ACCEPT_LINK}}" style="background-color: #27ae60; color: white; padding: 15px 35px; text-decoration: none; border-radius: 5px; margin-right: 10px; display: inline-block; font-weight: bold;">Accept with Pleasure</a>
  <a href="{{DECLINE_LINK}}" style="background-color: rgba(255,255,255,0.2); color: white; padding: 15px 35px; text-decoration: none; border-radius: 5px; display: inline-block;">Decline</a>
</p>
<p>With highest appreciation,<br><strong>Your Organization Team</strong></p>
</div>`,
          plainText: `Dear {{GUEST_NAME}},\n\nAs a valued partner and important guest, we would like to especially invite you to the Iftar Dinner.\n\nOn {{EVENT_DATE}}, we look forward to welcoming you at {{EVENT_LOCATION}}.\n\nThis exclusive event offers you:\n- Premium gastronomy and culinary delights\n- Personal care and VIP service\n- Inspiring conversations in an exclusive setting\n- An unforgettable experience in a festive atmosphere\n\nYour presence would add a special touch to our event.\n\nPlease confirm your attendance via the links in this email.\n\nWith highest appreciation\nYour Organization Team`,
          isDefault: false,
        },
      ]

      let created = 0
      let errors = 0

      for (const template of templates) {
        try {
          const response = await fetch('/api/email-templates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(template),
          })
          if (response.ok) {
            created++
          } else {
            errors++
          }
        } catch (error) {
          console.error('Fehler beim Erstellen des Templates:', template.name, error)
          errors++
        }
      }

      await loadTemplates()
      alert(`✅ ${created} Templates erfolgreich erstellt${errors > 0 ? `\n⚠️ ${errors} Fehler` : ''}`)
    } catch (error) {
      console.error('Fehler beim Erstellen der Templates:', error)
      alert('Fehler beim Erstellen der Templates')
    }
  }

  /** Pro Kategorie aus der Gästeliste je ein Template in DE, TR, EN anlegen (Kategorie kann in Gästeliste TR oder DE geschrieben sein). */
  const handleCreateTemplatesPerCategory = async () => {
    if (!confirm('Für jede Kategorie (Protokoll, Gästeliste, Diplomatik, Medien, VIP, …) werden 3 Templates (Deutsch, Türkisch, Englisch) erstellt. Fortfahren?')) {
      return
    }
    const keys = getKnownCategoryKeys()
    const baseBody = `<p>Liebe/r {{GUEST_NAME}},</p>
<p>wir laden Sie herzlich ein zum Iftar-Essen am {{EVENT_DATE}} um {{EVENT_LOCATION}}.</p>
<p>Bitte bestätigen Sie Ihre Teilnahme:</p>
<p><a href="{{ACCEPT_LINK}}">Zusage</a> | <a href="{{DECLINE_LINK}}">Absage</a></p>
<p>Mit freundlichen Grüßen<br>Ihr Organisationsteam</p>`
    const baseBodyTr = `<p>Sayın {{GUEST_NAME}},</p>
<p>{{EVENT_DATE}} tarihinde {{EVENT_LOCATION}} adresinde düzenlenecek İftar Yemeği'ne sizleri davet etmekten mutluluk duyarız.</p>
<p>Lütfen katılımınızı onaylayın:</p>
<p><a href="{{ACCEPT_LINK}}">Kabul</a> | <a href="{{DECLINE_LINK}}">Red</a></p>
<p>Saygılarımızla<br>Organizasyon Ekibi</p>`
    const baseBodyEn = `<p>Dear {{GUEST_NAME}},</p>
<p>We cordially invite you to the Iftar dinner on {{EVENT_DATE}} at {{EVENT_LOCATION}}.</p>
<p>Please confirm your attendance:</p>
<p><a href="{{ACCEPT_LINK}}">Accept</a> | <a href="{{DECLINE_LINK}}">Decline</a></p>
<p>Best regards<br>Your Organization Team</p>`
    let created = 0
    let errors = 0
    try {
      for (const key of keys) {
        const labelDe = getCategoryLabel(key, 'de')
        const labelTr = getCategoryLabel(key, 'tr')
        const labelEn = getCategoryLabel(key, 'en')
        const templates = [
          { name: `Einladung ${labelDe} (DE)`, language: 'de', category: key, subject: `Einladung - ${labelDe} - {{EVENT_TITLE}}`, body: baseBody, plainText: '', isDefault: true },
          { name: `Einladung ${labelTr} (TR)`, language: 'tr', category: key, subject: `Davet - ${labelTr} - {{EVENT_TITLE}}`, body: baseBodyTr, plainText: '', isDefault: true },
          { name: `Einladung ${labelEn} (EN)`, language: 'en', category: key, subject: `Invitation - ${labelEn} - {{EVENT_TITLE}}`, body: baseBodyEn, plainText: '', isDefault: true },
        ]
        for (const t of templates) {
          try {
            const res = await fetch('/api/email-templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(t) })
            if (res.ok) created++
            else errors++
          } catch {
            errors++
          }
        }
      }
      await loadTemplates()
      alert(`✅ ${created} Templates pro Kategorie erstellt${errors > 0 ? `\n⚠️ ${errors} Fehler` : ''}`)
    } catch (error) {
      console.error('Fehler beim Erstellen der Templates pro Kategorie:', error)
      alert('Fehler beim Erstellen der Templates pro Kategorie')
    }
  }

  const handleSendTestEmail = async () => {
    if (!testEmailForm.email || !testEmailForm.templateId) {
      alert('Bitte geben Sie eine E-Mail-Adresse ein und wählen Sie ein Template aus')
      return
    }

    // Lade Event, falls nicht vorhanden
    let currentEventId = eventId
    if (!currentEventId) {
      try {
        const projectId = typeof window !== 'undefined' ? localStorage.getItem('dashboard-project-id') : null
        const eventsUrl = projectId ? `/api/events?projectId=${encodeURIComponent(projectId)}` : '/api/events'
        const eventsRes = await fetchAuth(eventsUrl)
        if (!eventsRes.ok) {
          throw new Error('Fehler beim Laden der Events')
        }
        const eventData = await eventsRes.json()
        const event = Array.isArray(eventData) ? (eventData.length > 0 ? eventData[0] : null) : eventData
        if (!event?.id) {
          alert('Kein Event gefunden. Bitte wählen Sie ein Projekt auf dem Dashboard.')
          return
        }
        currentEventId = event.id
        setEventId(currentEventId)
      } catch (error) {
        console.error('Fehler beim Laden der Events:', error)
        alert('Fehler beim Laden der Events. Bitte versuchen Sie es erneut.')
        return
      }
    }

    setSendingTestEmail(true)
    try {
      // Erstelle AbortController für Timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 Sekunden Timeout
      
      const response = await fetch('/api/invitations/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testEmailForm.email,
          templateId: testEmailForm.templateId,
          eventId: currentEventId,
          includeLinks: testEmailForm.includeLinks,
        }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)
      const result = await response.json()
      
      if (response.ok) {
        alert('✅ Test-E-Mail erfolgreich gesendet!')
        setTestEmailForm({
          email: '',
          templateId: '',
          includeLinks: true,
        })
      } else {
        const errorMsg = result.error || 'Unbekannter Fehler'
        const detailsMsg = result.details ? `\n\nDetails: ${result.details}` : ''
        alert(`❌ Fehler: ${errorMsg}${detailsMsg}`)
      }
    } catch (error) {
      console.error('Fehler beim Senden der Test-E-Mail:', error)
      
      let errorMessage = 'Fehler beim Senden der Test-E-Mail'
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errorMessage = 'Zeitüberschreitung: Die Anfrage hat zu lange gedauert. Bitte versuchen Sie es erneut oder überprüfen Sie Ihre Internetverbindung.'
        } else if (error.message.includes('Failed to fetch') || error.message.includes('ERR_NETWORK')) {
          errorMessage = 'Netzwerkfehler: Verbindung zum Server fehlgeschlagen. Bitte überprüfen Sie Ihre Internetverbindung und versuchen Sie es erneut.'
        } else {
          errorMessage = `Fehler: ${error.message}`
        }
      }
      
      alert(`❌ ${errorMessage}`)
    } finally {
      setSendingTestEmail(false)
    }
  }

  const SEND_BATCH_SIZE = 25
  const BATCH_DELAY_MS = 2000

  const handleSendInvitations = async () => {
    if (selectedGuests.length === 0) {
      alert('Bitte wählen Sie mindestens einen Gast aus')
      return
    }

    if (!selectedTemplate && !selectedLanguage) {
      alert('Bitte wählen Sie ein Template oder eine Sprache aus')
      return
    }

    if (!eventId) {
      alert('Kein Event ausgewählt')
      return
    }

    setSending(true)
    try {
      const batches: string[][] = []
      for (let i = 0; i < selectedGuests.length; i += SEND_BATCH_SIZE) {
        batches.push(selectedGuests.slice(i, i + SEND_BATCH_SIZE))
      }

      let totalSuccessful = 0
      let totalFailed = 0
      let lastError = ''

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i]
        const response = await fetch('/api/invitations/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            guestIds: batch,
            templateId: selectedTemplate || null,
            language: selectedLanguage,
            eventId,
          }),
        })

        const result = await response.json()

        if (response.ok) {
          totalSuccessful += result.successful ?? 0
          totalFailed += result.failed ?? 0
          if (result.results?.some((r: any) => !r.success)) {
            lastError = result.results.find((r: any) => !r.success)?.error || ''
          }
        } else {
          totalFailed += batch.length
          lastError = result.error || 'Unbekannter Fehler'
          if (batches.length > 1) {
            const proceed = window.confirm(
              `Fehler bei Batch ${i + 1}/${batches.length}: ${lastError}\n\nWeiter mit dem nächsten Batch?`
            )
            if (!proceed) break
          } else {
            alert('Fehler: ' + lastError)
            break
          }
        }

        if (i < batches.length - 1) {
          await new Promise((r) => setTimeout(r, BATCH_DELAY_MS))
        }
      }

      if (totalSuccessful > 0 || totalFailed > 0) {
        alert(
          `Einladungen gesendet: ${totalSuccessful} erfolgreich, ${totalFailed} fehlgeschlagen` +
            (lastError && totalFailed > 0 ? `\n\nLetzter Fehler: ${lastError}` : '')
        )
        setSelectedGuests([])
        await loadInvitations(eventId)
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('email-sent-update', Date.now().toString())
          window.dispatchEvent(new Event('email-sent'))
        }
      }
    } catch (error) {
      console.error('Fehler beim Senden:', error)
      alert('Fehler beim Senden der Einladungen')
    } finally {
      setSending(false)
    }
  }

  const handleCellEdit = (invitationId: string, field: string, currentValue: any) => {
    setEditingCell({ invitationId, field })
    // Formatiere Wert für Input
    if (field === 'sentAt' || field === 'openedAt' || field === 'respondedAt') {
      if (currentValue) {
        const date = new Date(currentValue)
        setEditingValue(date.toISOString().slice(0, 16)) // datetime-local Format
      } else {
        setEditingValue('')
      }
    } else if (field === 'response') {
      setEditingValue(currentValue || 'PENDING')
    } else {
      setEditingValue(String(currentValue ?? ''))
    }
  }

  const renderEditableInput = (invitationId: string, field: string, isText = true) => (
    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
      {isText ? (
        <input
          type="text"
          value={editingValue}
          onChange={(e) => setEditingValue(e.target.value)}
          onBlur={() => (field.startsWith('guest') ? handleGuestFieldSave(invitationId, field) : handleCellSave(invitationId, field))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              field.startsWith('guest') ? handleGuestFieldSave(invitationId, field) : handleCellSave(invitationId, field)
            } else if (e.key === 'Escape') {
              handleCellCancel()
            }
          }}
          className="min-w-[120px] rounded border border-indigo-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          autoFocus
        />
      ) : (
        <input
          type="email"
          value={editingValue}
          onChange={(e) => setEditingValue(e.target.value)}
          onBlur={() => handleGuestFieldSave(invitationId, field)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleGuestFieldSave(invitationId, field)
            else if (e.key === 'Escape') handleCellCancel()
          }}
          className="min-w-[180px] rounded border border-indigo-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          autoFocus
        />
      )}
      <button type="button" onClick={() => (field.startsWith('guest') ? handleGuestFieldSave(invitationId, field) : handleCellSave(invitationId, field))} className="text-green-600 hover:text-green-700">✓</button>
      <button type="button" onClick={handleCellCancel} className="text-red-600 hover:text-red-700">✕</button>
    </div>
  )

  const handleCellSave = async (invitationId: string, field: string) => {
    try {
      const updateData: any = { id: invitationId }
      
      if (field === 'sentAt' || field === 'openedAt' || field === 'respondedAt') {
        updateData[field] = editingValue ? editingValue : null
      } else if (field === 'response') {
        updateData[field] = editingValue || 'PENDING'
      }

      const response = await fetch('/api/invitations/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      })

      if (response.ok) {
        const updated = await response.json()
        // Aktualisiere lokalen State
        setInvitations(invitations.map(inv => 
          inv.id === invitationId ? updated : inv
        ))
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

  const handleGuestFieldSave = async (invitationId: string, field: string) => {
    const invitation = invitations.find((inv) => inv.id === invitationId)
    if (!invitation?.guestId || !invitation?.guest) return
    const guestId = invitation.guestId
    try {
      let body: Record<string, unknown> = { id: guestId }
      if (field === 'guestName') {
        body.name = editingValue.trim() || invitation.guest.name
      } else if (field === 'guestVorname') {
        const ad = parseAdditionalData(invitation.guest)
        body.additionalData = JSON.stringify({ ...ad, Vorname: editingValue.trim() })
      } else if (field === 'guestStaatInstitution') {
        body.organization = editingValue.trim() || null
      } else if (field === 'guestAnrede2') {
        const ad = parseAdditionalData(invitation.guest)
        body.additionalData = JSON.stringify({ ...ad, 'Anrede 2': editingValue.trim() })
      } else if (field === 'guestEmail') {
        body.email = editingValue.trim() || null
      } else if (field === 'guestPhone') {
        const phoneVal = editingValue.trim() || null
        body.phone = phoneVal
        // Auch additionalData.Telefon aktualisieren für Gästeliste-Sync
        const ad = parseAdditionalData(invitation.guest)
        body.additionalData = JSON.stringify({ ...ad, Telefon: phoneVal })
      } else if (field === 'guestNachname') {
        const ad = parseAdditionalData(invitation.guest)
        body.additionalData = JSON.stringify({ ...ad, Nachname: editingValue.trim() })
      } else if (field === 'guestBemerkungen') {
        body.notes = editingValue.trim() || null
      }
      const response = await fetch('/api/guests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (response.ok) {
        const updatedGuest = await response.json()
        setInvitations(invitations.map((inv) =>
          inv.id === invitationId ? { ...inv, guest: updatedGuest } : inv
        ))
        setGuests(guests.map((g) => (g.id === guestId ? updatedGuest : g)))
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

  const handleCheckboxChange = async (invitationId: string, field: string, checked: boolean) => {
    try {
      const updateData: any = { id: invitationId }
      
      if (field === 'sentByPost') {
        updateData.sentByPost = checked
        // Wenn per Post gesendet, setze sentAt auf jetzt
        if (checked) {
          updateData.sentAt = new Date().toISOString()
        }
      } else if (field === 'nimmtTeil') {
        updateData.response = checked ? 'ACCEPTED' : 'PENDING'
        updateData.respondedAt = checked ? new Date().toISOString() : null
        // Stelle sicher, dass "Abgesagt" zurückgesetzt wird
        if (checked) {
          // response wird bereits auf ACCEPTED gesetzt, das reicht
        }
      } else if (field === 'abgesagt') {
        updateData.response = checked ? 'DECLINED' : 'PENDING'
        updateData.respondedAt = checked ? new Date().toISOString() : null
        // Stelle sicher, dass "Nimmt Teil" zurückgesetzt wird
        if (checked) {
          // response wird bereits auf DECLINED gesetzt, das reicht
        }
      } else if (field === 'whatsappSentAt') {
        updateData.whatsappSentAt = checked ? new Date().toISOString() : null
      }

      const response = await fetch('/api/invitations/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      })

      if (response.ok) {
        const updated = await response.json()
        setInvitations(invitations.map(inv => 
          inv.id === invitationId ? updated : inv
        ))
      } else {
        const error = await response.json()
        alert('Fehler beim Speichern: ' + (error.error || 'Unbekannter Fehler'))
      }
    } catch (error) {
      console.error('Fehler beim Speichern:', error)
      alert('Fehler beim Speichern')
    }
  }

  const handleVipChange = async (guestId: string, checked: boolean) => {
    try {
      const response = await fetch('/api/guests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: guestId, isVip: checked }),
      })

      if (response.ok) {
        const updated = await response.json()
        // Aktualisiere lokalen State
        setInvitations(invitations.map(inv => 
          inv.guestId === guestId ? { ...inv, guest: updated } : inv
        ))
        // Aktualisiere auch guests State falls vorhanden
        setGuests(guests.map(g => g.id === guestId ? updated : g))
      } else {
        const error = await response.json()
        alert('Fehler beim Speichern: ' + (error.error || 'Unbekannter Fehler'))
      }
    } catch (error) {
      console.error('Fehler beim Speichern:', error)
      alert('Fehler beim Speichern')
    }
  }

  const handleDeleteGuest = async (guestId: string, guestName?: string) => {
    if (!confirm(`Gast "${guestName || 'unbekannt'}" und zugehörige Einladung wirklich löschen?`)) return
    try {
      const response = await fetch(`/api/guests?id=${encodeURIComponent(guestId)}`, { method: 'DELETE' })
      if (response.ok) {
        setInvitations(invitations.filter((inv) => inv.guestId !== guestId))
        setGuests(guests.filter((g) => g.id !== guestId))
        setSelectedInvitations((prev) => prev.filter((id) => invitations.find((inv) => inv.id === id)?.guestId !== guestId))
      } else {
        const err = await response.json()
        alert('Fehler beim Löschen: ' + (err.error || 'Unbekannter Fehler'))
      }
    } catch (error) {
      console.error('Fehler beim Löschen:', error)
      alert('Fehler beim Löschen')
    }
  }

  const handleWhatsAppAccepted = async (invitation: any) => {
    const guestPhone = getGuestDisplayPhone(invitation.guest)
    if (!guestPhone) {
      alert('Keine Telefonnummer hinterlegt.')
      return
    }
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
    const qrPdfUrl = invitation.acceptToken
      ? `${baseUrl}/api/invitations/accept/${encodeURIComponent(invitation.acceptToken)}/qr-pdf`
      : ''
    if (!qrPdfUrl) {
      alert('QR-Code-Link nicht verfügbar.')
      return
    }
    setVerifyingQrId(invitation.id)
    try {
      const res = await fetchAuth(qrPdfUrl)
      if (res.ok) {
        const waUrl = `https://wa.me/${phoneForWhatsApp(guestPhone)}?text=${encodeURIComponent(getWhatsAppMessage(qrPdfUrl, true))}`
        window.open(waUrl, '_blank')
      } else {
        const regenerate = confirm(
          'QR-Code-Link funktioniert nicht (404). Neuen QR-Code erzeugen und per WhatsApp senden?'
        )
        if (regenerate) {
          const regRes = await fetchAuth('/api/invitations/regenerate-qr', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ invitationId: invitation.id }),
          })
          if (regRes.ok) {
            const updated = await regRes.json()
            setInvitations((prev) => prev.map((inv) => (inv.id === invitation.id ? updated : inv)))
            const newQrPdfUrl = `${baseUrl}/api/invitations/accept/${encodeURIComponent(updated.acceptToken)}/qr-pdf`
            const waUrl = `https://wa.me/${phoneForWhatsApp(guestPhone)}?text=${encodeURIComponent(getWhatsAppMessage(newQrPdfUrl, true))}`
            window.open(waUrl, '_blank')
          } else {
            const err = await regRes.json()
            alert('Fehler beim Erzeugen: ' + (err.error || 'Unbekannter Fehler'))
          }
        }
      }
    } catch {
      const regenerate = confirm(
        'Link-Prüfung fehlgeschlagen. Neuen QR-Code erzeugen und per WhatsApp senden?'
      )
      if (regenerate) {
        try {
          const regRes = await fetchAuth('/api/invitations/regenerate-qr', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ invitationId: invitation.id }),
          })
          if (regRes.ok) {
            const updated = await regRes.json()
            setInvitations((prev) => prev.map((inv) => (inv.id === invitation.id ? updated : inv)))
            const newQrPdfUrl = `${baseUrl}/api/invitations/accept/${encodeURIComponent(updated.acceptToken)}/qr-pdf`
            const waUrl = `https://wa.me/${phoneForWhatsApp(guestPhone)}?text=${encodeURIComponent(getWhatsAppMessage(newQrPdfUrl, true))}`
            window.open(waUrl, '_blank')
          } else {
            const err = await regRes.json()
            alert('Fehler beim Erzeugen: ' + (err.error || 'Unbekannter Fehler'))
          }
        } catch (e) {
          alert('Fehler beim Erzeugen des QR-Codes')
        }
      }
    } finally {
      setVerifyingQrId(null)
    }
  }

  const handleQrErstellenUndWaSenden = async (invitation: any) => {
    const guestPhone = getGuestDisplayPhone(invitation.guest)
    if (!guestPhone) {
      alert('Keine Telefonnummer hinterlegt. Bitte zuerst Telefonnummer eintragen.')
      return
    }
    setAcceptingOnBehalfId(invitation.id)
    try {
      const res = await fetchAuth('/api/invitations/accept-on-behalf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invitationId: invitation.id }),
      })
      if (res.ok) {
        const updated = await res.json()
        setInvitations((prev) => prev.map((inv) => (inv.id === invitation.id ? updated : inv)))
        const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
        const qrPdfUrl = `${baseUrl}/api/invitations/accept/${encodeURIComponent(updated.acceptToken)}/qr-pdf`
        const waUrl = `https://wa.me/${phoneForWhatsApp(guestPhone)}?text=${encodeURIComponent(getWhatsAppMessage(qrPdfUrl, true))}`
        window.open(waUrl, '_blank')
      } else {
        const err = await res.json()
        alert('Fehler: ' + (err.error || 'Unbekannter Fehler'))
      }
    } catch (error) {
      console.error('Fehler:', error)
      alert('Fehler beim Erstellen des QR-Codes')
    } finally {
      setAcceptingOnBehalfId(null)
    }
  }

  const handleRegenerateQr = async (invitationId: string) => {
    if (!confirm('Neuen QR-Code generieren? Der alte Link/QR-Code funktioniert danach nicht mehr.')) return
    setRegeneratingQrId(invitationId)
    try {
      const res = await fetchAuth('/api/invitations/regenerate-qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invitationId }),
      })
      if (res.ok) {
        const updated = await res.json()
        setInvitations((prev) => prev.map((inv) => (inv.id === invitationId ? updated : inv)))
      } else {
        const err = await res.json()
        alert('Fehler: ' + (err.error || 'Unbekannter Fehler'))
      }
    } catch (error) {
      console.error('Fehler beim Regenerieren:', error)
      alert('Fehler beim Regenerieren des QR-Codes')
    } finally {
      setRegeneratingQrId(null)
    }
  }

  const handleBulkDeleteGuests = async () => {
    if (selectedInvitations.length === 0 || !eventId) return
    const guestIds = [...new Set(selectedInvitations.map((id) => invitations.find((inv) => inv.id === id)?.guestId).filter(Boolean) as string[])]
    if (guestIds.length === 0) return
    if (!confirm(`Wirklich ${guestIds.length} Gast/Gäste und zugehörige Einladungen löschen?`)) return
    try {
      let failed = 0
      for (const gid of guestIds) {
        const res = await fetch(`/api/guests?id=${encodeURIComponent(gid)}`, { method: 'DELETE' })
        if (!res.ok) failed++
      }
      if (failed > 0) {
        alert(`${guestIds.length - failed} gelöscht, ${failed} fehlgeschlagen.`)
      }
      setSelectedInvitations([])
      await loadInvitations(eventId)
      setGuests(guests.filter((g) => !guestIds.includes(g.id)))
    } catch (error) {
      console.error('Fehler beim Löschen:', error)
      alert('Fehler beim Löschen')
    }
  }

  const handleTemplateChange = async (invitationId: string, templateId: string | null) => {
    try {
      const response = await fetch('/api/invitations/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: invitationId, templateId: templateId || null }),
      })
      if (response.ok) {
        const updated = await response.json()
        setInvitations(invitations.map((inv) => (inv.id === invitationId ? updated : inv)))
      } else {
        const err = await response.json()
        alert('Fehler: ' + (err.error || 'Unbekannter Fehler'))
      }
    } catch (error) {
      console.error('Fehler beim Zuweisen des Templates:', error)
      alert('Fehler beim Speichern')
    }
  }

  const handleShowPreview = async (invitation: any) => {
    const tid = invitation.templateId || invitation.template?.id
    if (!tid) {
      alert('Bitte weisen Sie diesem Gast zuerst ein Template zu.')
      return
    }
    setLoadingPreview(true)
    setPreviewModal(null)
    try {
      const res = await fetch(
        `/api/invitations/preview?invitationId=${encodeURIComponent(invitation.id)}&templateId=${encodeURIComponent(tid)}`
      )
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || 'Vorschau konnte nicht geladen werden.')
        return
      }
      setPreviewModal({
        guestName: data.guestName || invitation.guest?.name || 'Gast',
        subject: data.subject || '',
        body: data.body || '',
      })
    } catch (error) {
      console.error('Fehler beim Laden der Vorschau:', error)
      alert('Fehler beim Laden der Vorschau')
    } finally {
      setLoadingPreview(false)
    }
  }

  const handleCellCancel = () => {
    setEditingCell(null)
    setEditingValue('')
  }

  const getResponseStats = () => {
    const accepted = invitations.filter(i => i.response === 'ACCEPTED').length
    const declined = invitations.filter(i => i.response === 'DECLINED').length
    const pending = invitations.filter(i => i.response === 'PENDING' || !i.response).length
    const opened = invitations.filter(i => i.openedAt).length
    const sent = invitations.filter(i => i.sentAt).length
    const sentRead = invitations.filter(i => i.sentAt && i.openedAt).length
    const sentNotRead = invitations.filter(i => i.sentAt && !i.openedAt).length
    const openedAccepted = invitations.filter(i => i.openedAt && i.response === 'ACCEPTED').length
    const openedDeclined = invitations.filter(i => i.openedAt && i.response === 'DECLINED').length
    return { accepted, declined, pending, opened, sent, sentRead, sentNotRead, openedAccepted, openedDeclined, total: invitations.length }
  }

  const stats = getResponseStats()

  const statsFilteredList = useMemo(() => {
    if (!statsListFilter) return []
    switch (statsListFilter) {
      case 'sent': return invitations.filter(i => i.sentAt)
      case 'sentRead': return invitations.filter(i => i.sentAt && i.openedAt)
      case 'sentNotRead': return invitations.filter(i => i.sentAt && !i.openedAt)
      case 'openedAccepted': return invitations.filter(i => i.openedAt && i.response === 'ACCEPTED')
      case 'openedDeclined': return invitations.filter(i => i.openedAt && i.response === 'DECLINED')
      case 'total': return invitations
      default: return []
    }
  }, [invitations, statsListFilter])

  const statsListTitle = useMemo(() => {
    switch (statsListFilter) {
      case 'sent': return 'Gesamt versendet'
      case 'sentRead': return 'Von versendet gelesen'
      case 'sentNotRead': return 'Von versendet nicht gelesen'
      case 'openedAccepted': return 'Von gelesen: Zusagen'
      case 'openedDeclined': return 'Von gelesen: Absagen'
      case 'total': return 'Gesamt'
      default: return ''
    }
  }, [statsListFilter])

  const handleSaveAsPdf = async () => {
    if (statsFilteredList.length === 0) return
    try {
      const pdfDoc = await PDFDocument.create()
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
      let page = pdfDoc.addPage([595.28, 841.89])
      const marginX = 40
      const marginY = 40
      let y = 841.89 - marginY

      page.drawText(sanitizePdfText(statsListTitle), {
        x: marginX,
        y,
        size: 16,
        font: fontBold,
        color: rgb(0, 0, 0),
      })
      y -= 20

      page.drawText(sanitizePdfText(`Stand: ${new Date().toLocaleDateString('de-DE')} ${new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} | ${statsFilteredList.length} Einträge`), {
        x: marginX,
        y,
        size: 9,
        font,
        color: rgb(0.4, 0.4, 0.4),
      })
      y -= 24

      const colWidths = [40, 70, 90, 120, 150, 90]
      const headers = ['Nr', 'Vorname', 'Name', 'Staat/Institution', 'E-Mail', 'Versand']
      const totalWidth = colWidths.reduce((a, b) => a + b, 0)
      const rowHeight = 14

      page.drawRectangle({
        x: marginX,
        y: y - rowHeight,
        width: totalWidth,
        height: rowHeight,
        color: rgb(0.92, 0.92, 0.92),
        borderColor: rgb(0.5, 0.5, 0.5),
        borderWidth: 0.5,
      })
      let x = marginX + 4
      for (let i = 0; i < headers.length; i++) {
        page.drawText(sanitizePdfText(headers[i]).slice(0, 25), { x, y: y - 10, size: 8, font: fontBold, color: rgb(0, 0, 0), maxWidth: colWidths[i] - 6 })
        x += colWidths[i]
      }
      y -= rowHeight + 4

      for (let idx = 0; idx < statsFilteredList.length; idx++) {
        if (y < marginY + rowHeight) {
          page = pdfDoc.addPage([595.28, 841.89])
          y = 841.89 - marginY
        }
        const inv = statsFilteredList[idx]
        const vorname = getGuestVorname(inv.guest)
        const nachname = getGuestNachname(inv.guest) || inv.guest?.name || '–'
        const staatInstitution = getGuestStaatInstitution(inv.guest) || '–'
        const email = getGuestDisplayEmail(inv.guest) || '–'
        const sentStr = inv.sentAt ? new Date(inv.sentAt).toLocaleString('de-DE') : '–'

        const row = [String(idx + 1), vorname, nachname, staatInstitution, email, sentStr]
        x = marginX + 4
        for (let i = 0; i < row.length; i++) {
          page.drawText(sanitizePdfText(row[i]).slice(0, 35), { x, y: y - 10, size: 8, font, color: rgb(0, 0, 0), maxWidth: colWidths[i] - 6 })
          x += colWidths[i]
        }
        y -= rowHeight
      }

      const pdfBytes = await pdfDoc.save()
      const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${statsListTitle.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error('PDF-Export fehlgeschlagen:', e)
      alert('PDF konnte nicht erstellt werden.')
    }
  }

  const listFilteredInvitations = useMemo(() => {
    let list = invitations
    if (listResponseFilter !== 'all') {
      list = list.filter((i: any) => {
        const r = i.response || 'PENDING'
        return r === listResponseFilter
      })
    }
    const q = listSearchQuery.trim().toLowerCase()
    if (q) {
      list = list.filter((i: any) => {
        const name = (i.guest?.name || '').toLowerCase()
        const vorname = getGuestVorname(i.guest).toLowerCase()
        const nachname = getGuestNachname(i.guest).toLowerCase()
        const email = getGuestDisplayEmail(i.guest).toLowerCase()
        const phone = getGuestDisplayPhone(i.guest).toLowerCase()
        const staat = getGuestStaatInstitution(i.guest).toLowerCase()
        const bemerkungen = getGuestBemerkungen(i.guest).toLowerCase()
        return name.includes(q) || vorname.includes(q) || nachname.includes(q) ||
          email.includes(q) || phone.includes(q) || staat.includes(q) || bemerkungen.includes(q)
      })
    }
    return list
  }, [invitations, listResponseFilter, listSearchQuery])

  const sortedInvitations = useMemo(() => {
    const base = listFilteredInvitations
    if (!listSortBy || listSortBy !== 'bemerkungen') return base
    const dir = listSortDir === 'asc' ? 1 : -1
    return [...base].sort((a, b) => {
      const va = getGuestBemerkungen(a.guest)
      const vb = getGuestBemerkungen(b.guest)
      return dir * (va.localeCompare(vb, 'de'))
    })
  }, [listFilteredInvitations, listSortBy, listSortDir])

  const totalPages = Math.max(1, Math.ceil(sortedInvitations.length / listPageSize))
  const paginatedInvitations = useMemo(() => {
    const start = (listPage - 1) * listPageSize
    return sortedInvitations.slice(start, start + listPageSize)
  }, [sortedInvitations, listPage, listPageSize])

  // Seite zurücksetzen wenn Filter/Suche/Sortierung sich ändert
  useEffect(() => {
    setListPage(1)
  }, [listResponseFilter, listSearchQuery, listSortBy, listSortDir])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg">Lädt...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">Einladungen</h1>
          <Link
            href="/dashboard"
            className="rounded-lg bg-gray-200 px-4 py-2 text-gray-700 hover:bg-gray-300"
          >
            Zurück zum Dashboard
          </Link>
        </div>

        {/* Tabs */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: 'send', label: 'Einladungen senden' },
              { id: 'list', label: 'Einladungsliste' },
              { id: 'templates', label: 'Templates' },
              { id: 'config', label: 'Email-Konfiguration' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium ${
                  activeTab === tab.id
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'send' && (
          <div className="rounded-lg bg-white p-6 shadow">
            <h2 className="mb-4 text-xl font-semibold">Einladungen senden</h2>
            
            {/* Statistiken (klickbar für Liste) */}
            <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              <button
                type="button"
                onClick={() => setStatsListFilter(statsListFilter === 'sent' ? null : 'sent')}
                className="rounded-lg bg-indigo-50 p-4 text-left transition hover:bg-indigo-100 cursor-pointer"
              >
                <div className="text-2xl font-bold text-indigo-600">{stats.sent}</div>
                <div className="text-sm text-gray-600">Gesamt versendet</div>
              </button>
              <button
                type="button"
                onClick={() => setStatsListFilter(statsListFilter === 'sentRead' ? null : 'sentRead')}
                className="rounded-lg bg-teal-50 p-4 text-left transition hover:bg-teal-100 cursor-pointer"
              >
                <div className="text-2xl font-bold text-teal-600">{stats.sentRead}</div>
                <div className="text-sm text-gray-600">Davon gelesen</div>
              </button>
              <button
                type="button"
                onClick={() => setStatsListFilter(statsListFilter === 'sentNotRead' ? null : 'sentNotRead')}
                className="rounded-lg bg-orange-50 p-4 text-left transition hover:bg-orange-100 cursor-pointer"
              >
                <div className="text-2xl font-bold text-orange-600">{stats.sentNotRead}</div>
                <div className="text-sm text-gray-600">Davon nicht gelesen</div>
              </button>
              <button
                type="button"
                onClick={() => setStatsListFilter(statsListFilter === 'openedAccepted' ? null : 'openedAccepted')}
                className="rounded-lg bg-emerald-50 p-4 text-left transition hover:bg-emerald-100 cursor-pointer"
              >
                <div className="text-2xl font-bold text-emerald-600">{stats.openedAccepted}</div>
                <div className="text-sm text-gray-600">Davon Zusagen</div>
              </button>
              <button
                type="button"
                onClick={() => setStatsListFilter(statsListFilter === 'openedDeclined' ? null : 'openedDeclined')}
                className="rounded-lg bg-rose-50 p-4 text-left transition hover:bg-rose-100 cursor-pointer"
              >
                <div className="text-2xl font-bold text-rose-600">{stats.openedDeclined}</div>
                <div className="text-sm text-gray-600">Davon Absagen</div>
              </button>
              <button
                type="button"
                onClick={() => setStatsListFilter(statsListFilter === 'total' ? null : 'total')}
                className="rounded-lg bg-gray-50 p-4 text-left transition hover:bg-gray-100 cursor-pointer"
              >
                <div className="text-2xl font-bold text-gray-600">{stats.total}</div>
                <div className="text-sm text-gray-600">Gesamt</div>
              </button>
            </div>

            {/* Modal: Liste der gefilterten Einladungen */}
            {statsListFilter && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                onClick={() => setStatsListFilter(null)}
                role="dialog"
                aria-modal="true"
                aria-label={`Liste: ${statsListTitle}`}
              >
                <div
                  className="max-h-[85vh] w-full max-w-2xl overflow-hidden rounded-lg bg-white shadow-xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-3">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {statsListTitle} ({statsFilteredList.length})
                    </h3>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleSaveAsPdf}
                        disabled={statsFilteredList.length === 0}
                        className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Als PDF speichern
                      </button>
                      <button
                        type="button"
                        onClick={() => setStatsListFilter(null)}
                        className="rounded p-1 text-gray-500 hover:bg-gray-200 hover:text-gray-700"
                        aria-label="Schließen"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  <div className="overflow-y-auto p-4" style={{ maxHeight: '70vh' }}>
                    {statsFilteredList.length === 0 ? (
                      <p className="text-gray-500">Keine Einträge.</p>
                    ) : (
                      <ul className="divide-y divide-gray-200">
                        {statsFilteredList.map((inv) => (
                          <li key={inv.id} className="flex items-center justify-between py-3">
                            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                              <span className="font-medium text-gray-900">
                                {getGuestVorname(inv.guest) || '–'}
                              </span>
                              <span className="font-medium text-gray-900">
                                {getGuestNachname(inv.guest) || inv.guest?.name || '–'}
                              </span>
                              <span className="text-sm text-gray-600">
                                {getGuestStaatInstitution(inv.guest) || '–'}
                              </span>
                              <span className="text-sm text-gray-500">
                                {getGuestDisplayEmail(inv.guest) || '–'}
                              </span>
                            </div>
                            {inv.sentAt && (
                              <span className="text-xs text-gray-400 shrink-0">
                                {new Date(inv.sentAt).toLocaleString('de-DE')}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="border-t border-gray-200 bg-gray-50 px-4 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => setStatsListFilter(null)}
                      className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
                    >
                      Schließen
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Template-Auswahl: E-Mail wird mit diesem Template gesendet */}
            <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Template für die E-Mail
              </label>
              <p className="mb-3 text-xs text-gray-500">
                Wählen Sie das Template, mit dem die Einladungs-E-Mails versendet werden. Ohne Auswahl wird pro Gast automatisch ein Template nach Kategorie und Sprache gewählt.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={selectedTemplate}
                  onChange={(e) => {
                    const id = e.target.value
                    setSelectedTemplate(id)
                    const t = templates.find((x: any) => x.id === id)
                    if (t) setSelectedLanguage(t.language)
                  }}
                  className="min-w-[280px] rounded-lg border border-gray-300 bg-white px-3 py-2"
                >
                  <option value="">Automatisch (nach Kategorie + Sprache)</option>
                  {templates.map((t: any) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.language.toUpperCase()})
                      {t.category ? ` – ${getCategoryLabel(t.category, 'de')}` : ' – Global'}
                      {t.isDefault ? ' [Standard]' : ''}
                    </option>
                  ))}
                </select>
                <select
                  value={selectedLanguage}
                  onChange={(e) => {
                    const lang = e.target.value
                    setSelectedLanguage(lang)
                    const defaultTemplate = templates.find(
                      (t: any) => t.language === lang && (t.category === '' || !t.category) && t.isDefault
                    )
                    setSelectedTemplate(defaultTemplate?.id || '')
                  }}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2"
                  title="Sprache für automatische Template-Auswahl"
                >
                  <option value="de">Deutsch</option>
                  <option value="tr">Türkisch</option>
                  <option value="en">Englisch</option>
                  <option value="ar">Arabisch</option>
                </select>
                {selectedTemplate ? (
                  <button
                    type="button"
                    onClick={() => {
                      const t = templates.find((x: any) => x.id === selectedTemplate)
                      if (t) {
                        setEditingTemplate(t)
                        setTemplateForm({
                          name: t.name,
                          language: t.language,
                          category: t.category ?? '',
                          subject: t.subject,
                          body: t.body,
                          plainText: t.plainText ?? '',
                          isDefault: t.isDefault ?? false,
                        })
                        setActiveTab('templates')
                      }
                    }}
                    className="rounded-lg bg-amber-100 px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-200"
                  >
                    ✏️ Template bearbeiten
                  </button>
                ) : (
                  <span className="text-sm text-gray-500">Wählen Sie ein Template, um es hier zu bearbeiten.</span>
                )}
              </div>
            </div>

            {/* Option: Links einbeziehen */}
            <div className="mb-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={includeLinks}
                  onChange={(e) => setIncludeLinks(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm font-medium text-gray-700">
                  Zusage- und Absage-Links in E-Mail einbeziehen
                </span>
              </label>
              <p className="mt-1 text-xs text-gray-500">
                Wenn aktiviert, werden Links für Zusage und Absage in die E-Mail eingefügt (Placeholder: ACCEPT_LINK und DECLINE_LINK)
              </p>
            </div>

            {/* Gäste-Auswahl */}
            <div className="mb-4">
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Gäste auswählen ({selectedGuests.length} ausgewählt)
              </label>
              <div className="max-h-64 overflow-y-auto rounded-lg border border-gray-300 p-4">
                {guests.map((guest) => (
                  <label
                    key={guest.id}
                    className="mb-2 flex items-center space-x-2 rounded p-2 hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={selectedGuests.includes(guest.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedGuests([...selectedGuests, guest.id])
                        } else {
                          setSelectedGuests(selectedGuests.filter(id => id !== guest.id))
                        }
                      }}
                      className="rounded"
                    />
                    <span className="text-sm">
                      {guest.name} ({getGuestDisplayEmail(guest)})
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <button
              onClick={handleSendInvitations}
              disabled={sending || selectedGuests.length === 0}
              className="rounded-lg bg-indigo-600 px-6 py-2 text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {sending ? 'Wird gesendet...' : `${selectedGuests.length} Einladungen senden`}
            </button>
          </div>
        )}

        {activeTab === 'list' && (
          <div className="rounded-lg bg-white p-6 shadow">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Einladungsliste</h2>
                <p className="mt-1 text-sm text-gray-600">
                  Gesamtanzahl: <span className="font-medium text-gray-900">{invitations.length}</span> Gäste
                  {(listResponseFilter !== 'all' || listSearchQuery.trim()) && (
                    <span className="ml-2 text-gray-500">
                      (angezeigt: {listFilteredInvitations.length})
                    </span>
                  )}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="search"
                  placeholder="Suchen (Name, E-Mail, Telefon, Institution…)"
                  value={listSearchQuery}
                  onChange={(e) => setListSearchQuery(e.target.value)}
                  className="min-w-[220px] rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={async () => {
                    if (!eventId) return
                    if (!confirm('Abgleich durchführen? Gäste, die in den Formular-Ergebnissen ihre Teilnahme bestätigt haben, werden in der Einladungsliste als Zusage markiert.')) return
                    setSyncFromRegistrations(true)
                    try {
                      const res = await fetch('/api/invitations/sync-from-registrations', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ eventId }),
                      })
                      const data = await res.json()
                      if (!res.ok) throw new Error(data.error || 'Abgleich fehlgeschlagen')
                      await loadInvitations(eventId)
                      alert(`${data.updated} Einladung(en) als Zusage markiert.`)
                    } catch (e) {
                      alert(e instanceof Error ? e.message : 'Abgleich fehlgeschlagen')
                    } finally {
                      setSyncFromRegistrations(false)
                    }
                  }}
                  disabled={!eventId || syncFromRegistrations}
                  className="rounded-lg bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700 disabled:opacity-50"
                  title="Formular-Ergebnisse mit Einladungsliste abgleichen – Teilnahme bestätigt → Zusage"
                >
                  {syncFromRegistrations ? 'Abgleich läuft…' : '↔ Mit Formular-Ergebnissen abgleichen'}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!eventId) return
                    if (!confirm('Telefonnummern aller Gäste und Anmeldungen ins internationale Format (+49) korrigieren?')) return
                    setFormattingPhones(true)
                    try {
                      const res = await fetch('/api/invitations/format-phone-numbers', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ eventId }),
                      })
                      const data = await res.json()
                      if (!res.ok) throw new Error(data.error || 'Korrektur fehlgeschlagen')
                      await loadInvitations(eventId)
                      alert(data.message || `${data.updatedGuests ?? 0} Gäste und ${data.updatedRegistrations ?? 0} Anmeldungen korrigiert.`)
                    } catch (e) {
                      alert(e instanceof Error ? e.message : 'Korrektur fehlgeschlagen')
                    } finally {
                      setFormattingPhones(false)
                    }
                  }}
                  disabled={!eventId || formattingPhones}
                  className="rounded-lg bg-amber-600 px-4 py-2 text-sm text-white hover:bg-amber-700 disabled:opacity-50"
                  title="Telefonnummern ins internationale Format (+49) formatieren"
                >
                  {formattingPhones ? 'Korrektur läuft…' : '📞 Telefonnummern korrigieren'}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!eventId) return
                    if (!confirm('Alle Zusagen und Absagen für dieses Event auf „Ausstehend“ zurücksetzen?\n\nDie Spalte Zusage/Absage wird für alle Einträge zurückgesetzt. QR-Codes (Check-in) werden ungültig. Diese Aktion kann danach nicht automatisch rückgängig gemacht werden.')) return
                    setRevertingResponses(true)
                    try {
                      const res = await fetchAuth('/api/invitations/revert-responses', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ eventId }),
                      })
                      const data = await res.json()
                      if (!res.ok) throw new Error(data.error || 'Zurücksetzen fehlgeschlagen')
                      await loadInvitations(eventId)
                      alert(data.message || `${data.reverted ?? 0} Einladung(en) zurückgesetzt.`)
                    } catch (e) {
                      alert(e instanceof Error ? e.message : 'Zurücksetzen fehlgeschlagen')
                    } finally {
                      setRevertingResponses(false)
                    }
                  }}
                  disabled={!eventId || revertingResponses}
                  className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
                  title="Alle Zusagen und Absagen in der Spalte auf Ausstehend (PENDING) zurücksetzen"
                >
                  {revertingResponses ? 'Wird zurückgesetzt…' : '↩ Zusagen/Absagen zurücksetzen'}
                </button>
                <button
                  onClick={() => eventId && loadInvitations(eventId)}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
                  title="Liste aktualisieren"
                >
                  🔄 Aktualisieren
                </button>
              </div>
            </div>

            {/* Template-Auswahl (wie im Senden-Bereich) + Bearbeiten */}
            <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Template für E-Mails
              </label>
              <p className="mb-3 text-xs text-gray-500">
                Wählen Sie ein Template; beim „Erneut senden“ wird das gespeicherte E-Mail der Einladung verwendet. Hier können Sie das Template bearbeiten.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={selectedTemplate}
                  onChange={(e) => {
                    const id = e.target.value
                    setSelectedTemplate(id)
                    const t = templates.find((x: any) => x.id === id)
                    if (t) setSelectedLanguage(t.language)
                  }}
                  className="min-w-[280px] rounded-lg border border-gray-300 bg-white px-3 py-2"
                >
                  <option value="">— Template wählen —</option>
                  {templates.map((t: any) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.language.toUpperCase()})
                      {t.category ? ` – ${getCategoryLabel(t.category, 'de')}` : ' – Global'}
                      {t.isDefault ? ' [Standard]' : ''}
                    </option>
                  ))}
                </select>
                {selectedTemplate ? (
                  <button
                    type="button"
                    onClick={() => {
                      const t = templates.find((x: any) => x.id === selectedTemplate)
                      if (t) {
                        setEditingTemplate(t)
                        setTemplateForm({
                          name: t.name,
                          language: t.language,
                          category: t.category ?? '',
                          subject: t.subject,
                          body: t.body,
                          plainText: t.plainText ?? '',
                          isDefault: t.isDefault ?? false,
                        })
                        setActiveTab('templates')
                      }
                    }}
                    className="rounded-lg bg-amber-100 px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-200"
                  >
                    ✏️ Template bearbeiten
                  </button>
                ) : (
                  <span className="text-sm text-gray-500">Template wählen, um es zu bearbeiten.</span>
                )}
              </div>
            </div>

            {/* Max. mitkommende Gäste pro Zusage (für dieses Event) */}
            {eventId && (
              <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Max. mitkommende Gäste pro Zusage
                </label>
                <p className="mb-2 text-xs text-gray-500">
                  Beim Klick auf den Zusage-Link können Gäste angeben, wie viele Personen mitkommen. Hier legen Sie das Maximum fest.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={maxAccompanyingGuestsInput}
                    onChange={(e) => setMaxAccompanyingGuestsInput(e.target.value)}
                    className="w-20 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    disabled={savingMaxAccompanying}
                    onClick={async () => {
                      const n = parseInt(maxAccompanyingGuestsInput, 10)
                      if (!eventId || !Number.isInteger(n) || n < 1) {
                        alert('Bitte eine gültige Zahl (mind. 1) eingeben.')
                        return
                      }
                      setSavingMaxAccompanying(true)
                      try {
                        const res = await fetch('/api/events', {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ eventId, maxAccompanyingGuests: n }),
                        })
                        if (res.ok) {
                          setCurrentEvent((prev) => (prev ? { ...prev, maxAccompanyingGuests: n } : null))
                          await loadInvitations(eventId)
                        } else {
                          const data = await res.json().catch(() => ({}))
                          alert('Fehler: ' + (data.error || 'Speichern fehlgeschlagen'))
                        }
                      } catch (e) {
                        alert('Fehler beim Speichern: ' + (e instanceof Error ? e.message : 'Unbekannt'))
                      } finally {
                        setSavingMaxAccompanying(false)
                      }
                    }}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {savingMaxAccompanying ? 'Wird gespeichert…' : 'Speichern'}
                  </button>
                </div>
              </div>
            )}
            
            {/* Auswahl-Info und Bulk-Aktionen */}
            {selectedInvitations.length > 0 && (
              <div className="mb-4 rounded-lg bg-indigo-50 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-indigo-900">
                    {selectedInvitations.length} Einladung(en) ausgewählt
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        if (!eventId || selectedInvitations.length === 0) return
                        if (!confirm(`Möchten Sie wirklich ${selectedInvitations.length} Einladung(en) erneut per E-Mail senden?`)) return
                        setResendSending(true)
                        try {
                          const response = await fetch('/api/invitations/resend', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              invitationIds: selectedInvitations,
                              templateId: selectedTemplate || undefined,
                            }),
                          })
                          const result = await response.json()
                          if (response.ok) {
                            alert(`Erneut gesendet: ${result.successful} erfolgreich${result.failed > 0 ? `, ${result.failed} fehlgeschlagen` : ''}`)
                            setSelectedInvitations([])
                            await loadInvitations(eventId)
                            if (typeof window !== 'undefined') {
                              window.localStorage.setItem('invitation-updated', Date.now().toString())
                              window.dispatchEvent(new Event('invitation-updated'))
                            }
                          } else {
                            alert('Fehler: ' + (result.error || 'Unbekannter Fehler'))
                          }
                        } catch (e) {
                          alert('Fehler beim erneuten Senden: ' + (e instanceof Error ? e.message : 'Unbekannter Fehler'))
                        } finally {
                          setResendSending(false)
                        }
                      }}
                      disabled={resendSending}
                      className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {resendSending ? 'Wird gesendet...' : 'Erneut senden'}
                    </button>
                    <button
                      onClick={handleBulkDeleteGuests}
                      className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
                    >
                      Ausgewählte löschen
                    </button>
                    <button
                      onClick={() => setSelectedInvitations([])}
                      className="rounded-lg bg-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-300"
                    >
                      Auswahl aufheben
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Tabs: Zusage, Absage, Ausstehend */}
            <div className="mb-4 flex gap-2 border-b border-gray-200">
              <button
                type="button"
                onClick={() => { setListResponseFilter('all'); setSelectedInvitations([]) }}
                className={`rounded-t-lg px-4 py-2 text-sm font-medium ${
                  listResponseFilter === 'all'
                    ? 'border border-b-0 border-gray-200 bg-white text-gray-900'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                Alle ({stats.total})
              </button>
              <button
                type="button"
                onClick={() => { setListResponseFilter('ACCEPTED'); setSelectedInvitations([]) }}
                className={`rounded-t-lg px-4 py-2 text-sm font-medium ${
                  listResponseFilter === 'ACCEPTED'
                    ? 'border border-b-0 border-green-200 bg-green-50 text-green-800'
                    : 'text-green-700 hover:bg-green-50'
                }`}
              >
                Zusage ({stats.accepted})
              </button>
              <button
                type="button"
                onClick={() => { setListResponseFilter('DECLINED'); setSelectedInvitations([]) }}
                className={`rounded-t-lg px-4 py-2 text-sm font-medium ${
                  listResponseFilter === 'DECLINED'
                    ? 'border border-b-0 border-red-200 bg-red-50 text-red-800'
                    : 'text-red-700 hover:bg-red-50'
                }`}
              >
                Absage ({stats.declined})
              </button>
              <button
                type="button"
                onClick={() => { setListResponseFilter('PENDING'); setSelectedInvitations([]) }}
                className={`rounded-t-lg px-4 py-2 text-sm font-medium ${
                  listResponseFilter === 'PENDING'
                    ? 'border border-b-0 border-yellow-200 bg-yellow-50 text-yellow-800'
                    : 'text-yellow-700 hover:bg-yellow-50'
                }`}
              >
                Ausstehend ({stats.pending})
              </button>
            </div>

            {/* Tabelle */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500">
                      WA
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500">
                      Angerufen/gesendet WA
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500">
                      <input
                        type="checkbox"
                        checked={sortedInvitations.length > 0 && selectedInvitations.length === sortedInvitations.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedInvitations(sortedInvitations.map((inv: any) => inv.id))
                          } else {
                            setSelectedInvitations([])
                          }
                        }}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        title="Alle auswählen"
                      />
                      <div className="mt-1 text-xs">Auswahl Einladung</div>
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500">
                      Einladung E-Mail
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Gast
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Vorname
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Nachname
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Staat/Institution
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Anrede 2
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Email
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Telefon
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Template
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500">
                      Mailvorschau
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500">
                      VIP
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500">
                      Einladung Post
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500">
                      Nimmt Teil
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500">
                      Mitkommende
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Begleitpersonen (Name, Funktion, E-Mail)
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500">
                      Abgesagt
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Gesendet
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Gelesen
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Antwort-Datum
                    </th>
                    <th
                      className="cursor-pointer select-none px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 hover:bg-gray-100"
                      onClick={() => {
                        if (listSortBy === 'bemerkungen') {
                          setListSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
                        } else {
                          setListSortBy('bemerkungen')
                          setListSortDir('asc')
                        }
                      }}
                      title="Klicken zum Sortieren nach Bemerkungen"
                    >
                      <span className="inline-flex items-center gap-1">
                        Bemerkungen
                        {listSortBy === 'bemerkungen' && (
                          <span className="text-indigo-600" aria-hidden>
                            {listSortDir === 'asc' ? ' ↑' : ' ↓'}
                          </span>
                        )}
                      </span>
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500">
                      Aktionen
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {invitations.length === 0 ? (
                    <tr>
                      <td colSpan={25} className="px-4 py-8 text-center text-sm text-gray-500">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <p className="text-lg font-medium">Keine Einladungen vorhanden</p>
                          <p className="text-sm text-gray-400">
                            Aktivieren Sie die Checkbox "Einladungsliste" in der Gästeliste, um Gäste zur Einladungsliste hinzuzufügen.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedInvitations.map((invitation) => {
                    const guestPhone = getGuestDisplayPhone(invitation.guest)
                    const isAccepted = invitation.response === 'ACCEPTED'
                    const isPending = invitation.response === 'PENDING' || !invitation.response
                    return (
                    <tr key={invitation.id}>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-center">
                        {isAccepted && guestPhone ? (
                          <button
                            type="button"
                            onClick={() => handleWhatsAppAccepted(invitation)}
                            disabled={verifyingQrId === invitation.id}
                            className="inline-flex items-center justify-center rounded-lg bg-green-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                            title="Eventinfo mit QR-Code per WhatsApp senden (Link wird vorher geprüft)"
                          >
                            {verifyingQrId === invitation.id ? '…' : 'WhatsApp'}
                          </button>
                        ) : isPending && guestPhone ? (
                          <button
                            type="button"
                            onClick={() => handleQrErstellenUndWaSenden(invitation)}
                            disabled={acceptingOnBehalfId === invitation.id}
                            className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                            title="QR-Code erstellen und per WhatsApp mit Info-Text senden"
                          >
                            {acceptingOnBehalfId === invitation.id ? '…' : 'QR erstellen + WA'}
                          </button>
                        ) : (
                          <span className="text-gray-400 text-xs">–</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={!!invitation.whatsappSentAt}
                          onChange={(e) => handleCheckboxChange(invitation.id, 'whatsappSentAt', e.target.checked)}
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          title="Angerufen / QR per WhatsApp gesendet"
                        />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-center">
                        <input
                          type="checkbox"
                          checked={selectedInvitations.includes(invitation.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedInvitations([...selectedInvitations, invitation.id])
                            } else {
                              setSelectedInvitations(selectedInvitations.filter(id => id !== invitation.id))
                            }
                          }}
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-center">
                        <input
                          type="checkbox"
                          checked={!!invitation.sentAt}
                          disabled
                          className="rounded border-gray-300 text-gray-400"
                          title={invitation.sentAt ? `Gesendet: ${new Date(invitation.sentAt).toLocaleString('de-DE')}` : 'Nicht gesendet'}
                        />
                      </td>
                      <td
                        className="whitespace-nowrap px-4 py-3 text-sm text-gray-900 cursor-pointer hover:bg-gray-50"
                        onClick={() => handleCellEdit(invitation.id, 'guestName', invitation.guest?.name)}
                      >
                        {editingCell?.invitationId === invitation.id && editingCell?.field === 'guestName' ? (
                          renderEditableInput(invitation.id, 'guestName')
                        ) : (
                          invitation.guest?.name || <span className="text-gray-400 italic">Klicken zum Bearbeiten</span>
                        )}
                      </td>
                      <td
                        className="whitespace-nowrap px-4 py-3 text-sm text-gray-700 cursor-pointer hover:bg-gray-50"
                        onClick={() => handleCellEdit(invitation.id, 'guestVorname', getGuestVorname(invitation.guest))}
                      >
                        {editingCell?.invitationId === invitation.id && editingCell?.field === 'guestVorname' ? (
                          renderEditableInput(invitation.id, 'guestVorname')
                        ) : (
                          getGuestVorname(invitation.guest) || <span className="text-gray-400 italic">–</span>
                        )}
                      </td>
                      <td
                        className="whitespace-nowrap px-4 py-3 text-sm text-gray-700 cursor-pointer hover:bg-gray-50"
                        onClick={() => handleCellEdit(invitation.id, 'guestNachname', getGuestNachname(invitation.guest))}
                      >
                        {editingCell?.invitationId === invitation.id && editingCell?.field === 'guestNachname' ? (
                          renderEditableInput(invitation.id, 'guestNachname')
                        ) : (
                          getGuestNachname(invitation.guest) || invitation.guest?.name || <span className="text-gray-400 italic">–</span>
                        )}
                      </td>
                      <td
                        className="whitespace-nowrap px-4 py-3 text-sm text-gray-700 cursor-pointer hover:bg-gray-50"
                        onClick={() => handleCellEdit(invitation.id, 'guestStaatInstitution', getGuestStaatInstitution(invitation.guest))}
                      >
                        {editingCell?.invitationId === invitation.id && editingCell?.field === 'guestStaatInstitution' ? (
                          renderEditableInput(invitation.id, 'guestStaatInstitution')
                        ) : (
                          getGuestStaatInstitution(invitation.guest) || <span className="text-gray-400 italic">–</span>
                        )}
                      </td>
                      <td
                        className="whitespace-nowrap px-4 py-3 text-sm text-gray-700 cursor-pointer hover:bg-gray-50"
                        onClick={() => handleCellEdit(invitation.id, 'guestAnrede2', getGuestAnrede2(invitation.guest))}
                      >
                        {editingCell?.invitationId === invitation.id && editingCell?.field === 'guestAnrede2' ? (
                          renderEditableInput(invitation.id, 'guestAnrede2')
                        ) : (
                          getGuestAnrede2(invitation.guest) || <span className="text-gray-400 italic">–</span>
                        )}
                      </td>
                      <td
                        className="whitespace-nowrap px-4 py-3 text-sm text-gray-500 cursor-pointer hover:bg-gray-50"
                        onClick={() => handleCellEdit(invitation.id, 'guestEmail', getGuestDisplayEmail(invitation.guest))}
                      >
                        {editingCell?.invitationId === invitation.id && editingCell?.field === 'guestEmail' ? (
                          renderEditableInput(invitation.id, 'guestEmail', false)
                        ) : (
                          getGuestDisplayEmail(invitation.guest) || <span className="text-gray-400 italic">–</span>
                        )}
                      </td>
                      <td
                        className="whitespace-nowrap px-4 py-3 text-sm text-gray-700 cursor-pointer hover:bg-gray-50"
                        onClick={() => handleCellEdit(invitation.id, 'guestPhone', guestPhone)}
                      >
                        {editingCell?.invitationId === invitation.id && editingCell?.field === 'guestPhone' ? (
                          renderEditableInput(invitation.id, 'guestPhone')
                        ) : (
                          guestPhone || <span className="text-gray-400 italic">–</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <select
                          value={invitation.templateId || ''}
                          onChange={(e) => handleTemplateChange(invitation.id, e.target.value || null)}
                          className="w-full max-w-[200px] rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          title="Template für diesen Gast"
                        >
                          <option value="">– Keins –</option>
                          {templates.map((t: any) => (
                            <option key={t.id} value={t.id}>
                              {t.name} ({t.language?.toUpperCase() || ''})
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleShowPreview(invitation)}
                          disabled={loadingPreview || !(invitation.templateId || invitation.template?.id)}
                          className="rounded bg-indigo-100 px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Mailvorschau anzeigen"
                        >
                          {loadingPreview ? '…' : 'Vorschau'}
                        </button>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-center">
                        <input
                          type="checkbox"
                          checked={invitation.guest?.isVip || false}
                          onChange={(e) => handleVipChange(invitation.guestId, e.target.checked)}
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-center">
                        <input
                          type="checkbox"
                          checked={invitation.sentByPost || false}
                          onChange={(e) => handleCheckboxChange(invitation.id, 'sentByPost', e.target.checked)}
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-center">
                        <input
                          type="checkbox"
                          checked={invitation.response === 'ACCEPTED'}
                          onChange={(e) => {
                            if (e.target.checked) {
                              // Wenn "Nimmt Teil" aktiviert wird, setze "Abgesagt" zurück
                              handleCheckboxChange(invitation.id, 'nimmtTeil', true)
                            } else {
                              handleCheckboxChange(invitation.id, 'response', false)
                            }
                          }}
                          className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                        />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-center text-gray-700">
                        {invitation.response === 'ACCEPTED'
                          ? (invitation.accompanyingGuestsCount ?? 1)
                          : '–'}
                      </td>
                      <td className="max-w-xs px-4 py-3 text-sm text-gray-700">
                        {invitation.accompanyingGuests?.length
                          ? (
                              <ul className="list-inside list-disc space-y-0.5 text-xs">
                                {(invitation.accompanyingGuests as Array<{ firstName: string; lastName: string; funktion?: string | null; email?: string | null }>).map((ag, i) => (
                                  <li key={i}>
                                    {[ag.firstName, ag.lastName].filter(Boolean).join(' ')}
                                    {ag.funktion ? ` · ${ag.funktion}` : ''}
                                    {ag.email ? ` · ${ag.email}` : ''}
                                  </li>
                                ))}
                              </ul>
                            )
                          : '–'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-center">
                        <input
                          type="checkbox"
                          checked={invitation.response === 'DECLINED'}
                          onChange={(e) => {
                            if (e.target.checked) {
                              // Wenn "Abgesagt" aktiviert wird, setze "Nimmt Teil" zurück
                              handleCheckboxChange(invitation.id, 'abgesagt', true)
                            } else {
                              handleCheckboxChange(invitation.id, 'response', false)
                            }
                          }}
                          className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                        />
                      </td>
                      <td 
                        className="whitespace-nowrap px-4 py-3 text-sm text-gray-500 cursor-pointer hover:bg-gray-50"
                        onClick={() => !invitation.sentAt && handleCellEdit(invitation.id, 'sentAt', invitation.sentAt)}
                      >
                        {editingCell?.invitationId === invitation.id && editingCell?.field === 'sentAt' ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="datetime-local"
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              onBlur={() => handleCellSave(invitation.id, 'sentAt')}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleCellSave(invitation.id, 'sentAt')
                                } else if (e.key === 'Escape') {
                                  handleCellCancel()
                                }
                              }}
                              className="rounded border border-indigo-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              autoFocus
                            />
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleCellSave(invitation.id, 'sentAt')
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
                          invitation.sentAt
                            ? new Date(invitation.sentAt).toLocaleString('de-DE')
                            : <span className="text-gray-400 italic">Klicken zum Bearbeiten</span>
                        )}
                      </td>
                      <td 
                        className="whitespace-nowrap px-4 py-3 text-sm text-gray-500 cursor-pointer hover:bg-gray-50"
                        onClick={() => handleCellEdit(invitation.id, 'openedAt', invitation.openedAt)}
                      >
                        {editingCell?.invitationId === invitation.id && editingCell?.field === 'openedAt' ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="datetime-local"
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              onBlur={() => handleCellSave(invitation.id, 'openedAt')}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleCellSave(invitation.id, 'openedAt')
                                } else if (e.key === 'Escape') {
                                  handleCellCancel()
                                }
                              }}
                              className="rounded border border-indigo-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              autoFocus
                            />
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleCellSave(invitation.id, 'openedAt')
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
                          invitation.openedAt ? (
                            <span className="text-green-600">
                              {new Date(invitation.openedAt).toLocaleString('de-DE')}
                            </span>
                          ) : (
                            <span className="text-gray-400 italic">Klicken zum Bearbeiten</span>
                          )
                        )}
                      </td>
                      <td 
                        className="whitespace-nowrap px-4 py-3 text-sm cursor-pointer hover:bg-gray-50"
                        onClick={() => handleCellEdit(invitation.id, 'response', invitation.response)}
                      >
                        {editingCell?.invitationId === invitation.id && editingCell?.field === 'response' ? (
                          <div className="flex items-center gap-2">
                            <select
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              onBlur={() => handleCellSave(invitation.id, 'response')}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleCellSave(invitation.id, 'response')
                                } else if (e.key === 'Escape') {
                                  handleCellCancel()
                                }
                              }}
                              className="rounded border border-indigo-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              autoFocus
                            >
                              <option value="PENDING">Ausstehend</option>
                              <option value="ACCEPTED">Zusage</option>
                              <option value="DECLINED">Absage</option>
                            </select>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleCellSave(invitation.id, 'response')
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
                          invitation.response === 'ACCEPTED' ? (
                            <span className="rounded-full bg-green-100 px-2 py-1 text-green-800">
                              Zusage
                            </span>
                          ) : invitation.response === 'DECLINED' ? (
                            <span className="rounded-full bg-red-100 px-2 py-1 text-red-800">
                              Absage
                            </span>
                          ) : (
                            <span className="rounded-full bg-yellow-100 px-2 py-1 text-yellow-800">
                              Ausstehend
                            </span>
                          )
                        )}
                      </td>
                      <td 
                        className="whitespace-nowrap px-4 py-3 text-sm text-gray-500 cursor-pointer hover:bg-gray-50"
                        onClick={() => handleCellEdit(invitation.id, 'respondedAt', invitation.respondedAt)}
                      >
                        {editingCell?.invitationId === invitation.id && editingCell?.field === 'respondedAt' ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="datetime-local"
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              onBlur={() => handleCellSave(invitation.id, 'respondedAt')}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleCellSave(invitation.id, 'respondedAt')
                                } else if (e.key === 'Escape') {
                                  handleCellCancel()
                                }
                              }}
                              className="rounded border border-indigo-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              autoFocus
                            />
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleCellSave(invitation.id, 'respondedAt')
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
                          invitation.respondedAt
                            ? new Date(invitation.respondedAt).toLocaleString('de-DE')
                            : <span className="text-gray-400 italic">Klicken zum Bearbeiten</span>
                        )}
                      </td>
                      <td
                        className="max-w-xs truncate px-4 py-3 text-sm text-gray-600 cursor-pointer hover:bg-gray-50"
                        title={getGuestBemerkungen(invitation.guest)}
                        onClick={() => handleCellEdit(invitation.id, 'guestBemerkungen', getGuestBemerkungen(invitation.guest))}
                      >
                        {editingCell?.invitationId === invitation.id && editingCell?.field === 'guestBemerkungen' ? (
                          renderEditableInput(invitation.id, 'guestBemerkungen')
                        ) : (
                          getGuestBemerkungen(invitation.guest) || <span className="text-gray-400 italic">–</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleRegenerateQr(invitation.id)}
                            disabled={regeneratingQrId === invitation.id}
                            className="rounded bg-indigo-100 px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-200 disabled:opacity-50"
                            title="QR-Link aktualisieren (alter Link wird ungültig)"
                          >
                            {regeneratingQrId === invitation.id ? '…' : 'QR-Link aktualisieren'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setLinkPreviewInvitation({ acceptToken: invitation.acceptToken, guestName: invitation.guest?.name })}
                            className="rounded bg-sky-100 px-2 py-1 text-xs font-medium text-sky-700 hover:bg-sky-200"
                            title="Zusage-Link und QR-PDF-Link anzeigen"
                          >
                            Link-Vorschau
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteGuest(invitation.guestId, invitation.guest?.name)}
                            className="rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-200"
                            title="Gast und Einladung löschen"
                          >
                            Löschen
                          </button>
                        </div>
                      </td>
                    </tr>
                    )
                  }) )}
                </tbody>
              </table>
            </div>

            {/* Paginierung */}
            {sortedInvitations.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-600">
                    Zeige {(listPage - 1) * listPageSize + 1}–{Math.min(listPage * listPageSize, sortedInvitations.length)} von {sortedInvitations.length}
                  </span>
                  <select
                    value={listPageSize}
                    onChange={(e) => {
                      setListPageSize(Number(e.target.value))
                      setListPage(1)
                    }}
                    className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                  >
                    <option value={15}>15 pro Seite</option>
                    <option value={25}>25 pro Seite</option>
                    <option value={50}>50 pro Seite</option>
                    <option value={100}>100 pro Seite</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setListPage((p) => Math.max(1, p - 1))}
                    disabled={listPage <= 1}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    ← Zurück
                  </button>
                  <span className="text-sm text-gray-600">
                    Seite {listPage} von {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setListPage((p) => Math.min(totalPages, p + 1))}
                    disabled={listPage >= totalPages}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Weiter →
                  </button>
                </div>
              </div>
            )}

            {/* Modal: Mailvorschau */}
            {previewModal && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                onClick={() => setPreviewModal(null)}
                role="dialog"
                aria-modal="true"
                aria-label="Mailvorschau"
              >
                <div
                  className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-lg bg-white shadow-xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-3">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Mailvorschau – {previewModal.guestName}
                    </h3>
                    <button
                      type="button"
                      onClick={() => setPreviewModal(null)}
                      className="rounded p-1 text-gray-500 hover:bg-gray-200 hover:text-gray-700"
                      aria-label="Schließen"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="overflow-y-auto p-4" style={{ maxHeight: '70vh' }}>
                    <div className="mb-4">
                      <span className="text-xs font-medium uppercase text-gray-500">Betreff</span>
                      <p className="mt-1 text-sm font-medium text-gray-900">{previewModal.subject}</p>
                    </div>
                    <div>
                      <span className="text-xs font-medium uppercase text-gray-500">Inhalt</span>
                      <div
                        className="mt-1 rounded border border-gray-200 bg-white p-4 text-sm text-gray-800 prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: previewModal.body }}
                      />
                    </div>
                  </div>
                  <div className="border-t border-gray-200 bg-gray-50 px-4 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => setPreviewModal(null)}
                      className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
                    >
                      Schließen
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Modal: Link-Vorschau (Zusage-Link + QR-PDF-Link) */}
            {linkPreviewInvitation && (() => {
              const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
              const acceptLink = `${baseUrl}/invitation/accept/${encodeURIComponent(linkPreviewInvitation.acceptToken)}`
              const qrPdfLink = `${baseUrl}/api/invitations/accept/${encodeURIComponent(linkPreviewInvitation.acceptToken)}/qr-pdf`
              const copy = (text: string, label: string) => {
                if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
                  navigator.clipboard.writeText(text).then(() => alert(`${label} in Zwischenablage kopiert.`)).catch(() => alert('Kopieren fehlgeschlagen.'))
                } else {
                  alert(`${label}:\n${text}`)
                }
              }
              return (
                <div
                  className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                  onClick={() => setLinkPreviewInvitation(null)}
                  role="dialog"
                  aria-modal="true"
                  aria-label="Link-Vorschau"
                >
                  <div
                    className="w-full max-w-lg rounded-lg bg-white shadow-xl"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-3">
                      <h3 className="text-lg font-semibold text-gray-900">
                        Link-Vorschau{linkPreviewInvitation.guestName ? ` – ${linkPreviewInvitation.guestName}` : ''}
                      </h3>
                      <button
                        type="button"
                        onClick={() => setLinkPreviewInvitation(null)}
                        className="rounded p-1 text-gray-500 hover:bg-gray-200 hover:text-gray-700"
                        aria-label="Schließen"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="space-y-4 p-4">
                      <div>
                        <label className="block text-xs font-medium uppercase text-gray-500">Zusage-Link</label>
                        <div className="mt-1 flex gap-2">
                          <input
                            type="text"
                            readOnly
                            value={acceptLink}
                            className="flex-1 rounded border border-gray-300 bg-gray-50 px-2 py-1.5 text-xs text-gray-700"
                          />
                          <button
                            type="button"
                            onClick={() => copy(acceptLink, 'Zusage-Link')}
                            className="shrink-0 rounded bg-sky-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-sky-700"
                          >
                            Kopieren
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium uppercase text-gray-500">QR-PDF-Link</label>
                        <div className="mt-1 flex gap-2">
                          <input
                            type="text"
                            readOnly
                            value={qrPdfLink}
                            className="flex-1 rounded border border-gray-300 bg-gray-50 px-2 py-1.5 text-xs text-gray-700"
                          />
                          <button
                            type="button"
                            onClick={() => copy(qrPdfLink, 'QR-PDF-Link')}
                            className="shrink-0 rounded bg-sky-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-sky-700"
                          >
                            Kopieren
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="border-t border-gray-200 bg-gray-50 px-4 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => setLinkPreviewInvitation(null)}
                        className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
                      >
                        Schließen
                      </button>
                    </div>
                  </div>
                </div>
              )
            })()}
          </div>
        )}

        {activeTab === 'templates' && (
          <div className="rounded-lg bg-white p-6 shadow">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Email-Templates</h2>
              <div className="flex gap-2">
                <button
                  onClick={handleCreateDefaultTemplates}
                  className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                >
                  + Standard-Templates erstellen
                </button>
                <button
                  onClick={handleCreate3Templates}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  ✨ 3 Fertige Templates (DE/TR/EN)
                </button>
                <button
                  onClick={handleCreateTemplatesPerCategory}
                  className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
                >
                  📂 Pro Kategorie DE/TR/EN
                </button>
              </div>
            </div>

            {/* Test-Email Bereich */}
            <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <h3 className="mb-4 text-lg font-medium text-blue-900">Test-E-Mail senden</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    E-Mail-Adresse *
                  </label>
                  <input
                    type="email"
                    value={testEmailForm.email}
                    onChange={(e) => setTestEmailForm({ ...testEmailForm, email: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2"
                    placeholder="test@example.com"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Template auswählen *
                  </label>
                  <select
                    value={testEmailForm.templateId}
                    onChange={(e) => setTestEmailForm({ ...testEmailForm, templateId: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2"
                  >
                    <option value="">-- Template wählen --</option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name} ({template.language.toUpperCase()})
                        {template.isDefault ? ' [Standard]' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={testEmailForm.includeLinks}
                      onChange={(e) => setTestEmailForm({ ...testEmailForm, includeLinks: e.target.checked })}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      Links einbeziehen
                    </span>
                  </label>
                </div>
              </div>
              <div className="mt-4">
                <button
                  onClick={handleSendTestEmail}
                  disabled={sendingTestEmail || !testEmailForm.email || !testEmailForm.templateId}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {sendingTestEmail ? '⏳ Sende...' : '📧 Test-E-Mail senden'}
                </button>
              </div>
            </div>

            {/* Formular für neue/bearbeitete Templates */}
            <div className="mb-6 rounded-lg border border-gray-200 p-4">
              <h3 className="mb-4 text-lg font-medium">
                {editingTemplate ? 'Template bearbeiten' : 'Neues Email-Template'}
              </h3>
              
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Name *
                  </label>
                  <input
                    type="text"
                    value={templateForm.name}
                    onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2"
                    placeholder="z.B. Standard Einladung (Deutsch)"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Sprache *
                  </label>
                  <select
                    value={templateForm.language}
                    onChange={(e) => setTemplateForm({ ...templateForm, language: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2"
                  >
                    <option value="de">Deutsch</option>
                    <option value="tr">Türkisch</option>
                    <option value="en">Englisch</option>
                    <option value="ar">Arabisch</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Kategorie (Gästeliste)
                  </label>
                  <select
                    value={templateForm.category}
                    onChange={(e) => setTemplateForm({ ...templateForm, category: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2"
                  >
                    <option value="">— Global / Alle —</option>
                    {getKnownCategoryKeys().map((key) => (
                      <option key={key} value={key}>
                        {getCategoryLabel(key, 'de')} (DE/TR/EN)
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    Kategorie in der Gästeliste kann auf Türkisch oder Deutsch stehen; wird automatisch zugeordnet.
                  </p>
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Betreff *
                  </label>
                  <input
                    type="text"
                    value={templateForm.subject}
                    onChange={(e) => setTemplateForm({ ...templateForm, subject: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2"
                    placeholder="z.B. Einladung zum Iftar-Essen - EVENT_TITLE"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Verfügbare Platzhalter: GUEST_NAME, VORNAME, ANREDE_2, EVENT_TITLE, STAAT_INSTITUTION
                  </p>
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    HTML-Body *
                  </label>
                  <textarea
                    value={templateForm.body}
                    onChange={(e) => setTemplateForm({ ...templateForm, body: e.target.value })}
                    rows={10}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm"
                    placeholder="<p>Liebe/r GUEST_NAME,</p>..."
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Verfügbare Platzhalter im HTML-Body: GUEST_NAME, VORNAME, ANREDE_2 (Anrede 2 aus Gästeliste), EVENT_TITLE, EVENT_DATE, EVENT_LOCATION, STAAT_INSTITUTION, ACCEPT_LINK, DECLINE_LINK
                  </p>
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Plain-Text (optional)
                  </label>
                  <textarea
                    value={templateForm.plainText}
                    onChange={(e) => setTemplateForm({ ...templateForm, plainText: e.target.value })}
                    rows={5}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm"
                    placeholder="Plain-Text Version der E-Mail"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={templateForm.isDefault}
                      onChange={(e) => setTemplateForm({ ...templateForm, isDefault: e.target.checked })}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      Als Standard-Template für diese Sprache verwenden
                    </span>
                  </label>
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  onClick={handleSaveTemplate}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                >
                  {editingTemplate ? 'Aktualisieren' : 'Erstellen'}
                </button>
                {editingTemplate && (
                  <button
                    onClick={() => {
                      setEditingTemplate(null)
                      setTemplateForm({
                        name: '',
                        language: 'de',
                        category: '',
                        subject: '',
                        body: '',
                        plainText: '',
                        isDefault: false,
                      })
                    }}
                    className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
                  >
                    Abbrechen
                  </button>
                )}
              </div>
            </div>

            {/* Liste der vorhandenen Templates */}
            <div>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-lg font-medium">Vorhandene Templates</h3>
                {templates.length > 0 && (
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={templates.length > 0 && selectedTemplateIds.length === templates.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedTemplateIds(templates.map((t: any) => t.id))
                          } else {
                            setSelectedTemplateIds([])
                          }
                        }}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      Alle auswählen
                    </label>
                    <button
                      type="button"
                      onClick={handleDeleteSelectedTemplates}
                      disabled={selectedTemplateIds.length === 0}
                      className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Ausgewählte löschen ({selectedTemplateIds.length})
                    </button>
                  </div>
                )}
              </div>
              {templates.length === 0 ? (
                <div className="rounded-lg border border-gray-200 p-4 text-center">
                  <p className="text-sm text-gray-500">Keine Templates vorhanden</p>
                  <p className="mt-2 text-xs text-gray-400">
                    Erstellen Sie ein neues Template oder verwenden Sie den Button oben, um Standard-Templates zu erstellen.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {templates.map((template) => (
                    <div
                      key={template.id}
                      className={`flex items-center gap-3 rounded-lg border p-4 ${
                        template.isDefault ? 'border-green-500 bg-green-50' : 'border-gray-200'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedTemplateIds.includes(template.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedTemplateIds((prev) => [...prev, template.id])
                          } else {
                            setSelectedTemplateIds((prev) => prev.filter((id) => id !== template.id))
                          }
                        }}
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        aria-label={`${template.name} auswählen`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">
                          {template.name}
                          {template.isDefault && (
                            <span className="ml-2 rounded bg-green-500 px-2 py-1 text-xs text-white">
                              Standard
                            </span>
                          )}
                          {template.category ? (
                            <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                              {getCategoryLabel(template.category, 'de')}
                            </span>
                          ) : (
                            <span className="ml-2 rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                              Global
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-600">
                          {template.language.toUpperCase()} - {template.subject}
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button
                          onClick={() => handleEditTemplate(template)}
                          className="rounded-lg bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
                        >
                          Bearbeiten
                        </button>
                        <button
                          onClick={() => handleDeleteTemplate(template.id)}
                          className="rounded-lg bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700"
                        >
                          Löschen
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'config' && (
          <div className="rounded-lg bg-white p-6 shadow">
            <h2 className="mb-4 text-xl font-semibold">Email-Konfiguration</h2>
            
            {/* Formular für neue/bearbeitete Konfiguration */}
            <div className="mb-6 rounded-lg border border-gray-200 p-4">
              <h3 className="mb-4 text-lg font-medium">
                {editingConfig ? 'Konfiguration bearbeiten' : 'Neue Email-Konfiguration'}
              </h3>
              
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Name *
                  </label>
                  <input
                    type="text"
                    value={configForm.name}
                    onChange={(e) => setConfigForm({ ...configForm, name: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2"
                    placeholder="z.B. Gmail Hauptkonto"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Typ *
                  </label>
                  <select
                    value={configForm.type}
                    onChange={(e) => setConfigForm({ ...configForm, type: e.target.value as 'GMAIL' | 'ICLOUD' | 'IMAP' | 'MAILJET' })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2"
                  >
                    <option value="GMAIL">Gmail</option>
                    <option value="ICLOUD">iCloud Mail</option>
                    <option value="IMAP">Eigener Mail-Server (SMTP/IMAP)</option>
                    <option value="MAILJET">Mailjet (API)</option>
                  </select>
                  {(configForm.type === 'GMAIL' || configForm.type === 'ICLOUD' || configForm.type === 'IMAP') && (
                    <p className="mt-1 text-xs text-amber-700">
                      Auf Railway (Free/Hobby) ist SMTP deaktiviert – nutzen Sie dort <strong>Mailjet (API)</strong>. Siehe <a href="https://docs.railway.com/reference/outbound-networking" target="_blank" rel="noopener noreferrer" className="underline">Railway Outbound Networking</a>.
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    E-Mail-Adresse *
                  </label>
                  <input
                    type="email"
                    value={configForm.email}
                    onChange={(e) => setConfigForm({ ...configForm, email: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2"
                    placeholder="ihre@email.com"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Absender (Name)
                  </label>
                  <input
                    type="text"
                    value={configForm.senderName}
                    onChange={(e) => setConfigForm({ ...configForm, senderName: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2"
                    placeholder="z. B. Iftar Organizasyon oder Max Mustermann"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Anzeigename des Absenders in der E-Mail (optional). Ohne Angabe wird ein Standardname verwendet.
                  </p>
                </div>

                {configForm.type === 'GMAIL' ? (
                  <>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        Gmail App-Passwort *
                      </label>
                      <div className="flex gap-2">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={configForm.appPassword}
                          onChange={(e) => setConfigForm({ ...configForm, appPassword: e.target.value })}
                          className="flex-1 rounded-lg border border-gray-300 px-3 py-2"
                          placeholder="16-stelliges App-Passwort"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                        >
                          {showPassword ? '👁️' : '👁️‍🗨️'}
                        </button>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        Erstellen Sie ein App-Passwort in Ihrem Google-Konto unter: 
                        <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline ml-1">
                          Google Account → Sicherheit → App-Passwörter
                        </a>
                      </p>
                    </div>
                  </>
                ) : configForm.type === 'ICLOUD' ? (
                  <>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        iCloud App-Passwort *
                      </label>
                      <div className="flex gap-2">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={configForm.appPassword}
                          onChange={(e) => setConfigForm({ ...configForm, appPassword: e.target.value })}
                          className="flex-1 rounded-lg border border-gray-300 px-3 py-2"
                          placeholder="App-spezifisches Passwort"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                        >
                          {showPassword ? '👁️' : '👁️‍🗨️'}
                        </button>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        Erstellen Sie ein app-spezifisches Passwort in Ihren Apple-ID-Einstellungen: 
                        <a href="https://appleid.apple.com/account/manage" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline ml-1">
                          appleid.apple.com
                        </a>
                        {' → Anmelden → Sicherheit → App-spezifische Passwörter'}
                      </p>
                      <p className="mt-1 text-xs text-gray-400">
                        💡 <strong>Hinweis:</strong> Sie benötigen Zwei-Faktor-Authentifizierung für Ihr Apple-ID-Konto aktiviert.
                      </p>
                    </div>
                  </>
                ) : configForm.type === 'MAILJET' ? (
                  <>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        Mailjet API Key *
                      </label>
                      <input
                        type="text"
                        value={configForm.mailjetApiKey}
                        onChange={(e) => setConfigForm({ ...configForm, mailjetApiKey: e.target.value })}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2"
                        placeholder="Ihr API Key (public)"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        API Key aus dem Mailjet-Dashboard (Account → API Keys).
                      </p>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        Mailjet API Secret *
                      </label>
                      <div className="flex gap-2">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={configForm.mailjetApiSecret}
                          onChange={(e) => setConfigForm({ ...configForm, mailjetApiSecret: e.target.value })}
                          className="flex-1 rounded-lg border border-gray-300 px-3 py-2"
                          placeholder="Ihr API Secret (private)"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                        >
                          {showPassword ? '👁️' : '👁️‍🗨️'}
                        </button>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        API Secret aus dem Mailjet-Dashboard. Absender-E-Mail sollte in Mailjet verifiziert sein.
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="md:col-span-2 rounded-lg border border-blue-200 bg-blue-50 p-3">
                      <p className="mb-2 text-sm text-blue-800">
                        <strong>Office 365 / Outlook:</strong> Server voreinstellen – wählen Sie die gewünschte Verschlüsselung.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setConfigForm({
                            ...configForm,
                            smtpHost: 'smtp.office365.com',
                            smtpPort: 587,
                            smtpUseStartTls: true,
                          })}
                          className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                        >
                          Office 365 – STARTTLS (Port 587)
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfigForm({
                            ...configForm,
                            smtpHost: 'smtp.office365.com',
                            smtpPort: 465,
                            smtpUseStartTls: false,
                          })}
                          className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                        >
                          Office 365 – SSL/TLS (Port 465)
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        SMTP Host *
                      </label>
                      <input
                        type="text"
                        value={configForm.smtpHost}
                        onChange={(e) => setConfigForm({ ...configForm, smtpHost: e.target.value })}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2"
                        placeholder="smtp.office365.com oder smtp.example.com"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        Verschlüsselung
                      </label>
                      <select
                        value={configForm.smtpPort === 465 && !configForm.smtpUseStartTls ? 'ssl' : 'starttls'}
                        onChange={(e) => {
                          const v = e.target.value
                          setConfigForm({
                            ...configForm,
                            smtpPort: v === 'ssl' ? 465 : 587,
                            smtpUseStartTls: v === 'starttls',
                          })
                        }}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2"
                      >
                        <option value="starttls">STARTTLS (Port 587)</option>
                        <option value="ssl">SSL/TLS (Port 465)</option>
                      </select>
                      <p className="mt-1 text-xs text-gray-500">
                        {configForm.smtpPort === 465 ? 'SSL/TLS – verschlüsselte Verbindung von Anfang an.' : 'STARTTLS – Verbindung wird auf Port 587 zu TLS hochgestuft.'}
                      </p>
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        SMTP Port *
                      </label>
                      <input
                        type="number"
                        value={configForm.smtpPort}
                        onChange={(e) => {
                          const p = parseInt(e.target.value) || 587
                          setConfigForm({
                            ...configForm,
                            smtpPort: p,
                            smtpUseStartTls: p === 465 ? false : configForm.smtpUseStartTls,
                          })
                        }}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2"
                        placeholder="587 oder 465"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        Passwort
                      </label>
                      <div className="flex gap-2">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={configForm.password}
                          onChange={(e) => setConfigForm({ ...configForm, password: e.target.value })}
                          className="flex-1 rounded-lg border border-gray-300 px-3 py-2"
                          placeholder="SMTP Passwort"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                        >
                          {showPassword ? '👁️' : '👁️‍🗨️'}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        IMAP Host (optional)
                      </label>
                      <input
                        type="text"
                        value={configForm.imapHost}
                        onChange={(e) => setConfigForm({ ...configForm, imapHost: e.target.value })}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2"
                        placeholder="imap.example.com"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        IMAP Port (optional)
                      </label>
                      <input
                        type="number"
                        value={configForm.imapPort}
                        onChange={(e) => setConfigForm({ ...configForm, imapPort: parseInt(e.target.value) || 993 })}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2"
                        placeholder="993"
                      />
                    </div>
                  </>
                )}

                <div className="md:col-span-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={configForm.isActive}
                      onChange={(e) => setConfigForm({ ...configForm, isActive: e.target.checked })}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      Als aktive Konfiguration verwenden
                    </span>
                  </label>
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  onClick={handleSaveConfig}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                >
                  {editingConfig ? 'Aktualisieren' : 'Erstellen'}
                </button>
                {editingConfig && (
                  <button
                    onClick={() => {
                      setEditingConfig(null)
                      setConfigForm({
                        name: '',
                        type: 'GMAIL',
                        email: '',
                        senderName: '',
                        appPassword: '',
                        password: '',
                        smtpHost: '',
                        smtpPort: 587,
                        smtpUseStartTls: false,
                        imapHost: '',
                        imapPort: 993,
                        mailjetApiKey: '',
                        mailjetApiSecret: '',
                        isActive: false,
                      })
                    }}
                    className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
                  >
                    Abbrechen
                  </button>
                )}
              </div>
            </div>

            {/* Liste der vorhandenen Konfigurationen */}
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-medium">Vorhandene Konfigurationen</h3>
                {emailConfigs.length > 0 && (
                  <button
                    type="button"
                    onClick={handleDeleteAllConfigs}
                    className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100"
                  >
                    Alle löschen
                  </button>
                )}
              </div>
              {emailConfigs.length === 0 ? (
                <p className="text-sm text-gray-500">Keine Konfigurationen vorhanden</p>
              ) : (
                <div className="space-y-2">
                  {emailConfigs.map((config) => (
                    <div
                      key={config.id}
                      className={`flex items-center justify-between rounded-lg border p-4 ${
                        config.isActive ? 'border-green-500 bg-green-50' : 'border-gray-200'
                      }`}
                    >
                      <div>
                        <div className="font-medium">
                          {config.name}
                          {config.isActive && (
                            <span className="ml-2 rounded bg-green-500 px-2 py-1 text-xs text-white">
                              Aktiv
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-600">
                          {config.type} - {config.email}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            const email = prompt('Bitte geben Sie eine Test-E-Mail-Adresse ein:', testConfigEmail || '')
                            if (email) {
                              setTestConfigEmail(email)
                              handleTestConfig(config.id)
                            }
                          }}
                          className="rounded-lg bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-700"
                          title="Konfiguration testen"
                        >
                          {testingConfig ? '⏳ Teste...' : '🧪 Testen'}
                        </button>
                        <button
                          onClick={() => handleEditConfig(config)}
                          className="rounded-lg bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
                        >
                          Bearbeiten
                        </button>
                        <button
                          onClick={() => handleDeleteConfig(config.id)}
                          className="rounded-lg bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700"
                        >
                          Löschen
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
