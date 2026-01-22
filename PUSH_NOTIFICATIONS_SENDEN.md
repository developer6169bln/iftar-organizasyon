# Push Notifications senden - Anleitung

## Methoden zum Senden von Push Notifications

### 1. Über die API Route (Frontend/Backend)

**Direkter API-Aufruf:**
```typescript
const response = await fetch('/api/push/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: 'Neue Benachrichtigung',
    body: 'Dies ist der Text der Benachrichtigung',
    url: '/dashboard/guests', // Optional: URL die beim Klick geöffnet wird
    userId: 'user-id-123', // Optional: Nur an diesen Benutzer senden
    icon: '/icon-192x192.png', // Optional
    tag: 'guest-added', // Optional: Tag für Notification-Gruppierung
    requireInteraction: false // Optional: Notification bleibt bis geklickt
  })
})

const result = await response.json()
// { success: true, sent: 5, failed: 0, total: 5 }
```

### 2. Mit Helper-Funktion (Frontend)

**Import:**
```typescript
import { sendPushNotification } from '@/lib/sendPushNotification'
```

**Verwendung:**
```typescript
// An alle Benutzer senden
await sendPushNotification({
  title: 'Neuer Gast hinzugefügt',
  body: 'Ein neuer Gast wurde zur Liste hinzugefügt',
  url: '/dashboard/guests'
})

// An spezifischen Benutzer senden
await sendPushNotification({
  title: 'Neue Aufgabe zugewiesen',
  body: 'Dir wurde eine neue Aufgabe zugewiesen',
  url: '/dashboard/tasks',
  userId: 'user-id-123'
})
```

### 3. In API Routes (Backend)

**Import:**
```typescript
import { sendPushNotificationFromServer } from '@/lib/sendPushNotification'
```

**Beispiel: Bei neuem Gast**
```typescript
// In /api/guests/route.ts (POST)
import { sendPushNotificationFromServer } from '@/lib/sendPushNotification'

export async function POST(request: NextRequest) {
  // ... Gast erstellen ...
  
  // Nach erfolgreichem Erstellen:
  await sendPushNotificationFromServer({
    title: 'Neuer Gast hinzugefügt',
    body: `Gast "${guest.name}" wurde zur Liste hinzugefügt`,
    url: '/dashboard/guests',
    tag: 'guest-added'
  })
  
  return NextResponse.json(guest, { status: 201 })
}
```

**Beispiel: Bei neuer Aufgabe**
```typescript
// In /api/tasks/route.ts (POST)
import { sendPushNotificationFromServer } from '@/lib/sendPushNotification'

export async function POST(request: NextRequest) {
  // ... Task erstellen ...
  
  // Wenn ein Benutzer zugewiesen wurde:
  if (task.assignedTo) {
    await sendPushNotificationFromServer({
      title: 'Neue Aufgabe zugewiesen',
      body: `Aufgabe "${task.title}" wurde dir zugewiesen`,
      url: `/dashboard/${task.category.toLowerCase()}`,
      userId: task.assignedTo,
      tag: 'task-assigned'
    })
  }
  
  return NextResponse.json(task, { status: 201 })
}
```

**Beispiel: Bei Status-Änderung**
```typescript
// In /api/tasks/route.ts (PATCH)
import { sendPushNotificationFromServer } from '@/lib/sendPushNotification'

export async function PATCH(request: NextRequest) {
  // ... Task aktualisieren ...
  
  // Wenn Task abgeschlossen wurde:
  if (updateData.status === 'COMPLETED' && oldTask.status !== 'COMPLETED') {
    await sendPushNotificationFromServer({
      title: 'Aufgabe abgeschlossen',
      body: `Aufgabe "${task.title}" wurde abgeschlossen`,
      url: `/dashboard/${task.category.toLowerCase()}`,
      userId: task.assignedTo || undefined,
      tag: 'task-completed'
    })
  }
  
  return NextResponse.json(task)
}
```

### 4. Mit cURL (Test)

```bash
# An alle Benutzer senden
curl -X POST http://localhost:3000/api/push/send \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Notification",
    "body": "Dies ist eine Test-Benachrichtigung",
    "url": "/dashboard"
  }'

# An spezifischen Benutzer senden
curl -X POST http://localhost:3000/api/push/send \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Persönliche Nachricht",
    "body": "Dies ist nur für dich",
    "url": "/dashboard",
    "userId": "user-id-123"
  }'
```

---

## Parameter

| Parameter | Typ | Erforderlich | Beschreibung |
|-----------|-----|--------------|--------------|
| `title` | string | ✅ Ja | Titel der Notification |
| `body` | string | ✅ Ja | Text der Notification |
| `url` | string | ❌ Nein | URL die beim Klick geöffnet wird (Standard: `/dashboard`) |
| `userId` | string | ❌ Nein | Nur an diesen Benutzer senden (wenn nicht gesetzt: an alle) |
| `icon` | string | ❌ Nein | Icon URL (Standard: `/icon-192x192.png`) |
| `tag` | string | ❌ Nein | Tag für Notification-Gruppierung |
| `requireInteraction` | boolean | ❌ Nein | Notification bleibt bis geklickt (Standard: `false`) |

---

## Rückgabewert

```typescript
{
  success: boolean,  // true wenn erfolgreich
  sent: number,      // Anzahl erfolgreich gesendeter Notifications
  failed: number,    // Anzahl fehlgeschlagener Notifications
  total: number      // Gesamtanzahl Subscriptions
}
```

---

## Wichtige Hinweise

1. **VAPID Keys müssen gesetzt sein:**
   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
   - `VAPID_PRIVATE_KEY`
   - `VAPID_EMAIL`

2. **Benutzer müssen Push Notifications aktiviert haben:**
   - Benutzer müssen im Dashboard "Push Notifications aktivieren" geklickt haben
   - Browser-Berechtigung muss erteilt sein

3. **HTTPS erforderlich:**
   - Push Notifications funktionieren nur über HTTPS (außer localhost)

4. **Ungültige Subscriptions:**
   - Ungültige Subscriptions werden automatisch aus der Datenbank entfernt

---

## Beispiele für verschiedene Events

### Gast hinzugefügt
```typescript
await sendPushNotificationFromServer({
  title: 'Neuer Gast hinzugefügt',
  body: `Gast "${guest.name}" wurde zur Liste hinzugefügt`,
  url: '/dashboard/guests',
  tag: 'guest-added'
})
```

### Aufgabe zugewiesen
```typescript
await sendPushNotificationFromServer({
  title: 'Neue Aufgabe zugewiesen',
  body: `Aufgabe "${task.title}" wurde dir zugewiesen`,
  url: `/dashboard/${task.category.toLowerCase()}`,
  userId: task.assignedTo,
  tag: 'task-assigned'
})
```

### Checklist Item abgeschlossen
```typescript
await sendPushNotificationFromServer({
  title: 'Checklist Item abgeschlossen',
  body: `"${item.title}" wurde abgeschlossen`,
  url: `/dashboard/${item.category.toLowerCase()}`,
  userId: item.assignedTo || undefined,
  tag: 'checklist-completed'
})
```

### Wichtige Notiz erstellt
```typescript
await sendPushNotificationFromServer({
  title: 'Neue Notiz',
  body: `Notiz "${note.title}" wurde erstellt`,
  url: `/dashboard/${note.category?.toLowerCase() || 'notes'}`,
  tag: 'note-created'
})
```
