'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

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
  const [editingTemplate, setEditingTemplate] = useState<any>(null)
  const [templateForm, setTemplateForm] = useState({
    name: '',
    language: 'de',
    subject: '',
    body: '',
    plainText: '',
    isDefault: false,
  })
  const [configForm, setConfigForm] = useState({
    name: '',
    type: 'GMAIL' as 'GMAIL' | 'ICLOUD' | 'IMAP' | 'MAILGUN',
    email: '',
    appPassword: '',
    password: '',
    smtpHost: '',
    smtpPort: 587,
    imapHost: '',
    imapPort: 993,
    mailgunDomain: '',
    mailgunApiKey: '',
    mailgunRegion: 'US' as 'US' | 'EU',
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

  // Lade Einladungen neu, wenn Tab "list" aktiviert wird
  useEffect(() => {
    if (activeTab === 'list' && eventId) {
      loadInvitations(eventId)
    }
  }, [activeTab, eventId])

  // Polling: Lade Einladungen alle 5 Sekunden, wenn Tab "list" aktiv ist
  useEffect(() => {
    if (activeTab !== 'list' || !eventId) return

    const interval = setInterval(() => {
      loadInvitations(eventId)
    }, 5000) // Alle 5 Sekunden

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

    // Prüfe alle 2 Sekunden auf Updates
    const updateCheckInterval = setInterval(checkForUpdates, 2000)

    return () => {
      window.removeEventListener('invitation-updated', handleInvitationUpdate)
      clearInterval(updateCheckInterval)
    }
  }, [activeTab, eventId])

  const loadData = async () => {
    try {
      setLoading(true)
      
      // Lade Events (für eventId)
      const eventsRes = await fetch('/api/events')
      if (eventsRes.ok) {
        const eventData = await eventsRes.json()
        
        // API gibt entweder ein einzelnes Event oder ein Array zurück
        let event = null
        if (Array.isArray(eventData)) {
          event = eventData.length > 0 ? eventData[0] : null
        } else {
          event = eventData
        }
        
        if (event && event.id) {
          setEventId(event.id)
          await Promise.all([
            loadGuests(event.id),
            loadInvitations(event.id),
            loadTemplates(),
            loadEmailConfigs(),
          ])
        }
      }
    } catch (error) {
      console.error('Fehler beim Laden:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadGuests = async (evId: string) => {
    try {
      const response = await fetch(`/api/guests?eventId=${evId}`)
      if (response.ok) {
        const data = await response.json()
        setGuests(data.filter((g: any) => g.email)) // Nur Gäste mit Email
      }
    } catch (error) {
      console.error('Fehler beim Laden der Gäste:', error)
    }
  }

  const loadInvitations = async (evId: string) => {
    try {
      const response = await fetch(`/api/invitations/list?eventId=${evId}`)
      if (response.ok) {
        const data = await response.json()
        setInvitations(data)
      }
    } catch (error) {
      console.error('Fehler beim Laden der Einladungen:', error)
    }
  }

  const loadTemplates = async () => {
    try {
      const response = await fetch('/api/email-templates')
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
      const response = await fetch('/api/email-config')
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

      if (configForm.type === 'MAILGUN' && (!configForm.mailgunDomain || !configForm.mailgunApiKey)) {
        alert('Mailgun Domain und API Key sind erforderlich')
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
          appPassword: '',
          password: '',
          smtpHost: '',
          smtpPort: 587,
          imapHost: '',
          imapPort: 993,
          mailgunDomain: '',
          mailgunApiKey: '',
          mailgunRegion: 'US',
          isActive: false,
        })
        setEditingConfig(null)
        alert('Email-Konfiguration gespeichert')
      } else {
        const error = await response.json()
        alert('Fehler: ' + (error.error || 'Unbekannter Fehler'))
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
      appPassword: '',
      password: '',
      smtpHost: config.smtpHost || '',
      smtpPort: config.smtpPort || 587,
      imapHost: config.imapHost || '',
      imapPort: config.imapPort || 993,
      mailgunDomain: config.mailgunDomain || '',
      mailgunApiKey: '',
      mailgunRegion: (config.mailgunRegion || 'US') as 'US' | 'EU',
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
        const detailsMsg = result.details ? `\n\nDetails: ${result.details}` : ''
        alert(`❌ Fehler: ${errorMsg}${detailsMsg}`)
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
      subject: template.subject,
      body: template.body,
      plainText: template.plainText || '',
      isDefault: template.isDefault || false,
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

  const handleCreateDefaultTemplates = async () => {
    if (!confirm('Möchten Sie Standard-Templates für alle Sprachen erstellen?')) {
      return
    }

    try {
      const defaultTemplates = [
        {
          name: 'Standard Einladung (Deutsch)',
          language: 'de',
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

  const handleSendTestEmail = async () => {
    if (!testEmailForm.email || !testEmailForm.templateId) {
      alert('Bitte geben Sie eine E-Mail-Adresse ein und wählen Sie ein Template aus')
      return
    }

    // Lade Event, falls nicht vorhanden
    let currentEventId = eventId
    if (!currentEventId) {
      try {
        const eventsRes = await fetch('/api/events')
        if (!eventsRes.ok) {
          throw new Error('Fehler beim Laden der Events')
        }
        const eventData = await eventsRes.json()
        
        // API gibt entweder ein einzelnes Event oder ein Array zurück
        let event = null
        if (Array.isArray(eventData)) {
          event = eventData.length > 0 ? eventData[0] : null
        } else {
          event = eventData
        }
        
        if (!event || !event.id) {
          alert('Kein Event gefunden. Bitte erstellen Sie zuerst ein Event.')
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
      const response = await fetch('/api/invitations/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guestIds: selectedGuests,
          templateId: selectedTemplate || null,
          language: selectedLanguage,
          eventId,
        }),
      })

      const result = await response.json()
      
      if (response.ok) {
        alert(`Einladungen gesendet: ${result.successful} erfolgreich, ${result.failed} fehlgeschlagen`)
        setSelectedGuests([])
        await loadInvitations(eventId)
        
        // Benachrichtige Gästeliste über Update
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('email-sent-update', Date.now().toString())
          window.dispatchEvent(new Event('email-sent'))
        }
      } else {
        alert('Fehler: ' + result.error)
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
      setEditingValue(String(currentValue || ''))
    }
  }

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

  const handleCellCancel = () => {
    setEditingCell(null)
    setEditingValue('')
  }

  const getResponseStats = () => {
    const accepted = invitations.filter(i => i.response === 'ACCEPTED').length
    const declined = invitations.filter(i => i.response === 'DECLINED').length
    const pending = invitations.filter(i => i.response === 'PENDING' || !i.response).length
    const opened = invitations.filter(i => i.openedAt).length
    return { accepted, declined, pending, opened, total: invitations.length }
  }

  const stats = getResponseStats()

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
            
            {/* Statistiken */}
            <div className="mb-6 grid grid-cols-4 gap-4">
              <div className="rounded-lg bg-green-50 p-4">
                <div className="text-2xl font-bold text-green-600">{stats.accepted}</div>
                <div className="text-sm text-gray-600">Zusagen</div>
              </div>
              <div className="rounded-lg bg-red-50 p-4">
                <div className="text-2xl font-bold text-red-600">{stats.declined}</div>
                <div className="text-sm text-gray-600">Absagen</div>
              </div>
              <div className="rounded-lg bg-yellow-50 p-4">
                <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
                <div className="text-sm text-gray-600">Ausstehend</div>
              </div>
              <div className="rounded-lg bg-blue-50 p-4">
                <div className="text-2xl font-bold text-blue-600">{stats.opened}</div>
                <div className="text-sm text-gray-600">Gelesen</div>
              </div>
            </div>

            {/* Template-Auswahl */}
            <div className="mb-4">
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Sprache / Template
              </label>
              <select
                value={selectedLanguage}
                onChange={(e) => {
                  setSelectedLanguage(e.target.value)
                  const defaultTemplate = templates.find(
                    (t: any) => t.language === e.target.value && t.isDefault
                  )
                  setSelectedTemplate(defaultTemplate?.id || '')
                }}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              >
                <option value="de">Deutsch</option>
                <option value="tr">Türkisch</option>
                <option value="en">Englisch</option>
                <option value="ar">Arabisch</option>
              </select>
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
                      {guest.name} ({guest.email})
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
              <h2 className="text-xl font-semibold">Einladungsliste</h2>
              <button
                onClick={() => eventId && loadInvitations(eventId)}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
                title="Liste aktualisieren"
              >
                🔄 Aktualisieren
              </button>
            </div>
            
            {/* Auswahl-Info und Bulk-Aktionen */}
            {selectedInvitations.length > 0 && (
              <div className="mb-4 rounded-lg bg-indigo-50 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-indigo-900">
                    {selectedInvitations.length} Einladung(en) ausgewählt
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        if (confirm(`Möchten Sie wirklich ${selectedInvitations.length} Einladung(en) erneut senden?`)) {
                          // TODO: Implementiere erneutes Senden
                          alert('Funktion wird noch implementiert')
                        }
                      }}
                      className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700"
                    >
                      Erneut senden
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

            {/* Filter */}
            <div className="mb-4 flex gap-2">
              <button
                onClick={() => {
                  loadInvitations(eventId)
                  setSelectedInvitations([])
                }}
                className="rounded-lg bg-gray-200 px-4 py-2 text-sm hover:bg-gray-300"
              >
                Alle
              </button>
              <button
                onClick={() => {
                  fetch(`/api/invitations/list?eventId=${eventId}&response=ACCEPTED`)
                    .then(r => r.json())
                    .then(setInvitations)
                    .then(() => setSelectedInvitations([]))
                }}
                className="rounded-lg bg-green-100 px-4 py-2 text-sm text-green-700 hover:bg-green-200"
              >
                Zusagen
              </button>
              <button
                onClick={() => {
                  fetch(`/api/invitations/list?eventId=${eventId}&response=DECLINED`)
                    .then(r => r.json())
                    .then(setInvitations)
                    .then(() => setSelectedInvitations([]))
                }}
                className="rounded-lg bg-red-100 px-4 py-2 text-sm text-red-700 hover:bg-red-200"
              >
                Absagen
              </button>
              <button
                onClick={() => {
                  fetch(`/api/invitations/list?eventId=${eventId}&response=PENDING`)
                    .then(r => r.json())
                    .then(setInvitations)
                    .then(() => setSelectedInvitations([]))
                }}
                className="rounded-lg bg-yellow-100 px-4 py-2 text-sm text-yellow-700 hover:bg-yellow-200"
              >
                Ausstehend
              </button>
            </div>

            {/* Tabelle */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500">
                      <input
                        type="checkbox"
                        checked={invitations.length > 0 && selectedInvitations.length === invitations.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedInvitations(invitations.map((inv: any) => inv.id))
                          } else {
                            setSelectedInvitations([])
                          }
                        }}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        title="Alle auswählen"
                      />
                      <div className="mt-1 text-xs">Auswahl Einladung</div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Gast
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Email
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500">
                      VIP
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500">
                      Einladung E-Mail
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500">
                      Einladung Post
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500">
                      Nimmt Teil
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
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {invitations.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="px-4 py-8 text-center text-sm text-gray-500">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <p className="text-lg font-medium">Keine Einladungen vorhanden</p>
                          <p className="text-sm text-gray-400">
                            Aktivieren Sie die Checkbox "Einladungsliste" in der Gästeliste, um Gäste zur Einladungsliste hinzuzufügen.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    invitations.map((invitation) => (
                    <tr key={invitation.id}>
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
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                        {invitation.guest?.name}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                        {invitation.guest?.email}
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
                          checked={!!invitation.sentAt}
                          disabled
                          className="rounded border-gray-300 text-gray-400"
                          title={invitation.sentAt ? `Gesendet: ${new Date(invitation.sentAt).toLocaleString('de-DE')}` : 'Nicht gesendet'}
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
                    </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
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
                    Verfügbare Platzhalter: GUEST_NAME, EVENT_TITLE
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
                    Verfügbare Platzhalter: GUEST_NAME, EVENT_TITLE, EVENT_DATE, EVENT_LOCATION, ACCEPT_LINK, DECLINE_LINK
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
              <h3 className="mb-4 text-lg font-medium">Vorhandene Templates</h3>
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
                      className={`flex items-center justify-between rounded-lg border p-4 ${
                        template.isDefault ? 'border-green-500 bg-green-50' : 'border-gray-200'
                      }`}
                    >
                      <div>
                        <div className="font-medium">
                          {template.name}
                          {template.isDefault && (
                            <span className="ml-2 rounded bg-green-500 px-2 py-1 text-xs text-white">
                              Standard
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-600">
                          {template.language.toUpperCase()} - {template.subject}
                        </div>
                      </div>
                      <div className="flex gap-2">
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
                    onChange={(e) => setConfigForm({ ...configForm, type: e.target.value as 'GMAIL' | 'ICLOUD' | 'IMAP' | 'MAILGUN' })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2"
                  >
                    <option value="GMAIL">Gmail</option>
                    <option value="ICLOUD">iCloud Mail</option>
                    <option value="IMAP">Eigener Mail-Server (SMTP/IMAP)</option>
                    <option value="MAILGUN">Mailgun (API)</option>
                  </select>
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
                ) : configForm.type === 'MAILGUN' ? (
                  <>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        Mailgun Domain *
                      </label>
                      <input
                        type="text"
                        value={configForm.mailgunDomain}
                        onChange={(e) => setConfigForm({ ...configForm, mailgunDomain: e.target.value })}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2"
                        placeholder="mg.deinedomain.de"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Die Domain, die in Mailgun verifiziert ist (z.B. <span className="font-mono">mg.example.com</span>).
                      </p>
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        Mailgun Region *
                      </label>
                      <select
                        value={configForm.mailgunRegion}
                        onChange={(e) => setConfigForm({ ...configForm, mailgunRegion: e.target.value as 'US' | 'EU' })}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2"
                      >
                        <option value="US">US (api.mailgun.net)</option>
                        <option value="EU">EU (api.eu.mailgun.net)</option>
                      </select>
                      <p className="mt-1 text-xs text-gray-500">
                        Wählen Sie die Region entsprechend Ihrer Mailgun Domain.
                      </p>
                    </div>

                    <div className="md:col-span-2">
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        Mailgun Private API Key *
                      </label>
                      <div className="flex gap-2">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={configForm.mailgunApiKey}
                          onChange={(e) => setConfigForm({ ...configForm, mailgunApiKey: e.target.value })}
                          className="flex-1 rounded-lg border border-gray-300 px-3 py-2"
                          placeholder="key-..."
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
                        Verwenden Sie den <strong>Private API Key</strong> aus Mailgun (nicht Public).
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        SMTP Host *
                      </label>
                      <input
                        type="text"
                        value={configForm.smtpHost}
                        onChange={(e) => setConfigForm({ ...configForm, smtpHost: e.target.value })}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2"
                        placeholder="smtp.example.com"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        SMTP Port *
                      </label>
                      <input
                        type="number"
                        value={configForm.smtpPort}
                        onChange={(e) => setConfigForm({ ...configForm, smtpPort: parseInt(e.target.value) || 587 })}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2"
                        placeholder="587"
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
                        appPassword: '',
                        password: '',
                        smtpHost: '',
                        smtpPort: 587,
                        imapHost: '',
                        imapPort: 993,
                        mailgunDomain: '',
                        mailgunApiKey: '',
                        mailgunRegion: 'US',
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
