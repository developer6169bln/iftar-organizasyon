'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { getAuthHeaders } from '@/lib/authClient'
import DashboardProjectSwitcher from './DashboardProjectSwitcher'

/** Pfad zu Page-ID (feste Dashboard-Seiten). */
const PATH_TO_PAGE: Record<string, string> = {
  '/dashboard/guests': 'guests',
  '/dashboard/invitations': 'invitations',
  '/dashboard/checkin': 'checkin',
  '/dashboard/checkin-vip': 'checkin',
  '/dashboard/reports': 'reports',
  '/dashboard/audit-logs': 'audit-logs',
  '/dashboard/push-notifications': 'push-notifications',
  '/dashboard/vip-namensschilder': 'vip-namensschilder',
  '/dashboard/tischplanung': 'tischplanung',
  '/dashboard/foto-video': 'foto-video',
  '/dashboard/media-upload': 'media-upload',
  '/dashboard/program_flow': 'program_flow',
  '/dashboard/etkinlik-formu': 'etkinlik-formu',
  '/dashboard/etkinlik-raporu': 'etkinlik-raporu',
  '/dashboard/room-reservations': 'room-reservations',
}

export default function DashboardGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const [checkError, setCheckError] = useState<string | null>(null)

  useEffect(() => {
    if (!pathname?.startsWith('/dashboard')) {
      setAllowed(true)
      return
    }

    const check = async (retryCount = 0) => {
      setCheckError(null)
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
        const res = await fetch(url, {
          credentials: 'include',
          cache: 'no-store',
          headers: getAuthHeaders(),
        })
        // Nur bei 401 (nicht angemeldet) ausloggen – nicht bei 500 oder Netzwerkfehlern
        if (res.status === 401) {
          router.replace('/login')
          setAllowed(false)
          return
        }
        if (!res.ok) {
          // Bei 500/Netzwerk: einmal automatisch erneut versuchen
          if (retryCount < 1) {
            await new Promise((r) => setTimeout(r, 1500))
            return check(retryCount + 1)
          }
          setCheckError('Verbindungsfehler. Bitte erneut versuchen.')
          setAllowed(null)
          return
        }
        const data = await res.json()
        const allowedPageIds: string[] = data.allowedPageIds || []
        const allowedCategoryIds: string[] = data.allowedCategoryIds || []
        const isAdmin = !!data.isAdmin

        // Dashboard-Hauptseite, Projekte, Registrierungen: immer erlauben (Eingeloggt reicht)
        if (pathname === '/dashboard' || pathname === '/dashboard/' || pathname === '/dashboard/projects' || pathname === '/dashboard/registrierungen') {
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
        // Netzwerkfehler etc. – einmal automatisch erneut versuchen, dann Fehler anzeigen
        if (retryCount < 1) {
          await new Promise((r) => setTimeout(r, 1500))
          return check(retryCount + 1)
        }
        setCheckError('Verbindungsfehler. Bitte erneut versuchen.')
        setAllowed(null)
      }
    }

    check(0)
    const onProjectChange = () => check()
    if (typeof window !== 'undefined') {
      window.addEventListener('dashboard-project-changed', onProjectChange)
      return () => window.removeEventListener('dashboard-project-changed', onProjectChange)
    }
  }, [pathname, router])

  // Während Prüfung: nichts anzeigen oder kurzer Ladezustand
  if (allowed === null) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4">
        <p className="text-gray-500">{checkError || 'Zugriff wird geprüft…'}</p>
        {checkError && (
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700"
          >
            Erneut versuchen
          </button>
        )}
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
