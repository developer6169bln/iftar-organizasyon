# Railway: JotForm-Formulare – Migration in Schritten

**Wo ausführen:** Railway Dashboard → PostgreSQL-Service → Tab Query

Die Schritte **nacheinander** ausführen. Bei Schritt 5: Wenn ein Foreign Key schon existiert, Fehlermeldung ignorieren und mit Schritt 6 weitermachen.

| Schritt | Datei | Inhalt |
|--------|--------|--------|
| 1 | step1_create_jotform_forms.sql | Tabelle jotform_forms |
| 2 | step2_create_jotform_form_fields.sql | Tabelle jotform_form_fields |
| 3 | step3_create_jotform_submissions.sql | Tabelle jotform_submissions |
| 4 | step4_create_jotform_permissions.sql | Tabelle project_member_jotform_permissions |
| 5 | step5_add_foreign_keys.sql | Foreign Keys |
| 6 | step6_mark_prisma_migration.sql | Prisma-Migration markieren |

**Alternativ:** Gesamte Datei `manual_migration_jotform_forms.sql` im Projektroot einmal ausführen (idempotent mit IF NOT EXISTS).
