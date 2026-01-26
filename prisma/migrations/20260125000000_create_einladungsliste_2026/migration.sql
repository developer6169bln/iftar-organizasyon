-- Migration: Erstelle neue Tabelle einladungsliste_2026 und lösche alle alten Gästelisten-Daten

-- 1. Lösche alle Daten aus der guests Tabelle (Foreign Key Constraints beachten)
-- Zuerst löschen wir alle Invitations, die auf Guests verweisen (falls Tabelle existiert)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'invitations') THEN
        DELETE FROM invitations;
    END IF;
END $$;

-- Dann löschen wir alle Guests (falls Tabelle existiert)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'guests') THEN
        DELETE FROM guests;
    END IF;
END $$;

-- 2. Erstelle die neue Tabelle einladungsliste_2026
CREATE TABLE einladungsliste_2026 (
    id SERIAL PRIMARY KEY,

    einladung_geschickt BOOLEAN NOT NULL DEFAULT FALSE,
    absage BOOLEAN NOT NULL DEFAULT FALSE,
    zusage BOOLEAN NOT NULL DEFAULT FALSE,
    einladungsliste BOOLEAN NOT NULL DEFAULT FALSE,

    kategorie VARCHAR(100),
    staat_institution VARCHAR(255),

    anrede_1 VARCHAR(100),
    anrede_2 VARCHAR(100),
    anrede_3 VARCHAR(100),
    anrede_4 VARCHAR(100),

    vorname VARCHAR(150),
    nachname VARCHAR(150),

    email_kurumsal VARCHAR(255),
    email_privat VARCHAR(255),

    schlussformel VARCHAR(255),

    mobil VARCHAR(50),
    telefon VARCHAR(50),

    strasse VARCHAR(255),
    plz VARCHAR(10),
    ort VARCHAR(100)
);

-- 3. Erstelle Indizes für bessere Performance
CREATE INDEX idx_einladungsliste_2026_kategorie ON einladungsliste_2026(kategorie);
CREATE INDEX idx_einladungsliste_2026_einladung_geschickt ON einladungsliste_2026(einladung_geschickt);
CREATE INDEX idx_einladungsliste_2026_zusage ON einladungsliste_2026(zusage);
CREATE INDEX idx_einladungsliste_2026_absage ON einladungsliste_2026(absage);
CREATE INDEX idx_einladungsliste_2026_email_kurumsal ON einladungsliste_2026(email_kurumsal);
CREATE INDEX idx_einladungsliste_2026_email_privat ON einladungsliste_2026(email_privat);
