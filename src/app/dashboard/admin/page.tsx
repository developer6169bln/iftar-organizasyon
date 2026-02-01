'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const PAGE_LABELS: Record<string, string> = {
  invitations: 'Einladungen',
  checkin: 'Eingangskontrolle',
  reports: 'Berichte',
  'audit-logs': 'Audit-Logs',
  'push-notifications': 'Push-Benachrichtigungen',
  'vip-namensschilder': 'VIP-Namensschilder',
  tischplanung: 'Tischplanung',
  guests: 'Gästeliste',
  program_flow: 'Programmablauf',
}

type UserRow = {
  id: string
  name: string
  email: string
  role: string
  editionId: string | null
  editionExpiresAt?: string | null
  edition?: { id: string; code: string; name: string } | null
  categoryPermissions?: { categoryId: string; allowed: boolean }[]
  pagePermissions?: { pageId: string; allowed: boolean }[]
  _count?: { ownedProjects: number }
}

type EditionRow = {
  id: string
  code: string
  name: string
  annualPriceCents: number
  order: number
  categoryIds: string[]
  pageIds: string[]
}

export default function AdminPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [topUsers, setTopUsers] = useState<{ userId: string; name: string; email: string; completedCount: number }[]>([])
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingStats, setLoadingStats] = useState(false)

  const [users, setUsers] = useState<UserRow[]>([])
  const [editions, setEditions] = useState<EditionRow[]>([])
  const [categories, setCategories] = useState<{ id: string; categoryId: string; name: string }[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [loadingEditions, setLoadingEditions] = useState(false)
  const [editionsError, setEditionsError] = useState<string | null>(null)

  const [editUser, setEditUser] = useState<UserRow | null>(null)
  const [editUserForm, setEditUserForm] = useState({
    name: '',
    role: 'COORDINATOR' as string,
    editionId: '' as string | null,
    editionExpiresAt: '' as string,
    categoryOverrides: {} as Record<string, 'edition' | 'allow' | 'deny'>,
    pageOverrides: {} as Record<string, 'edition' | 'allow' | 'deny'>,
  })
  const [savingUser, setSavingUser] = useState(false)
  const [userModalTab, setUserModalTab] = useState<'basic' | 'permissions'>('basic')
  const autoSaveUserTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [editEdition, setEditEdition] = useState<EditionRow | null>(null)
  const [editEditionForm, setEditEditionForm] = useState({
    name: '',
    annualPriceCents: 0,
    categoryIds: [] as string[],
    pageIds: [] as string[],
  })
  const [savingEdition, setSavingEdition] = useState(false)
  const [showAddEdition, setShowAddEdition] = useState(false)
  const [addEditionForm, setAddEditionForm] = useState({
    code: '',
    name: '',
    annualPriceCents: 0,
    categoryIds: [] as string[],
    pageIds: [] as string[],
  })
  const [savingAddEdition, setSavingAddEdition] = useState(false)
  const [showAddMainUser, setShowAddMainUser] = useState(false)
  const [addMainUserForm, setAddMainUserForm] = useState({
    name: '',
    email: '',
    password: '',
    editionId: '' as string,
  })
  const [savingAddMainUser, setSavingAddMainUser] = useState(false)

  useEffect(() => {
    const token =
      typeof document !== 'undefined' &&
      (document.cookie.match(/auth-token=([^;]+)/)?.[1] || localStorage.getItem('auth-token'))
    if (!token) {
      router.push('/login')
      return
    }
    fetch('/api/me', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) setUser(data.user)
        if (data?.isAdmin) setIsAdmin(true)
        if (data && !data.isAdmin) router.push('/dashboard')
      })
      .finally(() => setLoading(false))
  }, [router])

  useEffect(() => {
    if (!isAdmin) return
    setLoadingStats(true)
    const params = new URLSearchParams()
    if (startDate) params.set('startDate', startDate)
    if (endDate) params.set('endDate', endDate)
    fetch(`/api/stats/top-users?${params}`)
      .then((res) => res.json())
      .then((data) => setTopUsers(data.topUsers || []))
      .catch(() => setTopUsers([]))
      .finally(() => setLoadingStats(false))
  }, [isAdmin, startDate, endDate])

  useEffect(() => {
    if (!isAdmin) return
    setLoadingUsers(true)
    fetch('/api/users', { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => (Array.isArray(data) ? setUsers(data) : setUsers([])))
      .catch(() => setUsers([]))
      .finally(() => setLoadingUsers(false))
  }, [isAdmin])

  useEffect(() => {
    if (!isAdmin) return
    setLoadingEditions(true)
    setEditionsError(null)
    fetch('/api/editions', { credentials: 'include' })
      .then((res) => {
        if (!res.ok) return res.json().then((err) => { throw new Error(err?.error || `Fehler ${res.status}`) })
        return res.json()
      })
      .then((data) => {
        if (Array.isArray(data)) setEditions(data)
        else setEditions([])
      })
      .catch((e) => {
        setEditions([])
        setEditionsError(e?.message || 'Editionen konnten nicht geladen werden.')
      })
      .finally(() => setLoadingEditions(false))
  }, [isAdmin])

  useEffect(() => {
    if (!isAdmin) return
    fetch('/api/categories', { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => (Array.isArray(data) ? setCategories(data) : setCategories([])))
      .catch(() => setCategories([]))
  }, [isAdmin])

  const openEditUser = (u: UserRow) => {
    setEditUser(u)
    const catOverrides: Record<string, 'edition' | 'allow' | 'deny'> = {}
    categories.forEach((c) => {
      const p = u.categoryPermissions?.find((x) => x.categoryId === c.categoryId)
      catOverrides[c.categoryId] = p === undefined ? 'edition' : p.allowed ? 'allow' : 'deny'
    })
    const pageOverrides: Record<string, 'edition' | 'allow' | 'deny'> = {}
    allPageIds.forEach((pageId) => {
      const p = u.pagePermissions?.find((x) => x.pageId === pageId)
      pageOverrides[pageId] = p === undefined ? 'edition' : p.allowed ? 'allow' : 'deny'
    })
    setEditUserForm({
      name: u.name,
      role: u.role,
      editionId: u.editionId || '',
      editionExpiresAt: u.editionExpiresAt ? u.editionExpiresAt.slice(0, 10) : '',
      categoryOverrides: catOverrides,
      pageOverrides,
    })
    setUserModalTab('basic')
  }

  useEffect(() => {
    if (!editUser && autoSaveUserTimeoutRef.current) {
      clearTimeout(autoSaveUserTimeoutRef.current)
      autoSaveUserTimeoutRef.current = null
    }
  }, [editUser])

  const setUserCategoryOverride = (categoryId: string, value: 'edition' | 'allow' | 'deny') => {
    setEditUserForm((f) => ({ ...f, categoryOverrides: { ...f.categoryOverrides, [categoryId]: value } }))
    scheduleAutoSaveUser()
  }
  const setUserPageOverride = (pageId: string, value: 'edition' | 'allow' | 'deny') => {
    setEditUserForm((f) => ({ ...f, pageOverrides: { ...f.pageOverrides, [pageId]: value } }))
    scheduleAutoSaveUser()
  }

  const scheduleAutoSaveUser = () => {
    if (!editUser) return
    if (autoSaveUserTimeoutRef.current) clearTimeout(autoSaveUserTimeoutRef.current)
    autoSaveUserTimeoutRef.current = setTimeout(() => {
      autoSaveUserTimeoutRef.current = null
      saveUser(false)
    }, 600)
  }

  const saveUser = async (closeAfterSave = true) => {
    if (!editUser) return
    setSavingUser(true)
    try {
      const categoryPermissions = Object.entries(editUserForm.categoryOverrides)
        .filter(([, v]) => v !== 'edition')
        .map(([categoryId, v]) => ({ categoryId, allowed: v === 'allow' }))
      const pagePermissions = Object.entries(editUserForm.pageOverrides)
        .filter(([, v]) => v !== 'edition')
        .map(([pageId, v]) => ({ pageId, allowed: v === 'allow' }))
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          id: editUser.id,
          name: editUserForm.name,
          role: editUserForm.role,
          editionId: editUserForm.editionId || null,
          editionExpiresAt: editUserForm.editionExpiresAt ? editUserForm.editionExpiresAt : null,
          categoryPermissions,
          pagePermissions,
        }),
      })
      if (res.ok) {
        const updated = await res.json()
        setUsers((prev) => prev.map((u) => (u.id === editUser.id ? updated : u)))
        if (closeAfterSave) setEditUser(null)
      } else {
        const err = await res.json()
        alert(err.error || 'Speichern fehlgeschlagen')
      }
    } catch {
      alert('Speichern fehlgeschlagen')
    } finally {
      setSavingUser(false)
    }
  }

  const openEditEdition = (e: EditionRow) => {
    setEditEdition(e)
    setEditEditionForm({
      name: e.name ?? '',
      annualPriceCents: e.annualPriceCents ?? 0,
      categoryIds: Array.isArray(e.categoryIds) ? [...e.categoryIds] : [],
      pageIds: Array.isArray(e.pageIds) ? [...e.pageIds] : [],
    })
  }

  const toggleCategory = (categoryId: string) => {
    setEditEditionForm((f) => ({
      ...f,
      categoryIds: f.categoryIds.includes(categoryId)
        ? f.categoryIds.filter((id) => id !== categoryId)
        : [...f.categoryIds, categoryId],
    }))
  }

  const togglePage = (pageId: string) => {
    setEditEditionForm((f) => ({
      ...f,
      pageIds: f.pageIds.includes(pageId)
        ? f.pageIds.filter((id) => id !== pageId)
        : [...f.pageIds, pageId],
    }))
  }

  const toggleAddCategory = (categoryId: string) => {
    setAddEditionForm((f) => ({
      ...f,
      categoryIds: f.categoryIds.includes(categoryId)
        ? f.categoryIds.filter((id) => id !== categoryId)
        : [...f.categoryIds, categoryId],
    }))
  }
  const toggleAddPage = (pageId: string) => {
    setAddEditionForm((f) => ({
      ...f,
      pageIds: f.pageIds.includes(pageId)
        ? f.pageIds.filter((id) => id !== pageId)
        : [...f.pageIds, pageId],
    }))
  }

  const saveNewEdition = async () => {
    const code = addEditionForm.code.trim().toUpperCase()
    if (!code || !addEditionForm.name.trim()) {
      alert('Code und Name sind erforderlich.')
      return
    }
    setSavingAddEdition(true)
    try {
      const res = await fetch('/api/editions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          code,
          name: addEditionForm.name.trim(),
          annualPriceCents: addEditionForm.annualPriceCents,
          categoryIds: addEditionForm.categoryIds,
          pageIds: addEditionForm.pageIds,
        }),
      })
      if (res.ok) {
        const created = await res.json()
        setEditions((prev) => [...prev, created])
        setShowAddEdition(false)
        setAddEditionForm({ code: '', name: '', annualPriceCents: 0, categoryIds: [], pageIds: [] })
      } else {
        const err = await res.json()
        alert(err.error || 'Anlegen fehlgeschlagen')
      }
    } catch {
      alert('Anlegen fehlgeschlagen')
    } finally {
      setSavingAddEdition(false)
    }
  }

  const saveEdition = async () => {
    if (!editEdition) return
    setSavingEdition(true)
    try {
      const res = await fetch('/api/editions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          id: editEdition.id,
          name: editEditionForm.name,
          annualPriceCents: editEditionForm.annualPriceCents,
          categoryIds: editEditionForm.categoryIds,
          pageIds: editEditionForm.pageIds,
        }),
      })
      if (res.ok) {
        const updated = await res.json()
        setEditions((prev) => prev.map((e) => (e.id === editEdition.id ? updated : e)))
        setEditEdition(null)
      } else {
        const err = await res.json()
        alert(err.error || 'Speichern fehlgeschlagen')
      }
    } catch {
      alert('Speichern fehlgeschlagen')
    } finally {
      setSavingEdition(false)
    }
  }

  const allPageIds = Object.keys(PAGE_LABELS)

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <p className="text-gray-500">Laden...</p>
      </div>
    )
  }
  if (!isAdmin) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Admin & Statistik</h1>
          <Link
            href="/dashboard"
            className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
          >
            ← Dashboard
          </Link>
        </div>

        {/* Benutzer verwalten */}
        <div className="mb-8 rounded-xl bg-white p-6 shadow">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Benutzer verwalten</h2>
            <button
              type="button"
              onClick={() => setShowAddMainUser(true)}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              + Neuer Hauptbenutzer
            </button>
          </div>
          <p className="mb-4 text-sm text-gray-600">
            Sie sehen und verwalten hier alle User und Hauptbenutzer. Nur Sie können neue Hauptbenutzer anlegen (Edition zuweisen). Wenn Sie jemanden zum Hauptbenutzer ernennen, kann dieser in seiner eigenen Liste selbst Benutzer (Projektmitarbeiter) registrieren und in seinen Projekten verwalten.
          </p>
          {loadingUsers ? (
            <p className="text-gray-500">Benutzer werden geladen...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="py-2 font-medium text-gray-700">Typ</th>
                    <th className="py-2 font-medium text-gray-700">Name</th>
                    <th className="py-2 font-medium text-gray-700">E-Mail</th>
                    <th className="py-2 font-medium text-gray-700">Rolle</th>
                    <th className="py-2 font-medium text-gray-700">Edition</th>
                    <th className="py-2 font-medium text-gray-700">Gültig bis</th>
                    <th className="py-2 font-medium text-gray-700"></th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-gray-100">
                      <td className="py-2">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${u.editionId || (u._count?.ownedProjects ?? 0) > 0 ? 'bg-indigo-100 text-indigo-800' : 'bg-gray-100 text-gray-700'}`}>
                          {u.role === 'ADMIN' ? 'Administrator' : u.editionId || (u._count?.ownedProjects ?? 0) > 0 ? 'Hauptbenutzer' : 'Projektmitarbeiter'}
                        </span>
                      </td>
                      <td className="py-2">{u.name}</td>
                      <td className="py-2 text-gray-600">{u.email}</td>
                      <td className="py-2">{u.role}</td>
                      <td className="py-2">{u.edition?.name ?? '–'}</td>
                      <td className="py-2 text-gray-600">
                        {u.editionExpiresAt ? new Date(u.editionExpiresAt).toLocaleDateString('de-DE') : '–'}
                      </td>
                      <td className="py-2">
                        <button
                          type="button"
                          onClick={() => openEditUser(u)}
                          className="rounded bg-indigo-100 px-2 py-1 text-indigo-700 hover:bg-indigo-200"
                        >
                          Bearbeiten
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal: Neuer Hauptbenutzer */}
        {showAddMainUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
            <div className="my-8 w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
              <h3 className="mb-4 text-lg font-semibold">Neuer Hauptbenutzer anlegen</h3>
              <p className="mb-4 text-sm text-gray-500">
                Hauptbenutzer erhalten eine Edition und können eigene Projekte anlegen sowie eigene Projektmitarbeiter verwalten.
              </p>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Name</label>
                  <input
                    type="text"
                    value={addMainUserForm.name}
                    onChange={(e) => setAddMainUserForm((f) => ({ ...f, name: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                    placeholder="Max Mustermann"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">E-Mail</label>
                  <input
                    type="email"
                    value={addMainUserForm.email}
                    onChange={(e) => setAddMainUserForm((f) => ({ ...f, email: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                    placeholder="max@beispiel.de"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Passwort</label>
                  <input
                    type="password"
                    value={addMainUserForm.password}
                    onChange={(e) => setAddMainUserForm((f) => ({ ...f, password: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                    placeholder="min. 6 Zeichen"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Edition</label>
                  <select
                    value={addMainUserForm.editionId}
                    onChange={(e) => setAddMainUserForm((f) => ({ ...f, editionId: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                  >
                    <option value="">– Bitte wählen –</option>
                    {editions.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name} ({e.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-6 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddMainUser(false)
                    setAddMainUserForm({ name: '', email: '', password: '', editionId: '' })
                  }}
                  className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  disabled={savingAddMainUser || !addMainUserForm.name.trim() || !addMainUserForm.email.trim() || !addMainUserForm.password || addMainUserForm.password.length < 6 || !addMainUserForm.editionId}
                  onClick={async () => {
                    setSavingAddMainUser(true)
                    try {
                      const res = await fetch('/api/users', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({
                          name: addMainUserForm.name.trim(),
                          email: addMainUserForm.email.trim(),
                          password: addMainUserForm.password,
                          role: 'COORDINATOR',
                          editionId: addMainUserForm.editionId || null,
                        }),
                      })
                      if (res.ok) {
                        const created = await res.json()
                        setUsers((prev) => [...prev, { ...created, _count: { ownedProjects: 0 } }])
                        setShowAddMainUser(false)
                        setAddMainUserForm({ name: '', email: '', password: '', editionId: '' })
                      } else {
                        const err = await res.json()
                        alert(err.error || 'Anlegen fehlgeschlagen')
                      }
                    } catch {
                      alert('Anlegen fehlgeschlagen')
                    } finally {
                      setSavingAddMainUser(false)
                    }
                  }}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {savingAddMainUser ? 'Wird angelegt…' : 'Hauptbenutzer anlegen'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Benutzer bearbeiten */}
        {editUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
            <div className="my-8 w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
              <h3 className="mb-4 text-lg font-semibold">Benutzer bearbeiten</h3>
              <p className="mb-4 text-sm text-gray-500">E-Mail: {editUser.email}</p>
              <div className="mb-4 flex gap-2 border-b border-gray-200">
                <button
                  type="button"
                  onClick={() => setUserModalTab('basic')}
                  className={`pb-2 text-sm font-medium ${userModalTab === 'basic' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Stammdaten
                </button>
                <button
                  type="button"
                  onClick={() => setUserModalTab('permissions')}
                  className={`pb-2 text-sm font-medium ${userModalTab === 'permissions' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Berechtigungen
                </button>
              </div>
              {userModalTab === 'basic' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Name</label>
                    <input
                      type="text"
                      value={editUserForm.name}
                      onChange={(e) => setEditUserForm((f) => ({ ...f, name: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Rolle</label>
                    <select
                      value={editUserForm.role}
                      onChange={(e) => {
                        setEditUserForm((f) => ({ ...f, role: e.target.value }))
                        scheduleAutoSaveUser()
                      }}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                    >
                      <option value="COORDINATOR">COORDINATOR</option>
                      <option value="ADMIN">ADMIN</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Edition</label>
                    <select
                      value={editUserForm.editionId ?? ''}
                      onChange={(e) => {
                        setEditUserForm((f) => ({
                          ...f,
                          editionId: e.target.value || null,
                        }))
                        scheduleAutoSaveUser()
                      }}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                    >
                      <option value="">– Keine –</option>
                      {editions.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.name} ({e.code})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Edition gültig bis (optional)</label>
                    <input
                      type="date"
                      value={editUserForm.editionExpiresAt}
                      onChange={(e) => {
                        setEditUserForm((f) => ({ ...f, editionExpiresAt: e.target.value }))
                        scheduleAutoSaveUser()
                      }}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                    />
                    <p className="mt-1 text-xs text-gray-500">Leer = unbegrenzt</p>
                  </div>
                </div>
              )}
              {userModalTab === 'permissions' && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">
                    Überschreiben Sie die Berechtigungen der Edition. „Edition“ = Standard der gewählten Edition nutzen.
                  </p>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Arbeitsbereiche (Kategorien)</label>
                    <div className="mt-2 max-h-48 overflow-y-auto rounded border border-gray-200 p-2">
                      {categories.map((c) => (
                        <div key={c.categoryId} className="flex items-center justify-between gap-2 py-1">
                          <span className="text-sm">{c.name}</span>
                          <select
                            value={editUserForm.categoryOverrides[c.categoryId] ?? 'edition'}
                            onChange={(e) =>
                              setUserCategoryOverride(c.categoryId, e.target.value as 'edition' | 'allow' | 'deny')
                            }
                            className="rounded border border-gray-300 px-2 py-1 text-xs"
                          >
                            <option value="edition">Edition</option>
                            <option value="allow">Erlauben</option>
                            <option value="deny">Verbieten</option>
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Seiten (feste Bereiche)</label>
                    <div className="mt-2 max-h-48 overflow-y-auto rounded border border-gray-200 p-2">
                      {allPageIds.map((pageId) => (
                        <div key={pageId} className="flex items-center justify-between gap-2 py-1">
                          <span className="text-sm">{PAGE_LABELS[pageId] ?? pageId}</span>
                          <select
                            value={editUserForm.pageOverrides[pageId] ?? 'edition'}
                            onChange={(e) =>
                              setUserPageOverride(pageId, e.target.value as 'edition' | 'allow' | 'deny')
                            }
                            className="rounded border border-gray-300 px-2 py-1 text-xs"
                          >
                            <option value="edition">Edition</option>
                            <option value="allow">Erlauben</option>
                            <option value="deny">Verbieten</option>
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div className="mt-6 flex gap-2">
                <button
                  type="button"
                  onClick={() => saveUser()}
                  disabled={savingUser}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {savingUser ? 'Speichern…' : 'Speichern'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditUser(null)}
                  className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Editionen verwalten */}
        <div className="mb-8 rounded-xl bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Editionen verwalten</h2>
          <p className="mb-4 text-sm text-gray-600">
            Legen Sie pro Edition fest, welche Arbeitsbereiche und Seiten nutzbar sind. Preis in Cent (z. B. 9900 = 99,00 €).
          </p>
          {editionsError && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {editionsError}
            </div>
          )}
          {loadingEditions ? (
            <p className="text-gray-500">Editionen werden geladen...</p>
          ) : (
            <>
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  {editions.length === 0
                    ? 'Keine Editionen vorhanden. Klicken Sie auf „Neue Edition hinzufügen“, um die erste anzulegen (z. B. FREE, SILVER, GOLD).'
                    : `${editions.length} Edition(en)`}
                </p>
                <button
                  type="button"
                  onClick={() => setShowAddEdition(true)}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                >
                  + Neue Edition hinzufügen
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="py-2 font-medium text-gray-700">Code</th>
                      <th className="py-2 font-medium text-gray-700">Name</th>
                      <th className="py-2 font-medium text-gray-700">Jahrespreis (Cent)</th>
                      <th className="py-2 font-medium text-gray-700">Kategorien</th>
                      <th className="py-2 font-medium text-gray-700">Seiten</th>
                      <th className="py-2 font-medium text-gray-700"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {editions.map((e) => (
                      <tr key={e.id} className="border-b border-gray-100">
                        <td className="py-2 font-mono">{e.code}</td>
                        <td className="py-2">{e.name}</td>
                        <td className="py-2">{e.annualPriceCents}</td>
                        <td className="py-2">{e.categoryIds?.length ?? 0}</td>
                        <td className="py-2">{e.pageIds?.length ?? 0}</td>
                        <td className="py-2">
                          <button
                            type="button"
                            onClick={() => openEditEdition(e)}
                            className="rounded bg-indigo-100 px-2 py-1 text-indigo-700 hover:bg-indigo-200"
                          >
                            Bearbeiten
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Modal: Neue Edition hinzufügen */}
        {showAddEdition && (
          <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
            <div className="my-8 w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl">
              <h3 className="mb-4 text-lg font-semibold">Neue Edition hinzufügen</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Code (eindeutig, z. B. FREE, SILVER, GOLD)</label>
                  <input
                    type="text"
                    value={addEditionForm.code}
                    onChange={(e) => setAddEditionForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                    placeholder="z. B. BRONZE"
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Name</label>
                  <input
                    type="text"
                    value={addEditionForm.name}
                    onChange={(e) => setAddEditionForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="z. B. Bronze Edition"
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Jahrespreis (Cent)</label>
                  <input
                    type="number"
                    min={0}
                    value={addEditionForm.annualPriceCents}
                    onChange={(e) =>
                      setAddEditionForm((f) => ({
                        ...f,
                        annualPriceCents: parseInt(e.target.value, 10) || 0,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                  />
                  <p className="mt-1 text-xs text-gray-500">0 = kostenlos</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Arbeitsbereiche (Kategorien)</label>
                  <div className="mt-2 max-h-48 overflow-y-auto rounded border border-gray-200 p-2">
                    {categories.map((c) => (
                      <label key={c.id} className="flex items-center gap-2 py-1">
                        <input
                          type="checkbox"
                          checked={addEditionForm.categoryIds.includes(c.categoryId)}
                          onChange={() => toggleAddCategory(c.categoryId)}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm">{c.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Seiten (feste Bereiche)</label>
                  <div className="mt-2 max-h-48 overflow-y-auto rounded border border-gray-200 p-2">
                    {allPageIds.map((pageId) => (
                      <label key={pageId} className="flex items-center gap-2 py-1">
                        <input
                          type="checkbox"
                          checked={addEditionForm.pageIds.includes(pageId)}
                          onChange={() => toggleAddPage(pageId)}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm">{PAGE_LABELS[pageId] ?? pageId}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-6 flex gap-2">
                <button
                  type="button"
                  onClick={saveNewEdition}
                  disabled={savingAddEdition}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {savingAddEdition ? 'Wird angelegt…' : 'Anlegen'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddEdition(false)}
                  className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Edition bearbeiten */}
        {editEdition && (
          <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
            <div className="my-8 w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl">
              <h3 className="mb-4 text-lg font-semibold">Edition bearbeiten: {editEdition.code}</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Name</label>
                  <input
                    type="text"
                    value={editEditionForm.name}
                    onChange={(e) => setEditEditionForm((f) => ({ ...f, name: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Jahrespreis (Cent)</label>
                  <input
                    type="number"
                    min={0}
                    value={editEditionForm.annualPriceCents}
                    onChange={(e) =>
                      setEditEditionForm((f) => ({
                        ...f,
                        annualPriceCents: parseInt(e.target.value, 10) || 0,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                  />
                  <p className="mt-1 text-xs text-gray-500">0 = kostenlos (z. B. Free Edition)</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Arbeitsbereiche (Kategorien)</label>
                  <div className="mt-2 max-h-48 overflow-y-auto rounded border border-gray-200 p-2">
                    {categories.map((c) => (
                      <label key={c.id} className="flex items-center gap-2 py-1">
                        <input
                          type="checkbox"
                          checked={editEditionForm.categoryIds.includes(c.categoryId)}
                          onChange={() => toggleCategory(c.categoryId)}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm">{c.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Seiten (feste Bereiche)</label>
                  <div className="mt-2 max-h-48 overflow-y-auto rounded border border-gray-200 p-2">
                    {allPageIds.map((pageId) => (
                      <label key={pageId} className="flex items-center gap-2 py-1">
                        <input
                          type="checkbox"
                          checked={editEditionForm.pageIds.includes(pageId)}
                          onChange={() => togglePage(pageId)}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm">{PAGE_LABELS[pageId] ?? pageId}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-6 flex gap-2">
                <button
                  type="button"
                  onClick={saveEdition}
                  disabled={savingEdition}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {savingEdition ? 'Speichern…' : 'Speichern'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditEdition(null)}
                  className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Top-User-Statistik */}
        <div className="rounded-xl bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Top-User-Statistik (erledigte Aufgaben)</h2>
          <div className="mb-4 flex flex-wrap gap-4">
            <label className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Von:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="rounded border border-gray-300 px-2 py-1 text-sm"
              />
            </label>
            <label className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Bis:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="rounded border border-gray-300 px-2 py-1 text-sm"
              />
            </label>
          </div>
          {loadingStats ? (
            <p className="text-gray-500">Statistik wird geladen...</p>
          ) : topUsers.length === 0 ? (
            <p className="text-gray-500">
              Keine erledigten Aufgaben im Zeitraum oder Spalte completedBy fehlt (Migration ausführen).
            </p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="py-2 font-medium text-gray-700">Name</th>
                  <th className="py-2 font-medium text-gray-700">E-Mail</th>
                  <th className="py-2 font-medium text-gray-700">Erledigte Aufgaben</th>
                </tr>
              </thead>
              <tbody>
                {topUsers.map((u) => (
                  <tr key={u.userId || 'unk'} className="border-b border-gray-100">
                    <td className="py-2">{u.name}</td>
                    <td className="py-2 text-gray-600">{u.email}</td>
                    <td className="py-2 font-medium">{u.completedCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
