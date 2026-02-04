-- Add category to email_templates (optional: "" = global, else category key from guest list)
ALTER TABLE "email_templates" ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT '';

-- Drop old unique so we can have one default per (language, category) in app logic
DROP INDEX IF EXISTS "email_templates_language_isDefault_key";
