-- Add optional sender display name to email_configs (Absender-Anzeigename)
ALTER TABLE "email_configs" ADD COLUMN IF NOT EXISTS "senderName" TEXT;
