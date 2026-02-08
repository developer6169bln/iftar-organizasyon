'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

const PAGE_IDS = [
  'guests', 'program_flow', 'invitations', 'checkin', 'reports',
  'tischplanung', 'vip-namensschilder', 'push-notifications',   'audit-logs', 'foto-video', 'media-upload',
] as const

const PAGE_LABELS: Record<string, string> = {
  guests: 'Gästeliste',
  program_flow: 'Programm-Ablauf',
  invitations: 'Einladungen',
  checkin: 'Eingangskontrolle',
  reports: 'Berichte',
  tischplanung: 'Tischplanung',
  'vip-namensschilder': 'VIP-Namensschilder',
  'push-notifications': 'Push-Benachrichtigungen',
  'audit-logs': 'Audit-Logs',
  'foto-video': 'Foto & Video',
  'media-upload': 'Media-Upload (Projekt/Event wählen)',
}

type Project = { id: string; name: string; ownerId: string; isOwner: boolean }
type ProjectDetail = Project & { _count?: { events: number; members: number }; owner?: { id: string; email: string; name: string } }
type Member = {
  id: string
  projectId: string
  userId: string
  role: string
  user: { id: string; email: string; name: string }
  categoryPermissions: { categoryId: string; allowed: boolean }[]
  pagePermissions: { pageId: string; allowed: boolean }[]
}
type Category = {
  id: string
  categoryId: string
  name: string
  description?: string | null
  responsibleUserId?: string | null
  responsibleUser?: { id: string; name: string; email: string } | null
  isActive?: boolean
}

