'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getAuthHeaders } from '@/lib/authClient'

type Project = { id: string; name: string; ownerId: string; isOwner: boolean }

/**
 * Zeigt auf allen Dashboard-Unterseiten die Projektauswahl.
 * Arbeitsbereiche, Seiten, Aufgaben und Checklisten beziehen sich immer auf das gewählte Projekt.
 * Bei Wechsel wird localStorage aktualisiert und dashboard-project-changed ausgelöst.
 */
export default function DashboardProjectSwitcher() {
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/projects', { credentials: 'include', headers: getAuthHeaders() })
        if (res.ok) {
          const list = await res.json()
          setProjects(list)
          const stored = typeof window !== 'undefined' ? localStorage.getItem('dashboard-project-id') : null
          const defaultId = list.find((p: Project) => p.isOwner)?.id ?? list[0]?.id ?? null
          const id = stored && list.some((p: Project) => p.id === stored) ? stored : defaultId
          setSelectedProjectId(id || null)
          if (typeof window !== 'undefined' && id) {
            localStorage.setItem('dashboard-project-id', id)
          }
        }
      } catch {
        setProjects([])
      } finally {
        setLoaded(true)
      }
    }
    load()
  }, [])

  useEffect(() => {
    if (!loaded) return
    const stored = typeof window !== 'undefined' ? localStorage.getItem('dashboard-project-id') : null
    setSelectedProjectId(stored || null)
  }, [loaded])

  const handleChange = (id: string | null) => {
    setSelectedProjectId(id)
    if (typeof window !== 'undefined') {
      if (id) localStorage.setItem('dashboard-project-id', id)
      else localStorage.removeItem('dashboard-project-id')
      window.dispatchEvent(new CustomEvent('dashboard-project-changed'))
    }
  }

  if (!loaded || projects.length === 0) {
    return (
      <div className="border-b border-gray-200 bg-white px-4 py-2">
        <div className="mx-auto flex max-w-7xl items-center gap-4">
          <Link href="/dashboard" className="text-sm font-medium text-indigo-600 hover:text-indigo-800">
            ← Dashboard
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="border-b border-gray-200 bg-white px-4 py-2 shadow-sm">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4">
        <Link href="/dashboard" className="text-sm font-medium text-indigo-600 hover:text-indigo-800">
          ← Dashboard
        </Link>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Projekt:</label>
          <select
            value={selectedProjectId || ''}
            onChange={(e) => handleChange(e.target.value || null)}
            className="rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">— auswählen —</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} {p.isOwner ? '(Inhaber)' : ''}
              </option>
            ))}
          </select>
        </div>
        <p className="text-xs text-gray-500">
          Arbeitsbereiche, Seiten, Aufgaben und Checklisten gelten nur für dieses Projekt.
        </p>
      </div>
    </div>
  )
}
