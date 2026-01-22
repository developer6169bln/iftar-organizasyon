// Push Notifications Helper Functions

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registriert:', registration);
      return registration;
    } catch (error) {
      console.error('Service Worker Registrierung fehlgeschlagen:', error);
      return null;
    }
  }
  return null;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if ('Notification' in window) {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }
  return false;
}

export async function subscribeToPush(
  registration: ServiceWorkerRegistration
): Promise<PushSubscription | null> {
  try {
    // Hole Public Key vom Server
    const response = await fetch('/api/push/subscribe', {
      method: 'GET',
    });
    
    if (!response.ok) {
      throw new Error('Konnte Public Key nicht abrufen');
    }
    
    const { publicKey } = await response.json();
    
    if (!publicKey) {
      throw new Error('Public Key nicht verfügbar');
    }
    
    // Erstelle Push Subscription
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
    
    // Subscription an Server senden
    const saveResponse = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription }),
    });
    
    if (!saveResponse.ok) {
      throw new Error('Konnte Subscription nicht speichern');
    }
    
    return subscription;
  } catch (error) {
    console.error('Push Subscription fehlgeschlagen:', error);
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
