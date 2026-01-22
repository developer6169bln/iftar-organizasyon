'use client'

import { useEffect, useState } from 'react'
import { 
  registerServiceWorker, 
  requestNotificationPermission, 
  subscribeToPush,
  unsubscribeFromPush,
  getSubscriptionStatus
} from '@/lib/pushNotifications'

export default function PushNotificationSetup() {
  const [isSupported, setIsSupported] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>('default')

  useEffect(() => {
    const checkSupport = () => {
      const supported = 'serviceWorker' in navigator && 'PushManager' in window
      setIsSupported(supported)
      
      if (supported && 'Notification' in window) {
        setPermission(Notification.permission)
      }
    }
    
    checkSupport()
    checkSubscriptionStatus()
  }, [])

  const checkSubscriptionStatus = async () => {
    try {
      const { isSubscribed: subscribed } = await getSubscriptionStatus()
      setIsSubscribed(subscribed)
    } catch (error) {
      console.error('Fehler beim Prüfen der Subscription:', error)
    }
  }

  const handleEnableNotifications = async () => {
    setIsLoading(true)
    try {
      // Prüfe ob auf iOS und ob App vom Home-Bildschirm geöffnet wurde
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
      const isStandalone = (window.navigator as any).standalone || window.matchMedia('(display-mode: standalone)').matches
      
      if (isIOS && !isStandalone) {
        const shouldContinue = confirm(
          '⚠️ WICHTIG für iOS:\n\n' +
          'Push Notifications funktionieren auf iOS nur, wenn die App vom Home-Bildschirm geöffnet wurde.\n\n' +
          'Bitte:\n' +
          '1. Tippe auf das "Teilen" Icon\n' +
          '2. Wähle "Zum Home-Bildschirm"\n' +
          '3. Öffne die App vom Home-Bildschirm\n' +
          '4. Versuche es erneut\n\n' +
          'Trotzdem fortfahren?'
        )
        if (!shouldContinue) {
          setIsLoading(false)
          return
        }
      }

      // 1. Service Worker registrieren
      const registration = await registerServiceWorker()
      if (!registration) {
        alert('Service Worker konnte nicht registriert werden. Prüfe die Browser-Konsole für Details.')
        return
      }

      // 2. Berechtigung anfragen
      const hasPermission = await requestNotificationPermission()
      if (!hasPermission) {
        alert('Benachrichtigungen wurden nicht erlaubt. Bitte erlaube sie in den Browser-Einstellungen.')
        setPermission('denied')
        return
      }
      
      setPermission('granted')

      // 3. Push Subscription erstellen
      const subscription = await subscribeToPush(registration)
      if (subscription) {
        setIsSubscribed(true)
        alert('Push Notifications erfolgreich aktiviert!')
      } else {
        alert('Fehler beim Erstellen der Subscription. Prüfe die Browser-Konsole für Details.')
      }
    } catch (error) {
      console.error('Fehler:', error)
      alert('Fehler beim Aktivieren der Notifications: ' + (error instanceof Error ? error.message : 'Unbekannter Fehler'))
    } finally {
      setIsLoading(false)
    }
  }

  const handleDisableNotifications = async () => {
    setIsLoading(true)
    try {
      const success = await unsubscribeFromPush()
      if (success) {
        setIsSubscribed(false)
        alert('Push Notifications wurden deaktiviert')
      } else {
        alert('Fehler beim Deaktivieren')
      }
    } catch (error) {
      console.error('Fehler:', error)
      alert('Fehler beim Deaktivieren')
    } finally {
      setIsLoading(false)
    }
  }

  if (!isSupported) {
    return (
      <div className="rounded-lg bg-yellow-50 p-4 text-yellow-800">
        <p className="font-semibold">⚠️ Push Notifications nicht unterstützt</p>
        <p className="text-sm mt-1">Dein Browser unterstützt keine Push Notifications.</p>
      </div>
    )
  }

  if (permission === 'denied') {
    return (
      <div className="rounded-lg bg-red-50 p-4 text-red-800">
        <p className="font-semibold">❌ Benachrichtigungen blockiert</p>
        <p className="text-sm mt-1">
          Bitte erlaube Benachrichtigungen in deinen Browser-Einstellungen, um Push Notifications zu aktivieren.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-lg bg-white p-6 shadow-md">
      <h3 className="mb-4 text-lg font-semibold text-gray-900">Push Notifications</h3>
      
      {isSubscribed ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-green-600">
            <span className="text-xl">✓</span>
            <span className="font-medium">Push Notifications sind aktiviert</span>
          </div>
          <p className="text-sm text-gray-600">
            Du erhältst Benachrichtigungen über wichtige Ereignisse in der Anwendung.
          </p>
          <button
            onClick={handleDisableNotifications}
            disabled={isLoading}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {isLoading ? 'Wird deaktiviert...' : 'Push Notifications deaktivieren'}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Aktiviere Push Notifications, um über wichtige Ereignisse benachrichtigt zu werden, 
            auch wenn die Anwendung nicht geöffnet ist.
          </p>
          <button
            onClick={handleEnableNotifications}
            disabled={isLoading || permission !== 'default' && permission !== 'granted'}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {isLoading ? 'Wird aktiviert...' : 'Push Notifications aktivieren'}
          </button>
          {permission === 'default' && (
            <p className="text-xs text-gray-500">
              Beim Klicken wirst du nach Berechtigung gefragt.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
