'use client'

import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function InstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [isAndroid, setIsAndroid] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    // Prüfe ob bereits installiert
    const standalone = (window.navigator as any).standalone || 
                      window.matchMedia('(display-mode: standalone)').matches
    setIsStandalone(standalone)

    if (standalone) {
      // App ist bereits installiert
      return
    }

    // Prüfe Gerätetyp
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera
    const ios = /iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream
    const android = /android/i.test(userAgent)

    setIsIOS(ios)
    setIsAndroid(android)

    // Prüfe ob bereits versteckt wurde (localStorage)
    const dismissed = localStorage.getItem('install-prompt-dismissed')
    const dismissedTime = dismissed ? parseInt(dismissed, 10) : 0
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000

    // Zeige nur wenn nicht in den letzten 24 Stunden versteckt wurde
    if (dismissedTime > oneDayAgo) {
      return
    }

    // Zeige Prompt nach kurzer Verzögerung (für bessere UX)
    const timer = setTimeout(() => {
      if (ios || android) {
        setShowPrompt(true)
      }
    }, 2000) // 2 Sekunden nach Seitenladung

    // Android: Nutze nativen Install-Prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setShowPrompt(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    return () => {
      clearTimeout(timer)
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  const handleInstall = async () => {
    if (deferredPrompt) {
      // Android: Nutze nativen Prompt
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      
      if (outcome === 'accepted') {
        console.log('User hat die Installation akzeptiert')
        setShowPrompt(false)
        setDeferredPrompt(null)
      } else {
        console.log('User hat die Installation abgelehnt')
      }
    } else {
      // iOS: Zeige Anweisungen
      // Der Dialog bleibt offen mit Anweisungen
    }
  }

  const handleDismiss = () => {
    setShowPrompt(false)
    // Speichere in localStorage, dass versteckt wurde
    localStorage.setItem('install-prompt-dismissed', Date.now().toString())
  }

  if (isStandalone || !showPrompt) {
    return null
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-4 md:p-6 animate-in slide-in-from-bottom-4 duration-300">
      <div className="mx-auto max-w-md rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 p-5 shadow-2xl text-white">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 mt-1">
            {isIOS ? (
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            ) : (
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="mb-2 font-bold text-lg leading-tight">
              {isIOS ? '📱 App zum Home-Bildschirm hinzufügen' : '📱 App installieren'}
            </h3>
            
            {isIOS ? (
              <div className="mb-4 text-sm leading-relaxed">
                <p className="mb-3 font-medium">Für die beste Erfahrung füge diese App zu deinem Home-Bildschirm hinzu:</p>
                <ol className="ml-5 list-decimal space-y-2 text-xs leading-relaxed">
                  <li>Tippe auf das <strong className="font-semibold">Teilen</strong> Icon <span className="text-base">⎋</span> unten in der Browser-Leiste</li>
                  <li>Scrolle nach unten und wähle <strong className="font-semibold">"Zum Home-Bildschirm"</strong></li>
                  <li>Tippe auf <strong className="font-semibold">"Hinzufügen"</strong></li>
                </ol>
                <p className="mt-3 text-xs opacity-90">
                  💡 Die App funktioniert dann wie eine native App und Push Notifications werden unterstützt!
                </p>
              </div>
            ) : (
              <div className="mb-4">
                <p className="mb-2 text-sm leading-relaxed">
                  Installiere diese App für schnelleren Zugriff, bessere Performance und Offline-Funktionalität.
                </p>
                <p className="text-xs opacity-90">
                  💡 Die App wird wie eine native App funktionieren!
                </p>
              </div>
            )}

            <div className="flex gap-2">
              {isAndroid && deferredPrompt ? (
                <button
                  onClick={handleInstall}
                  className="flex-1 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-indigo-600 hover:bg-gray-100 active:bg-gray-200 transition-all shadow-md"
                >
                  Jetzt installieren
                </button>
              ) : isIOS ? (
                <button
                  onClick={() => {
                    // Für iOS können wir nur Anweisungen zeigen
                    handleDismiss()
                  }}
                  className="flex-1 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-indigo-600 hover:bg-gray-100 active:bg-gray-200 transition-all shadow-md"
                >
                  Verstanden
                </button>
              ) : null}
              
              <button
                onClick={handleDismiss}
                className="rounded-lg bg-white/20 px-4 py-2.5 text-sm font-medium text-white hover:bg-white/30 active:bg-white/40 transition-all"
              >
                Später
              </button>
            </div>
          </div>

          <button
            onClick={handleDismiss}
            className="flex-shrink-0 text-white/80 hover:text-white active:scale-95 transition-all"
            aria-label="Schließen"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
