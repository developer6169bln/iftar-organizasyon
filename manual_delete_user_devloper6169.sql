-- User devloper6169@gmail.com (bzw. developer6169@gmail.com) löschen
-- Railway/Supabase: SQL ausführen.

-- Variante 1: Direkt löschen (funktioniert, wenn ON DELETE CASCADE gesetzt ist)
DELETE FROM "users"
WHERE LOWER(email) = 'devloper6169@gmail.com';

-- Falls die E-Mail developer6169@gmail.com heißen soll, stattdessen:
-- DELETE FROM "users" WHERE LOWER(email) = 'developer6169@gmail.com';

-- Variante 2: Falls Fremdschlüssel-Fehler auftreten – zuerst abhängige Tabellen leeren, dann User:
-- DELETE FROM "project_member_page_permissions" WHERE "userId" IN (SELECT id FROM "users" WHERE LOWER(email) = 'devloper6169@gmail.com');
-- DELETE FROM "project_member_category_permissions" WHERE "userId" IN (SELECT id FROM "users" WHERE LOWER(email) = 'devloper6169@gmail.com');
-- DELETE FROM "project_members" WHERE "userId" IN (SELECT id FROM "users" WHERE LOWER(email) = 'devloper6169@gmail.com');
-- DELETE FROM "user_page_permissions" WHERE "userId" IN (SELECT id FROM "users" WHERE LOWER(email) = 'devloper6169@gmail.com');
-- DELETE FROM "user_category_permissions" WHERE "userId" IN (SELECT id FROM "users" WHERE LOWER(email) = 'devloper6169@gmail.com');
-- DELETE FROM "users" WHERE LOWER(email) = 'devloper6169@gmail.com';
