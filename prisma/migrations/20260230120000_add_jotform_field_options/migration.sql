-- AlterTable: Optionen für Dropdown, Radio, Checkbox (value/label) in jotform_form_fields
ALTER TABLE "jotform_form_fields" ADD COLUMN IF NOT EXISTS "options" JSONB;