export default function DashboardProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newProjectName, setNewProjectName] = useState('')
  const [newEventTitle, setNewEventTitle] = useState('')
  const [newEventDate, setNewEventDate] = useState('')
  const [newEventLocation, setNewEventLocation] = useState('')
  const [newEventDescription, setNewEventDescription] = useState('')
  const [creating, setCreating] = useState(false)
  const [selectedProject, setSelectedProject] = useState<ProjectDetail | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [loadingMembers, setLoadingMembers] = useState(false)
  const [addMemberUserId, setAddMemberUserId] = useState('')
  const [addMemberRole, setAddMemberRole] = useState<'MEMBER' | 'PARTNER' | 'COORDINATOR'>('MEMBER')
  const [allUsers, setAllUsers] = useState<{ id: string; email: string; name: string }[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [registerUser, setRegisterUser] = useState({ name: '', email: '', password: '' })
  const [registering, setRegistering] = useState(false)
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null)
  const [editingMember, setEditingMember] = useState<Member | null>(null)
  const [editRole, setEditRole] = useState('MEMBER')
  const [partnerUserIds, setPartnerUserIds] = useState<string[]>([])
  const [availablePartners, setAvailablePartners] = useState<{ id: string; name: string; email: string }[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [editPageIds, setEditPageIds] = useState<string[]>([])
  const [editCategoryIds, setEditCategoryIds] = useState<string[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [savingMember, setSavingMember] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [editCategoryDescription, setEditCategoryDescription] = useState('')
  const [editCategoryResponsibleUserId, setEditCategoryResponsibleUserId] = useState('')
  const [savingCategory, setSavingCategory] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const [projRes, meRes] = await Promise.all([
          fetch('/api/projects', { credentials: 'include' }),
          fetch('/api/me', { credentials: 'include' }),
        ])
        if (projRes.ok) setProjects(await projRes.json())
        if (meRes.ok) {
          const me = await meRes.json()
          setIsAdmin(!!me.isAdmin)
          if (me?.user?.id) setCurrentUserId(me.user.id)
        }
        fetch('/api/users/available-partners', { credentials: 'include' })
          .then((r) => (r.ok ? r.json() : []))
          .then(setAvailablePartners)
          .catch(() => {})
      } catch {
        setError('Projekte konnten nicht geladen werden')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  useEffect(() => {
    const projectId = selectedProject?.id
    const url = projectId ? `/api/categories?projectId=${encodeURIComponent(projectId)}` : '/api/categories'
    fetch(url, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : []))
      .then((list: Category[]) => setCategories(list.filter((c) => c.isActive !== false)))
      .catch(() => {})
  }, [selectedProject?.id])

  useEffect(() => {
    if (!selectedProject?.id) return
    setLoadingMembers(true)
    fetch(`/api/projects/${selectedProject.id}/members`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : []))
      .then(setMembers)
      .finally(() => setLoadingMembers(false))
    const canManage = selectedProject?.isOwner || isAdmin || (!!currentUserId && members.some((m) => m.userId === currentUserId && m.role === 'PARTNER'))
    if (canManage) {
      fetch('/api/users', { credentials: 'include' })
        .then((r) => (r.ok ? r.json() : []))
        .then((users: { id: string; email: string; name: string }[]) => setAllUsers(users))
        .catch(() => {})
    }
  }, [selectedProject?.id, selectedProject?.isOwner, isAdmin, currentUserId, members])

  useEffect(() => {
    if (!editingMember) return
    setEditRole(editingMember.role || 'MEMBER')
    setEditPageIds(editingMember.pagePermissions.filter((p) => p.allowed).map((p) => p.pageId))
    setEditCategoryIds(editingMember.categoryPermissions.filter((c) => c.allowed).map((c) => c.categoryId))
  }, [editingMember])

  useEffect(() => {
    if (!editingCategory) return
    setEditCategoryDescription(editingCategory.description ? String(editingCategory.description) : '')
    setEditCategoryResponsibleUserId(editingCategory.responsibleUserId ? String(editingCategory.responsibleUserId) : '')
  }, [editingCategory])

  const handleSaveCategoryDetails = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingCategory || !selectedProject?.id) return
    setSavingCategory(true)
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(selectedProject.id)}/category-settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          categoryId: editingCategory.categoryId,
          description: editCategoryDescription,
          responsibleUserId: editCategoryResponsibleUserId,
        }),
      })
      if (res.ok) {
        // Kategorien neu laden, damit effektive (projektbezogene) Werte angezeigt werden
        const url = `/api/categories?projectId=${encodeURIComponent(selectedProject.id)}`
        const refreshed = await fetch(url, { credentials: 'include' }).then((r) => (r.ok ? r.json() : []))
        setCategories((refreshed as Category[]).filter((c) => c.isActive !== false))
        setEditingCategory(null)
      } else {
        const data = await res.json().catch(() => ({}))
        alert(data.error || 'Kategorie konnte nicht aktualisiert werden')
      }
    } catch {
      alert('Kategorie konnte nicht aktualisiert werden')
    } finally {
      setSavingCategory(false)
    }
  }

  const loadProjectDetail = async (id: string) => {
    setError(null)
    const res = await fetch(`/api/projects/${id}`, { credentials: 'include' })
    if (res.ok) {
      setSelectedProject(await res.json())
    } else {
      const data = await res.json().catch(() => ({}))
      let msg = data.error || `Projekt konnte nicht geladen werden (${res.status})`
      if (data.details) msg += ` – ${data.details}`
      setError(msg)
      setSelectedProject(null)
    }
  }

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newProjectName.trim()) return
    if (!newEventTitle.trim()) {
      setError('Bitte Event-Titel angeben (unter welchem Titel findet das Event statt?).')
      return
    }
    if (!newEventLocation.trim()) {
      setError('Bitte Event-Ort angeben (wo findet das Event statt?).')
      return
    }
    setCreating(true)
    setError(null)
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newProjectName.trim(),
          eventTitle: newEventTitle.trim(),
          eventDate: newEventDate || undefined,
          eventLocation: newEventLocation.trim(),
          eventDescription: newEventDescription.trim() || undefined,
          partnerUserIds: partnerUserIds.length ? partnerUserIds : undefined,
        }),
        credentials: 'include',
      })
      if (res.ok) {
        const created = await res.json()
        setProjects((prev) => [...prev, { ...created, isOwner: true }])
        setNewProjectName('')
        setNewEventTitle('')
        setNewEventDate('')
        setNewEventLocation('')
        setNewEventDescription('')
        setPartnerUserIds([])
        await loadProjectDetail(created.id)
      } else {
        const data = await res.json()
        let msg = data.error || 'Projekt konnte nicht erstellt werden'
        if (data.details) msg += '\n' + data.details
        if (data.hint) msg += '\n\n' + data.hint
        setError(msg)
      }
    } catch {
      setError('Projekt konnte nicht erstellt werden')
    } finally {
      setCreating(false)
    }
  }

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProject?.id || !addMemberUserId.trim()) return
    try {
      const res = await fetch(`/api/projects/${selectedProject.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: addMemberUserId.trim(), role: addMemberRole || 'MEMBER' }),
        credentials: 'include',
      })
      if (res.ok) {
        const member = await res.json()
        setMembers((prev) => [...prev, member])
        setAddMemberUserId('')
      } else {
        const data = await res.json()
        alert(data.error || 'Mitglied konnte nicht hinzugefügt werden')
      }
    } catch {
      alert('Mitglied konnte nicht hinzugefügt werden')
    }
  }

  const handleRemoveMember = async (userId: string) => {
    if (!selectedProject?.id || !confirm('Mitglied wirklich entfernen?')) return
    try {
      const res = await fetch(`/api/projects/${selectedProject.id}/members?userId=${encodeURIComponent(userId)}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (res.ok) {
        setMembers((prev) => prev.filter((m) => m.userId !== userId))
        if (editingMember?.userId === userId) setEditingMember(null)
      }
    } catch {
      alert('Mitglied konnte nicht entfernt werden')
    }
  }

  const handleSaveMemberPermissions = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProject?.id || !editingMember) return
    setSavingMember(true)
    try {
      const res = await fetch(`/api/projects/${selectedProject.id}/members`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          userId: editingMember.userId,
          role: editRole,
          pageIds: editPageIds,
          categoryIds: editCategoryIds,
        }),
      })
      if (res.ok) {
        const updated = await res.json()
        setMembers((prev) => prev.map((m) => (m.userId === editingMember.userId ? updated : m)))
        setEditingMember(null)
      } else {
        const data = await res.json()
        alert(data.error || 'Berechtigungen konnten nicht gespeichert werden')
      }
    } catch {
      alert('Berechtigungen konnten nicht gespeichert werden')
    } finally {
      setSavingMember(false)
    }
  }

  const toggleEditPage = (pageId: string) => {
    setEditPageIds((prev) =>
      prev.includes(pageId) ? prev.filter((id) => id !== pageId) : [...prev, pageId]
    )
  }
  const toggleEditCategory = (categoryId: string) => {
    setEditCategoryIds((prev) =>
      prev.includes(categoryId) ? prev.filter((id) => id !== categoryId) : [...prev, categoryId]
    )
  }

  const handleDeleteProject = async (projectId: string, projectName: string) => {
    if (!confirm(`Projekt „${projectName}“ wirklich löschen? Alle zugehörigen Events werden vom Projekt getrennt (Daten bleiben), Mitglieder und Projekt-Einträge werden entfernt.`)) return
    setDeletingProjectId(projectId)
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (res.ok) {
        setProjects((prev) => prev.filter((p) => p.id !== projectId))
        if (selectedProject?.id === projectId) {
          setSelectedProject(null)
          setMembers([])
          if (typeof window !== 'undefined') localStorage.removeItem('dashboard-project-id')
        }
      } else {
        const data = await res.json()
        alert(data.error || 'Projekt konnte nicht gelöscht werden')
      }
    } catch {
      alert('Projekt konnte nicht gelöscht werden')
    } finally {
      setDeletingProjectId(null)
    }
  }

  const handleRegisterAndAddMember = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProject?.id || !registerUser.name.trim() || !registerUser.email.trim() || registerUser.password.length < 6) return
    setRegistering(true)
    try {
      const createRes = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: registerUser.name.trim(),
          email: registerUser.email.trim(),
          password: registerUser.password,
          role: 'COORDINATOR',
        }),
      })
      if (!createRes.ok) {
        const err = await createRes.json().catch(() => ({}))
        const msg = err.error || 'Benutzer konnte nicht angelegt werden'
        alert(err.details ? `${msg}\n\n${err.details}` : msg)
        setRegistering(false)
        return
      }
      const newUser = await createRes.json()
      const addRes = await fetch(`/api/projects/${selectedProject.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId: newUser.id, role: 'MEMBER' }),
      })
      if (addRes.ok) {
        const member = await addRes.json()
        setMembers((prev) => [...prev, member])
        setAllUsers((prev) => [...prev, { id: newUser.id, name: newUser.name, email: newUser.email }])
        setRegisterUser({ name: '', email: '', password: '' })
      } else {
        const err = await addRes.json().catch(() => ({}))
        const msg = err.error || 'Benutzer wurde angelegt, konnte aber nicht zum Projekt hinzugefügt werden.'
        alert(err.details ? `${msg}\n\n${err.details}` : msg)
      }
    } catch {
      alert('Registrierung fehlgeschlagen')
    } finally {
      setRegistering(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-gray-500">Projekte werden geladen…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Admin-Bereich: Projekte & Projektmitarbeiter</h1>
              <p className="mt-1 text-sm text-gray-600">Projektmitarbeiter anlegen, Projekten zuweisen, Rollen und Berechtigungen (nur in Ihren Projekten) vergeben.</p>
            </div>
            <Link
              href="/dashboard"
              className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
            >
              ← Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-6 whitespace-pre-wrap rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
            {error}
          </div>
        )}

        {projects.length === 0 && !loading && (
          <div className="mb-6 rounded-lg border border-indigo-200 bg-indigo-50 p-4 text-indigo-800">
            <strong>Ihr Admin-Bereich.</strong> Noch keine Projekte? Legen Sie unten mit „Neues Projekt“ Ihr erstes Projekt an. Danach können Sie dort Projektmitarbeiter hinzufügen und Rollen sowie Berechtigungen vergeben. Falls Sie noch nicht freigeschaltet sind, weist der App-Betreiber Ihrem Konto eine Edition zu.
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-2">
          <div className="rounded-xl bg-white p-6 shadow">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Meine Projekte</h2>
            <ul className="space-y-2">
              {projects.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => loadProjectDetail(p.id)}
                    className={`w-full rounded-lg border px-4 py-3 text-left transition ${
                      selectedProject?.id === p.id
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <span className="font-medium">{p.name}</span>
                    {p.isOwner && (
                      <span className="ml-2 text-xs text-gray-500">(Inhaber)</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>

            <form onSubmit={handleCreateProject} className="mt-6 space-y-4">
              <p className="text-sm text-gray-600">
                Jedes Projekt hat ein Event – Einladungen gelten für dieses Event. Bitte Titel, Datum und Ort angeben.
              </p>
              <div className="grid gap-3 sm:grid-cols-1">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">Projektname</label>
                  <input
                    type="text"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="z. B. Iftar 2026"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">Event-Titel *</label>
                  <input
                    type="text"
                    value={newEventTitle}
                    onChange={(e) => setNewEventTitle(e.target.value)}
                    placeholder="z. B. Iftar-Essen Titanic Hotel"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">Wann (Datum) *</label>
                  <input
                    type="date"
                    value={newEventDate}
                    onChange={(e) => setNewEventDate(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">Wo (Ort) *</label>
                  <input
                    type="text"
                    value={newEventLocation}
                    onChange={(e) => setNewEventLocation(e.target.value)}
                    placeholder="z. B. Titanic Hotel, Berlin"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">Beschreibung (optional)</label>
                  <input
                    type="text"
                    value={newEventDescription}
                    onChange={(e) => setNewEventDescription(e.target.value)}
                    placeholder="Kurze Beschreibung"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                {availablePartners.length > 0 && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500">Partner (weitere Hauptbenutzer mit gleichen Rechten)</label>
                    <p className="mb-2 text-xs text-gray-500">Diese Nutzer können das Projekt gemeinsam mit Ihnen verwalten (gleiche Rechte wie Inhaber).</p>
                    <div className="max-h-32 space-y-1 overflow-y-auto rounded border border-gray-200 p-2">
                      {availablePartners.map((u) => (
                        <label key={u.id} className="flex cursor-pointer items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={partnerUserIds.includes(u.id)}
                            onChange={(e) => setPartnerUserIds((prev) => (e.target.checked ? [...prev, u.id] : prev.filter((id) => id !== u.id)))}
                            className="rounded border-gray-300"
                          />
                          {u.name} ({u.email})
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={creating || !newProjectName.trim() || !newEventTitle.trim() || !newEventLocation.trim()}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {creating ? '…' : 'Projekt & Event anlegen'}
                </button>
              </div>
            </form>
          </div>

          <div className="rounded-xl bg-white p-6 shadow">
            {selectedProject ? (
              <>
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">{selectedProject.name}</h2>
                    <p className="mt-1 text-sm text-gray-600">
                      Events: {selectedProject._count?.events ?? 0} · Mitglieder: {selectedProject._count?.members ?? members.length}
                    </p>
                  </div>
                  {(selectedProject.isOwner || isAdmin || (!!currentUserId && members.some((m) => m.userId === currentUserId && m.role === 'PARTNER'))) && (
                    <button
                      type="button"
                      onClick={() => handleDeleteProject(selectedProject.id, selectedProject.name)}
                      disabled={!!deletingProjectId}
                      className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                    >
                      {deletingProjectId === selectedProject.id ? '…' : 'Projekt löschen'}
                    </button>
                  )}
                </div>

                {(selectedProject.isOwner || isAdmin || (!!currentUserId && members.some((m) => m.userId === currentUserId && m.role === 'PARTNER'))) && (
                  <>
                    <h3 className="mb-2 text-sm font-medium text-gray-700">Neuen Benutzer registrieren und zum Projekt hinzufügen</h3>
                    <form onSubmit={handleRegisterAndAddMember} className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
                      <div className="mb-2 grid grid-cols-1 gap-2 sm:grid-cols-4">
                        <input
                          type="text"
                          value={registerUser.name}
                          onChange={(e) => setRegisterUser((u) => ({ ...u, name: e.target.value }))}
                          placeholder="Name"
                          className="rounded border border-gray-300 px-2 py-1.5 text-sm"
                        />
                        <input
                          type="email"
                          value={registerUser.email}
                          onChange={(e) => setRegisterUser((u) => ({ ...u, email: e.target.value }))}
                          placeholder="E-Mail"
                          className="rounded border border-gray-300 px-2 py-1.5 text-sm"
                        />
                        <input
                          type="password"
                          value={registerUser.password}
                          onChange={(e) => setRegisterUser((u) => ({ ...u, password: e.target.value }))}
                          placeholder="Passwort (min. 6 Zeichen)"
                          className="rounded border border-gray-300 px-2 py-1.5 text-sm"
                        />
                        <button
                          type="submit"
                          disabled={registering || !registerUser.name.trim() || !registerUser.email.trim() || registerUser.password.length < 6}
                          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                        >
                          {registering ? '…' : 'Registrieren & hinzufügen'}
                        </button>
                      </div>
                    </form>
                    <h3 className="mb-2 text-sm font-medium text-gray-700">Bestehenden Benutzer hinzufügen</h3>
                    {allUsers.filter((u) => !members.some((m) => m.userId === u.id)).length === 0 && (
                      <p className="mb-2 text-xs text-gray-500">Liste leer? Legen Sie zuerst einen Benutzer unten per „Registrieren & hinzufügen“ an.</p>
                    )}
                    <form onSubmit={handleAddMember} className="mb-6 flex gap-2">
                      <select
                        value={addMemberUserId}
                        onChange={(e) => setAddMemberUserId(e.target.value)}
                        className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      >
                        <option value="">— Benutzer wählen —</option>
                        {allUsers
                          .filter((u) => !members.some((m) => m.userId === u.id))
                          .map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name} ({u.email})
                            </option>
                          ))}
                      </select>
                      <select
                        value={addMemberRole}
                        onChange={(e) => setAddMemberRole(e.target.value)}
                        className="w-48 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                        title="Rolle des neuen Mitglieds"
                      >
                        <option value="MEMBER">Mitarbeiter</option>
                        <option value="PARTNER">Partner</option>
                        <option value="COORDINATOR">Koordinator</option>
                      </select>
                      <button
                        type="submit"
                        disabled={!addMemberUserId}
                        className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                      >
                        Hinzufügen
                      </button>
                    </form>
                  </>
                )}

                {(selectedProject.isOwner || isAdmin || (!!currentUserId && members.some((m) => m.userId === currentUserId && m.role === 'PARTNER'))) && (
                  <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <h3 className="text-sm font-medium text-gray-700">Arbeitsbereiche (Kategorien) – Details</h3>
                      <button
                        type="button"
                        onClick={() => {
                          if (!selectedProject?.id) return
                          fetch(`/api/categories?projectId=${encodeURIComponent(selectedProject.id)}`, { credentials: 'include' })
                            .then((r) => (r.ok ? r.json() : []))
                            .then((list: Category[]) => setCategories(list.filter((c) => c.isActive !== false)))
                            .catch(() => {})
                        }}
                        className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
                        title="Kategorien neu laden"
                      >
                        🔄 Neu laden
                      </button>
                    </div>
                    <p className="mb-3 text-xs text-gray-500">
                      Hier können Sie pro Arbeitsbereich die <strong>Beschreibung</strong> und den <strong>Verantwortlichen</strong> ändern.
                    </p>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs text-gray-500">
                            <th className="py-2 pr-3">Arbeitsbereich</th>
                            <th className="py-2 pr-3">Beschreibung</th>
                            <th className="py-2 pr-3">Verantwortlich</th>
                            <th className="py-2 pr-3"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {categories.map((c) => (
                            <tr key={c.id} className="border-t">
                              <td className="py-2 pr-3 font-medium text-gray-900">{c.name}</td>
                              <td className="py-2 pr-3 text-gray-700">{c.description ? c.description : <span className="text-gray-400">—</span>}</td>
                              <td className="py-2 pr-3 text-gray-700">
                                {c.responsibleUser ? (
                                  <>
                                    {c.responsibleUser.name}{' '}
                                    <span className="text-xs text-gray-400">({c.responsibleUser.email})</span>
                                  </>
                                ) : (
                                  <span className="text-gray-400">—</span>
                                )}
                              </td>
                              <td className="py-2 pr-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => setEditingCategory(c)}
                                  className="text-sm font-medium text-indigo-600 hover:underline"
                                >
                                  Bearbeiten
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <h3 className="mb-2 text-sm font-medium text-gray-700">Mitglieder</h3>
                {loadingMembers ? (
                  <p className="text-sm text-gray-500">Laden…</p>
                ) : (
                  <ul className="space-y-2">
                    {selectedProject.owner && (
                      <li className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                        <div>
                          <span className="font-medium">{selectedProject.owner.name}</span>
                          <span className="ml-2 text-sm text-gray-500">{selectedProject.owner.email}</span>
                          <span className="ml-2 text-xs font-medium text-gray-600">Inhaber</span>
                        </div>
                      </li>
                    )}
                    {members.map((m) => (
                      <li
                        key={m.id}
                        className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2"
                      >
                        <div>
                          <span className="font-medium">{m.user.name}</span>
                          <span className="ml-2 text-sm text-gray-500">{m.user.email}</span>
                          <span className="ml-2 text-xs text-gray-400">
                            {m.role === 'PARTNER' ? 'Partner' : m.role === 'COORDINATOR' ? 'Koordinator' : 'Mitarbeiter'}
                          </span>
                        </div>
                        {(selectedProject.isOwner || isAdmin || (!!currentUserId && members.some((me) => me.userId === currentUserId && me.role === 'PARTNER'))) && (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingMember(m)}
                              className="text-sm font-medium text-indigo-600 hover:underline"
                            >
                              Bearbeiten
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveMember(m.userId)}
                              className="text-sm text-red-600 hover:underline"
                            >
                              Entfernen
                            </button>
                          </div>
                        )}
                      </li>
                    ))}
                    {members.length === 0 && !loadingMembers && (
                      <li className="text-sm text-gray-500">Noch keine Projektmitarbeiter.</li>
                    )}
                  </ul>
                )}
              </>
            ) : (
              <p className="text-gray-500">Wählen Sie links ein Projekt aus.</p>
            )}
          </div>
        </div>

        {/* Modal: Mitglied bearbeiten – Rolle & Berechtigungen (nur in diesem Projekt) */}
        {editingMember && selectedProject && (selectedProject.isOwner || isAdmin || (!!currentUserId && members.some((m) => m.userId === currentUserId && m.role === 'PARTNER'))) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
              <h3 className="mb-4 text-lg font-semibold text-gray-900">
                Bearbeiten: {editingMember.user.name}
              </h3>
              <p className="mb-4 text-sm text-gray-600">
                Rolle und Berechtigungen gelten nur für das Projekt „{selectedProject.name}“.
              </p>
              <form onSubmit={handleSaveMemberPermissions} className="space-y-6">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Rolle in diesem Projekt</label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="MEMBER">Mitarbeiter (MEMBER)</option>
                    <option value="PARTNER">Partner (PARTNER) – gleiche Rechte wie Inhaber</option>
                    <option value="COORDINATOR">Koordinator (COORDINATOR)</option>
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Seiten (Zugriff)</label>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {PAGE_IDS.map((pageId) => (
                      <label key={pageId} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={editPageIds.includes(pageId)}
                          onChange={() => toggleEditPage(pageId)}
                          className="rounded border-gray-300"
                        />
                        {PAGE_LABELS[pageId] ?? pageId}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Arbeitsbereiche (Kategorien)</label>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {categories.map((cat) => (
                      <label key={cat.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={editCategoryIds.includes(cat.categoryId)}
                          onChange={() => toggleEditCategory(cat.categoryId)}
                          className="rounded border-gray-300"
                        />
                        {cat.name}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex justify-end gap-2 border-t pt-4">
                  <button
                    type="button"
                    onClick={() => setEditingMember(null)}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Abbrechen
                  </button>
                  <button
                    type="submit"
                    disabled={savingMember}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {savingMember ? '…' : 'Speichern'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Kategorie bearbeiten – Beschreibung & Verantwortliche */}
        {editingCategory && selectedProject && (selectedProject.isOwner || isAdmin) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
              <h3 className="mb-2 text-lg font-semibold text-gray-900">Arbeitsbereich bearbeiten</h3>
              <p className="mb-4 text-sm text-gray-600">
                {editingCategory.name} ({editingCategory.categoryId})
              </p>
              <form onSubmit={handleSaveCategoryDetails} className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Beschreibung</label>
                  <textarea
                    value={editCategoryDescription}
                    onChange={(e) => setEditCategoryDescription(e.target.value)}
                    rows={4}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    placeholder="Beschreibung für diesen Arbeitsbereich"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Verantwortlich</label>
                  <select
                    value={editCategoryResponsibleUserId}
                    onChange={(e) => setEditCategoryResponsibleUserId(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="">— Keine Auswahl —</option>
                    {Array.from(new Map(members.map((m) => [m.user.id, m.user])).values()).map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.email})
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    Hinweis: Verantwortliche gelten nur für das ausgewählte Projekt (nicht global).
                  </p>
                </div>
                <div className="flex justify-end gap-2 border-t pt-4">
                  <button
                    type="button"
                    onClick={() => setEditingCategory(null)}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Abbrechen
                  </button>
                  <button
                    type="submit"
                    disabled={savingCategory}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {savingCategory ? '…' : 'Speichern'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <p className="mt-8 text-sm text-gray-500">
          <strong>Admin-Bereich nur für Ihren Account.</strong> Sie legen Projektmitarbeiter an, weisen sie einzelnen Projekten zu und vergeben Rollen (Mitarbeiter/Koordinator) sowie Berechtigungen (Seiten und Arbeitsbereiche) – diese gelten ausschließlich in Ihren Projekten. Sie sehen keine Benutzer oder Projekte anderer Hauptnutzer.
        </p>
        <p className="mt-2 text-xs text-gray-400">
          Stand: Benutzer anlegen &amp; Berechtigungen (Bearbeiten) aktiv. Projekt wählen → „Neuen Benutzer registrieren und zum Projekt hinzufügen“ oder bei Mitglied „Bearbeiten“ für Rolle und Berechtigungen. Bei Problemen: Seite hart neu laden (Strg+F5 / Cmd+Shift+R) oder Railway Redeploy prüfen.
        </p>
      </main>
    </div>
  )
}
