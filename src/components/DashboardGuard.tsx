'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import DashboardProjectSwitcher from './DashboardProjectSwitcher'

/** Pfad zu Page-ID (feste Dashboard-Seiten). */
const PATH_TO_PAGE: Record<string, string> = {
  '/dashboard/guests': 'guests',
  '/dashboard/invitations': 'invitations',
  '/dashboard/checkin': 'checkin',
  '/dashboard/reports': 'reports',
  '/dashboard/audit-logs': 'audit-logs',
  '/dashboard/push-notifications': 'push-notifications',
  '/dashboard/vip-namensschilder': 'vip-namensschilder',
  '/dashboard/tischplanung': 'tischplanung',
  '/dashboard/foto-video': 'foto-video',
  '/dashboard/program_flow': 'program_flow',
}

export default function DashboardGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [allowed, setAllowed] = useState<boolean | null>(null)

  useEffect(() => {
    if (!pathname?.startsWith('/dashboard')) {
      setAllowed(true)
      return
    }

    const check = async () => {
      const token =
        typeof document !== 'undefined' &&
        (document.cookie.match(/auth-token=([^;]+)/)?.[1] || localStorage.getItem('auth-token'))
      if (!token) {
        router.replace('/login')
        setAllowed(false)
        return
      }

      try {
        const projectId = typeof window !== 'undefined' ? localStorage.getItem('dashboard-project-id') : null
        const url = projectId ? `/api/me?projectId=${encodeURIComponent(projectId)}` : '/api/me'
        const res = await fetch(url, { credentials: 'include', cache: 'no-store' })
        if (!res.ok) {
          router.replace('/login')
          setAllowed(false)
          return
        }
        const data = await res.json()
        const allowedPageIds: string[] = data.allowedPageIds || []
        const allowedCategoryIds: string[] = data.allowedCategoryIds || []
        const isAdmin = !!data.isAdmin

        // Dashboard-Hauptseite und Projekte: immer erlauben (Eingeloggt reicht)
        if (pathname === '/dashboard' || pathname === '/dashboard/' || pathname === '/dashboard/projects') {
          setAllowed(true)
          return
        }

        // Admin-Seite: nur für Admin
        if (pathname === '/dashboard/admin') {
          if (!isAdmin) {
            router.replace('/dashboard?access=denied')
            setAllowed(false)
            return
          }
          setAllowed(true)
          return
        }

        // Feste Seite (z. B. /dashboard/guests)
        // Einige Kategorien verlinken auf feste Seiten: GUEST_LIST → guests, PROGRAM_FLOW → program_flow
        const pageId = PATH_TO_PAGE[pathname]
        if (pageId) {
          const hasPage = allowedPageIds.includes(pageId)
          const hasCategoryForPage =
            (pathname === '/dashboard/guests' && allowedCategoryIds.includes('GUEST_LIST')) ||
            (pathname === '/dashboard/program_flow' && allowedCategoryIds.includes('PROGRAM_FLOW'))
          if (isAdmin || hasPage || hasCategoryForPage) {
            setAllowed(true)
            return
          }
          router.replace('/dashboard?access=denied')
          setAllowed(false)
          return
        }

        // Kategorie-Seite: /dashboard/[category] (z. B. /dashboard/protocol, /dashboard/guest_list)
        const match = pathname.match(/^\/dashboard\/([^/]+)$/)
        if (match) {
          const segment = match[1]
          const categoryId = segment.toUpperCase().replace(/-/g, '_')
          if (isAdmin || allowedCategoryIds.includes(categoryId)) {
            setAllowed(true)
            return
          }
          router.replace('/dashboard?access=denied')
          setAllowed(false)
          return
        }

        setAllowed(true)
      } catch {
        router.replace('/login')
        setAllowed(false)
      }
    }

    check()
    const onProjectChange = () => check()
    if (typeof window !== 'undefined') {
      window.addEventListener('dashboard-project-changed', onProjectChange)
      return () => window.removeEventListener('dashboard-project-changed', onProjectChange)
    }
  }, [pathname, router])

  // Während Prüfung: nichts anzeigen oder kurzer Ladezustand
  if (allowed === null) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-gray-500">Zugriff wird geprüft…</p>
      </div>
    )
  }

  if (!allowed) {
    return null
  }

  // Auf Unterseiten Projekt-Umschalter anzeigen (Hauptdashboard hat eigenen Header mit Auswahl)
  const isMainDashboard = pathname === '/dashboard' || pathname === '/dashboard/'
  return (
    <>
      {!isMainDashboard && <DashboardProjectSwitcher />}
      {children}
    </>
  )
}
