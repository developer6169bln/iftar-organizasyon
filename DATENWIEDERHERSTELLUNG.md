# Datenwiederherstellung nach versehentlichem Löschen

## Wenn Einladungsliste, Zusagen oder Absagen gelöscht wurden

Beim Import im Modus **„Ersetzen“** werden alle Gäste und Einladungen (inkl. Zusagen/Absagen) für das Event **unwiderruflich gelöscht**. Die Anwendung speichert keine Sicherungskopie – ein „Rückgängig“ gibt es nur über die Datenbank.

---

## Option 1: Datenbank-Backup / Point-in-Time Recovery

### Railway

- Railway stellt **keine automatische Wiederherstellung** von gelöschten Daten bereit, sofern Sie kein eigenes Backup angelegt haben.
- **Backup anlegen (für die Zukunft):**
  - In der Railway-Dokumentation: [PostgreSQL Backups](https://docs.railway.app/databases/postgresql#backups)
  - Manuell z. B. mit `pg_dump` (siehe unten).
- Wenn Sie vor dem Import ein **manuelles Backup** (z. B. mit `pg_dump`) erstellt haben, können Sie die Datenbank oder einzelne Tabellen daraus wiederherstellen.

### Supabase

- Unter **Database → Backups** prüfen, ob Backups aktiv sind.
- Bei **Point in Time Recovery (PITR)** kann die Datenbank auf einen Zeitpunkt **vor** dem Import zurückgesetzt werden (in der Regel nur bei bezahlten Plänen).

### Eigener PostgreSQL-Server

- Backup von Ihrem Anbieter oder von geplanten `pg_dump`-Läufen verwenden und die Datenbank bzw. die betroffenen Tabellen daraus wiederherstellen.

---

## Option 2: Manuelles Backup mit pg_dump (für künftige Fälle)

Vor einem riskanten Schritt (z. B. Import „Ersetzen“) können Sie ein Backup erstellen:

```bash
# DATABASE_URL aus Railway/Supabase in Umgebungsvariablen oder hier eintragen
pg_dump "$DATABASE_URL" -F c -f backup_$(date +%Y%m%d_%H%M).dump
```

Wiederherstellung (überschreibt die aktuelle Datenbank):

```bash
pg_restore -d "$DATABASE_URL" --clean --if-exists backup_YYYYMMDD_HHMM.dump
```

---

## Option 3: Alte Gästeliste-Datei wieder importieren

- Wenn Sie noch eine **CSV/Excel-Datei** der Gästeliste **von vor dem Unglücks-Import** haben:
  - Import im Modus **„Ersetzen“** (mit Bestätigung) ausführen.
  - Damit wird die aktuelle Liste durch den Inhalt der Datei ersetzt.
  - **Hinweis:** Zusagen/Absagen aus der App sind in der Datei in der Regel **nicht** enthalten – nur die Gästeliste wird wiederhergestellt, nicht die Einladungs- und Antwort-Status.

---

## Zusammenfassung

| Situation | Möglichkeit |
|-----------|-------------|
| Kein Backup, keine alte Datei | **Keine** technische Wiederherstellung der gelöschten Daten möglich. |
| Datenbank-Backup vorhanden | Datenbank oder betroffene Tabellen aus dem Backup wiederherstellen. |
| Nur alte CSV/Excel-Gästeliste | Import „Ersetzen“ mit dieser Datei – stellt nur die Gäste wieder her, **nicht** Zusagen/Absagen. |

---

## Schutz vor versehentlichem Löschen (bereits umgesetzt)

- Beim Import **„Ersetzen“** ist eine **Checkbox** nötig: Sie müssen bestätigen, dass alle Gäste und Einladungen (Zusagen/Absagen) gelöscht werden.
- Zusätzlich erscheint ein **Bestätigungsdialog** vor dem Import.
- Die API führt einen Ersetzen-Import nur aus, wenn der Bestätigungscode mitgesendet wird (nach Ankreuzen der Checkbox).

Vor riskanten Aktionen wird empfohlen, ein manuelles Backup (z. B. mit `pg_dump`) zu erstellen.
