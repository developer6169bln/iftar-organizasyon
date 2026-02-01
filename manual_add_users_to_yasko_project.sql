-- Alle vorhandenen User werden Projektmitarbeiter von yasko1461@gmail.com
-- (Inhaber yasko1461@gmail.com bleibt Inhaber und wird nicht doppelt als Mitglied eingetragen.)
-- Railway/Supabase: SQL ausführen. Mehrfach ausführbar (ON CONFLICT ignoriert bestehende Einträge).

INSERT INTO "project_members" ("id", "projectId", "userId", "role", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  p.id,
  u.id,
  'MEMBER',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "projects" p
CROSS JOIN "users" u
WHERE LOWER((SELECT email FROM "users" WHERE id = p."ownerId")) = 'yasko1461@gmail.com'
  AND u.id != p."ownerId"
  AND NOT EXISTS (SELECT 1 FROM "project_members" pm WHERE pm."projectId" = p.id AND pm."userId" = u.id)
ON CONFLICT ("projectId", "userId") DO NOTHING;
