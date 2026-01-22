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
      const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
      setIsSupported(supported)
      
      if (supported && 'Notification' in window) {
        const currentPermission = Notification.permission
        setPermission(currentPermission)
        console.log('Notification Permission Status:', currentPermission)
        console.log('Service Worker Support:', 'serviceWorker' in navigator)
        console.log('PushManager Support:', 'PushManager' in window)
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

      // Prüfe ob Notifications unterstützt werden
      if (!('Notification' in window)) {
        alert('Dieser Browser unterstützt keine Push Notifications')
        setIsLoading(false)
        return
      }

      // Prüfe ob Service Worker unterstützt wird
      if (!('serviceWorker' in navigator)) {
        alert('Dieser Browser unterstützt keine Service Worker')
        setIsLoading(false)
        return
      }

      // 1. ZUERST: Berechtigung anfragen (muss in User-Interaktion passieren!)
      // WICHTIG: Auf mobilen Geräten muss die Berechtigung synchron im Click-Handler angefragt werden
      console.log('Aktuelle Berechtigung:', Notification.permission)
      
      let permissionResult: NotificationPermission = Notification.permission
      
      if (permissionResult === 'default') {
        // Berechtigung anfragen - muss direkt im Click-Handler sein (nicht async!)
        try {
          permissionResult = await Notification.requestPermission()
          console.log('Berechtigung Ergebnis:', permissionResult)
        } catch (error) {
          console.error('Fehler beim Anfordern der Berechtigung:', error)
          alert('Fehler beim Anfordern der Berechtigung. Bitte erlaube Benachrichtigungen in den Browser-Einstellungen.')
          setIsLoading(false)
          return
        }
      }

      if (permissionResult !== 'granted') {
        alert('Benachrichtigungen wurden nicht erlaubt. Bitte erlaube sie in den Browser-Einstellungen:\n\n' +
              'iOS: Einstellungen → Safari → Websites → Benachrichtigungen\n' +
              'Android: Browser-Einstellungen → Benachrichtigungen')
        setPermission(permissionResult)
        setIsLoading(false)
        return
      }
      
      setPermission('granted')
      console.log('Berechtigung erteilt:', permissionResult)

      // 2. Service Worker registrieren
      const registration = await registerServiceWorker()
      if (!registration) {
        alert('Service Worker konnte nicht registriert werden. Prüfe die Browser-Konsole für Details.')
        setIsLoading(false)
        return
      }

      console.log('Service Worker registriert, erstelle Push Subscription...')

      // 3. Push Subscription erstellen
      const subscription = await subscribeToPush(registration)
      if (subscription) {
        setIsSubscribed(true)
        console.log('Push Subscription erfolgreich erstellt:', subscription)
        alert('✅ Push Notifications erfolgreich aktiviert!')
      } else {
        console.error('Fehler beim Erstellen der Subscription')
        alert('Fehler beim Erstellen der Subscription. Prüfe die Browser-Konsole für Details.')
      }
    } catch (error) {
      console.error('Fehler beim Aktivieren:', error)
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

  return (
    <div className="rounded-lg bg-white p-6 shadow-md">
      <h3 className="mb-4 text-lg font-semibold text-gray-900">Push Notifications</h3>
      
      {permission === 'denied' ? (
        <div className="space-y-4">
          <div className="rounded-lg bg-red-50 p-4 text-red-800">
            <p className="font-semibold">❌ Benachrichtigungen blockiert</p>
            <p className="text-sm mt-1">
              Bitte erlaube Benachrichtigungen in deinen Browser-Einstellungen, um Push Notifications zu aktivieren.
            </p>
            <ul className="mt-2 text-xs list-inside list-disc">
              <li>iOS: Einstellungen → Safari → Websites → Benachrichtigungen</li>
              <li>Android: Browser-Einstellungen → Website-Einstellungen → Benachrichtigungen</li>
            </ul>
          </div>
        </div>
      ) : isSubscribed ? (
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
            disabled={isLoading}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {isLoading ? 'Wird aktiviert...' : 'Push Notifications aktivieren'}
          </button>
          {permission === 'default' && (
            <div className="text-xs text-gray-500 space-y-1">
              <p>Beim Klicken wirst du nach Berechtigung gefragt.</p>
              <p className="text-yellow-600">
                ⚠️ Auf mobilen Geräten: Stelle sicher, dass du die Berechtigung erteilst!
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
