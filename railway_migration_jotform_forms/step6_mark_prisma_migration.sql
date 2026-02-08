-- SCHRITT 6: Prisma-Migration als angewendet markieren

INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
SELECT gen_random_uuid()::text, '', NOW(), '20260215120000_add_jotform_forms', NULL, NULL, NOW(), 1
WHERE NOT EXISTS (SELECT 1 FROM "_prisma_migrations" WHERE migration_name = '20260215120000_add_jotform_forms');

SELECT 'Migration markiert' AS status;
