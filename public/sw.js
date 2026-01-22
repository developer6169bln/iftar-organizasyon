// Service Worker für Push Notifications
self.addEventListener('push', function(event) {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Neue Benachrichtigung';
  const options = {
    body: data.body || 'Du hast eine neue Nachricht',
    icon: data.icon || '/icon-192x192.png',
    badge: data.badge || '/badge-72x72.png',
    data: data.data || {},
    requireInteraction: data.requireInteraction || false,
    actions: data.actions || [],
    tag: data.tag || 'default',
    vibrate: data.vibrate || [200, 100, 200]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Notification Click Handler
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  const urlToOpen = event.notification.data.url || '/dashboard';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(function(clientList) {
        // Prüfe ob ein Fenster bereits geöffnet ist
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if (client.url.includes(urlToOpen) && 'focus' in client) {
            return client.focus();
          }
        }
        // Öffne neues Fenster
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// Service Worker Install
self.addEventListener('install', function(event) {
  self.skipWaiting();
});

// Service Worker Activate
self.addEventListener('activate', function(event) {
  event.waitUntil(clients.claim());
});
