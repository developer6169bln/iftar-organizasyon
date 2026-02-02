'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

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

export default function DashboardProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newProjectName, setNewProjectName] = useState('')
  const [creating, setCreating] = useState(false)
  const [selectedProject, setSelectedProject] = useState<ProjectDetail | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [loadingMembers, setLoadingMembers] = useState(false)
  const [addMemberUserId, setAddMemberUserId] = useState('')
  const [allUsers, setAllUsers] = useState<{ id: string; email: string; name: string }[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [registerUser, setRegisterUser] = useState({ name: '', email: '', password: '' })
  const [registering, setRegistering] = useState(false)

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
        }
      } catch {
        setError('Projekte konnten nicht geladen werden')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  useEffect(() => {
    if (!selectedProject?.id) return
    setLoadingMembers(true)
    fetch(`/api/projects/${selectedProject.id}/members`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : []))
      .then(setMembers)
      .finally(() => setLoadingMembers(false))
    if (selectedProject.isOwner || isAdmin) {
      fetch('/api/users', { credentials: 'include' })
        .then((r) => (r.ok ? r.json() : []))
        .then((users: { id: string; email: string; name: string }[]) => setAllUsers(users))
        .catch(() => {})
    }
  }, [selectedProject?.id, selectedProject?.isOwner, isAdmin])

  const loadProjectDetail = async (id: string) => {
    const res = await fetch(`/api/projects/${id}`, { credentials: 'include' })
    if (res.ok) setSelectedProject(await res.json())
  }

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newProjectName.trim()) return
    setCreating(true)
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newProjectName.trim() }),
        credentials: 'include',
      })
      if (res.ok) {
        const created = await res.json()
        setProjects((prev) => [...prev, { ...created, isOwner: true }])
        setNewProjectName('')
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
        body: JSON.stringify({ userId: addMemberUserId.trim(), role: 'MEMBER' }),
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
      if (res.ok) setMembers((prev) => prev.filter((m) => m.userId !== userId))
    } catch {
      alert('Mitglied konnte nicht entfernt werden')
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
        const err = await createRes.json()
        alert(err.error || 'Benutzer konnte nicht angelegt werden')
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
        const err = await addRes.json()
        alert(err.error || 'Benutzer wurde angelegt, konnte aber nicht zum Projekt hinzugefügt werden.')
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
            <h1 className="text-2xl font-bold text-gray-900">Projekte</h1>
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

            <form onSubmit={handleCreateProject} className="mt-6 flex gap-2">
              <input
                type="text"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="Neues Projekt"
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={creating || !newProjectName.trim()}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {creating ? '…' : 'Anlegen'}
              </button>
            </form>
          </div>

          <div className="rounded-xl bg-white p-6 shadow">
            {selectedProject ? (
              <>
                <h2 className="mb-4 text-lg font-semibold text-gray-900">{selectedProject.name}</h2>
                <p className="mb-4 text-sm text-gray-600">
                  Events: {selectedProject._count?.events ?? 0} · Mitglieder: {selectedProject._count?.members ?? members.length}
                </p>

                {(selectedProject.isOwner || isAdmin) && (
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

                <h3 className="mb-2 text-sm font-medium text-gray-700">Mitglieder</h3>
                {loadingMembers ? (
                  <p className="text-sm text-gray-500">Laden…</p>
                ) : (
                  <ul className="space-y-2">
                    {members.map((m) => (
                      <li
                        key={m.id}
                        className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2"
                      >
                        <div>
                          <span className="font-medium">{m.user.name}</span>
                          <span className="ml-2 text-sm text-gray-500">{m.user.email}</span>
                          <span className="ml-2 text-xs text-gray-400">({m.role})</span>
                        </div>
                        {(selectedProject.isOwner || isAdmin) && (
                          <button
                            type="button"
                            onClick={() => handleRemoveMember(m.userId)}
                            className="text-sm text-red-600 hover:underline"
                          >
                            Entfernen
                          </button>
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

        <p className="mt-8 text-sm text-gray-500">
          <strong>Sie sind Administrator nur für Ihren Account.</strong> Sie sehen und verwalten ausschließlich Ihre eigenen Projekte sowie alle Gäste, Aufgaben und Listen, die Sie dort anlegen. Sie haben vollen Zugriff auf Ihre Projekte und können Projektmitarbeiter hinzufügen. Neue Benutzer registrieren Sie oben und fügen sie dem Projekt hinzu.
        </p>
      </main>
    </div>
  )
}
