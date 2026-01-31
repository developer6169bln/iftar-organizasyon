-- Add Mailjet fields to email_configs
ALTER TABLE "email_configs" ADD COLUMN "mailjetApiKey" TEXT;
ALTER TABLE "email_configs" ADD COLUMN "mailjetApiSecret" TEXT;
