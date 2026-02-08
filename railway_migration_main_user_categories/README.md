# Railway: Hauptbenutzer-Kategorien – Migration in Schritten

**Wo ausführen:** Railway Dashboard → dein Projekt → **PostgreSQL**-Service (Datenbank) → Tab **Query**

Die Schritte **nacheinander** ausführen. Erst wenn ein Schritt ohne Fehler durchgelaufen ist, den nächsten ausführen.

| Schritt | Datei | Inhalt |
|--------|--------|--------|
| 1 | `step1_create_table.sql` | Leere Tabelle `main_user_categories` anlegen |
| 2 | `step2_create_index.sql` | Eindeutigen Index auf `key` anlegen |
| 3 | `step3_add_column_to_users.sql` | Spalte `mainUserCategoryId` in `users` hinzufügen |
| 4 | `step4_insert_categories.sql` | 14 Kategorien (Baskan, Sekreter, …) einfügen |
| 5 | `step5_add_foreign_key.sql` | Foreign Key von `users` zu `main_user_categories` |
| 6 | `step6_mark_prisma_migration.sql` | Prisma-Migration als angewendet markieren |
| 7 | `step7_verify.sql` | Prüfung: eine Zeile mit `status=OK`, `anzahl_kategorien=14` |

Nach Schritt 7 ist die Migration abgeschlossen.
