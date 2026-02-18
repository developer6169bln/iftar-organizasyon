-- AlterTable
ALTER TABLE "invitations" ADD COLUMN IF NOT EXISTS "whatsappSentAt" TIMESTAMP(3);
