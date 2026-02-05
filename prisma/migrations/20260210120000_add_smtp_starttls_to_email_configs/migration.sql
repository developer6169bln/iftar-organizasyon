-- Add STARTTLS option for own mail server (SMTP/IMAP)
ALTER TABLE "email_configs" ADD COLUMN "smtpUseStartTls" BOOLEAN NOT NULL DEFAULT false;
