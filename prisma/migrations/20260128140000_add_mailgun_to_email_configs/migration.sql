-- Add Mailgun fields to email_configs
ALTER TABLE "email_configs"
ADD COLUMN "mailgunDomain" TEXT,
ADD COLUMN "mailgunApiKey" TEXT,
ADD COLUMN "mailgunRegion" TEXT;

