-- Remove Mailgun columns from email_configs
ALTER TABLE "email_configs" DROP COLUMN IF EXISTS "mailgunDomain";
ALTER TABLE "email_configs" DROP COLUMN IF EXISTS "mailgunApiKey";
ALTER TABLE "email_configs" DROP COLUMN IF EXISTS "mailgunRegion";
