// Service Worker für Push Notifications
self.addEventListener('push', function(event) {
  console.log('[Service Worker] Push Event empfangen', event);
  
  let data = {};
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (e) {
    console.error('[Service Worker] Fehler beim Parsen der Push-Daten:', e);
    data = { title: 'Neue Benachrichtigung', body: event.data?.text() || 'Du hast eine neue Nachricht' };
  }
  
  const title = data.title || 'Neue Benachrichtigung';
  const options = {
    body: data.body || 'Du hast eine neue Nachricht',
    icon: data.icon || '/icon-192x192.png',
    badge: data.badge || '/badge-72x72.png',
    data: data.data || { url: data.url || '/dashboard' },
    requireInteraction: data.requireInteraction || false,
    actions: data.actions || [],
    tag: data.tag || 'default',
    vibrate: data.vibrate || [200, 100, 200],
    // Mobile-spezifische Optionen
    silent: false,
    renotify: true,
    timestamp: Date.now()
  };

  console.log('[Service Worker] Zeige Notification:', title, options);

  event.waitUntil(
    self.registration.showNotification(title, options)
      .then(() => {
        console.log('[Service Worker] Notification erfolgreich angezeigt');
      })
      .catch((error) => {
        console.error('[Service Worker] Fehler beim Anzeigen der Notification:', error);
      })
  );
});

// Notification Click Handler
self.addEventListener('notificationclick', function(event) {
  console.log('[Service Worker] Notification Click:', event);
  event.notification.close();
  
  const urlToOpen = event.notification.data?.url || '/dashboard';
  const fullUrl = urlToOpen.startsWith('http') ? urlToOpen : self.location.origin + urlToOpen;
  
  event.waitUntil(
    clients.matchAll({ 
      type: 'window', 
      includeUncontrolled: true 
    })
      .then(function(clientList) {
        console.log('[Service Worker] Gefundene Clients:', clientList.length);
        
        // Prüfe ob ein Fenster bereits geöffnet ist
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          const clientUrl = new URL(client.url);
          const targetUrl = new URL(fullUrl);
          
          if (clientUrl.origin === targetUrl.origin && 'focus' in client) {
            console.log('[Service Worker] Fokussiere bestehenden Client');
            return client.focus().then(() => {
              // Navigiere zum Ziel-URL falls nötig
              if (clientUrl.pathname !== targetUrl.pathname) {
                return client.navigate(fullUrl);
              }
            });
          }
        }
        
        // Öffne neues Fenster
        console.log('[Service Worker] Öffne neues Fenster:', fullUrl);
        if (clients.openWindow) {
          return clients.openWindow(fullUrl);
        }
      })
      .catch((error) => {
        console.error('[Service Worker] Fehler beim Öffnen:', error);
      })
  );
});

// Service Worker Install
self.addEventListener('install', function(event) {
  console.log('[Service Worker] Install Event');
  // Sofort aktivieren (wichtig für mobile)
  self.skipWaiting();
});

// Service Worker Activate
self.addEventListener('activate', function(event) {
  console.log('[Service Worker] Activate Event');
  event.waitUntil(
    Promise.all([
      // Übernehme alle Clients sofort
      clients.claim(),
      // Entferne alte Service Worker
      self.clients.matchAll().then(clients => {
        console.log('[Service Worker] Aktive Clients:', clients.length);
      })
    ])
  );
});

// Message Handler für SKIP_WAITING
self.addEventListener('message', function(event) {
  console.log('[Service Worker] Message Event:', event.data);
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[Service Worker] SKIP_WAITING empfangen');
    self.skipWaiting();
  }
});
