// Push Notifications Helper Functions

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    console.warn('Service Worker wird von diesem Browser nicht unterstützt');
    return null;
  }

  try {
    // Entferne alte Service Worker falls vorhanden
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const registration of registrations) {
      if (registration.active?.scriptURL.includes('/sw.js')) {
        console.log('Bestehender Service Worker gefunden, warte auf ready...');
        try {
          await navigator.serviceWorker.ready;
          console.log('Bestehender Service Worker ist ready');
          return registration;
        } catch (e) {
          console.warn('Fehler beim Warten auf bestehenden Service Worker:', e);
        }
      }
    }

    console.log('Registriere neuen Service Worker...');
    
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      updateViaCache: 'none', // Wichtig für mobile: immer neueste Version laden
    });
    
    console.log('Service Worker registriert:', registration);
    console.log('Service Worker Scope:', registration.scope);
    console.log('Service Worker installing:', registration.installing?.state);
    console.log('Service Worker waiting:', registration.waiting?.state);
    console.log('Service Worker active:', registration.active?.state);
    
    // Warte auf Installation und Aktivierung (wichtig für mobile)
    if (registration.installing) {
      console.log('Service Worker wird installiert, warte...');
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Service Worker Installation Timeout'));
        }, 10000); // 10 Sekunden Timeout
        
        registration.installing!.addEventListener('statechange', () => {
          const state = registration.installing!.state;
          console.log('Service Worker State Change:', state);
          
          if (state === 'activated') {
            clearTimeout(timeout);
            resolve();
          } else if (state === 'redundant') {
            clearTimeout(timeout);
            reject(new Error('Service Worker wurde redundant'));
          }
        });
      });
    } else if (registration.waiting) {
      console.log('Service Worker wartet, aktiviere...');
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
    
    // Warte auf ready (kritisch für mobile!)
    console.log('Warte auf Service Worker ready...');
    const readyRegistration = await navigator.serviceWorker.ready;
    console.log('Service Worker ready!', readyRegistration);
    
    // Zusätzliche Wartezeit für mobile Geräte
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Prüfe ob Service Worker wirklich aktiv ist
    if (!readyRegistration.active) {
      throw new Error('Service Worker ist nicht aktiv');
    }
    
    console.log('Service Worker ist aktiv und bereit:', readyRegistration.active.state);
    
    return readyRegistration;
  } catch (error) {
    console.error('Service Worker Registrierung fehlgeschlagen:', error);
    console.error('Fehler-Details:', error instanceof Error ? error.message : String(error));
    console.error('Stack:', error instanceof Error ? error.stack : 'Kein Stack');
    return null;
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.warn('Notifications werden von diesem Browser nicht unterstützt');
    return false;
  }
  
  // Prüfe aktuelle Berechtigung
  const currentPermission = Notification.permission;
  console.log('Aktuelle Notification-Berechtigung:', currentPermission);
  
  if (currentPermission === 'granted') {
    return true;
  }
  
  if (currentPermission === 'denied') {
    console.warn('Benachrichtigungen wurden blockiert');
    return false;
  }
  
  // Berechtigung anfragen (muss in User-Interaktion passieren!)
  try {
    const permission = await Notification.requestPermission();
    console.log('Berechtigung Ergebnis:', permission);
    return permission === 'granted';
  } catch (error) {
    console.error('Fehler beim Anfordern der Berechtigung:', error);
    return false;
  }
}

export async function subscribeToPush(
  registration: ServiceWorkerRegistration
): Promise<PushSubscription | null> {
  try {
    console.log('Starte Push Subscription...');
    
    // Prüfe ob PushManager verfügbar ist
    if (!registration.pushManager) {
      throw new Error('PushManager nicht verfügbar');
    }
    
    // Prüfe ob bereits eine Subscription existiert
    const existingSubscription = await registration.pushManager.getSubscription();
    if (existingSubscription) {
      console.log('Bestehende Subscription gefunden:', existingSubscription.endpoint);
      // Prüfe ob Subscription noch gültig ist
      try {
        // Versuche Subscription zu speichern/aktualisieren
        const saveResponse = await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription: existingSubscription }),
        });
        
        if (saveResponse.ok) {
          console.log('Bestehende Subscription aktualisiert');
          return existingSubscription;
        }
      } catch (e) {
        console.warn('Fehler beim Aktualisieren bestehender Subscription:', e);
        // Versuche zu unsubscribe und neu zu erstellen
        await existingSubscription.unsubscribe().catch(() => {});
      }
    }
    
    // Hole Public Key vom Server
    console.log('Hole Public Key vom Server...');
    const response = await fetch('/api/push/subscribe', {
      method: 'GET',
      cache: 'no-store', // Wichtig: immer neueste Version
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Public Key Response Fehler:', response.status, errorText);
      throw new Error(`Konnte Public Key nicht abrufen: ${response.status}`);
    }
    
    const { publicKey } = await response.json();
    
    if (!publicKey) {
      throw new Error('Public Key nicht verfügbar');
    }
    
    console.log('Public Key erhalten, erstelle Subscription...');
    
    // Konvertiere Public Key
    const applicationServerKey = urlBase64ToUint8Array(publicKey);
    console.log('Application Server Key konvertiert:', applicationServerKey instanceof ArrayBuffer);
    
    // Erstelle Push Subscription
    console.log('Abonniere Push Service...');
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey,
    });
    
    console.log('Push Subscription erstellt:', subscription.endpoint);
    console.log('Subscription Keys:', {
      p256dh: subscription.getKey('p256dh') ? 'vorhanden' : 'fehlt',
      auth: subscription.getKey('auth') ? 'vorhanden' : 'fehlt',
    });
    
    // Subscription an Server senden
    console.log('Speichere Subscription auf Server...');
    const saveResponse = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription }),
    });
    
    if (!saveResponse.ok) {
      const errorText = await saveResponse.text();
      console.error('Subscription Speichern Fehler:', saveResponse.status, errorText);
      throw new Error(`Konnte Subscription nicht speichern: ${saveResponse.status}`);
    }
    
    const result = await saveResponse.json();
    console.log('Subscription erfolgreich gespeichert:', result);
    
    return subscription;
  } catch (error) {
    console.error('Push Subscription fehlgeschlagen:', error);
    console.error('Error Details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined,
    });
    return null;
  }
}

export async function unsubscribeFromPush(): Promise<boolean> {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    
    if (subscription) {
      await subscription.unsubscribe();
      
      // Entferne Subscription vom Server
      await fetch('/api/push/subscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          endpoint: subscription.endpoint 
        }),
      });
      
      return true;
    }
    return false;
  } catch (error) {
    console.error('Unsubscribe fehlgeschlagen:', error);
    return false;
  }
}

export async function getSubscriptionStatus(): Promise<{
  isSubscribed: boolean;
  subscription: PushSubscription | null;
}> {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return {
      isSubscribed: subscription !== null,
      subscription,
    };
  } catch (error) {
    console.error('Fehler beim Abrufen der Subscription:', error);
    return {
      isSubscribed: false,
      subscription: null,
    };
  }
}

function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');
  
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray.buffer;
}
