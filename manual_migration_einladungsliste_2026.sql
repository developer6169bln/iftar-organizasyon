-- ============================================
-- MANUELLE MIGRATION: Einladungsliste 2026
-- ============================================
-- Diese SQL-Anweisung kann direkt in der Datenbank ausgeführt werden
-- (z.B. über psql, pgAdmin, oder Supabase SQL Editor)
--
-- WICHTIG: Diese Migration löscht ALLE Daten aus der guests und invitations Tabelle!
-- ============================================

-- 1. Lösche alle Daten aus der invitations Tabelle (falls vorhanden)
--    Dies ist notwendig wegen Foreign Key Constraints
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'invitations') THEN
        DELETE FROM invitations;
        RAISE NOTICE 'Alle Daten aus invitations Tabelle gelöscht';
    ELSE
        RAISE NOTICE 'invitations Tabelle existiert nicht, wird übersprungen';
    END IF;
END $$;

-- 2. Lösche alle Daten aus der guests Tabelle
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'guests') THEN
        DELETE FROM guests;
        RAISE NOTICE 'Alle Daten aus guests Tabelle gelöscht';
    ELSE
        RAISE NOTICE 'guests Tabelle existiert nicht, wird übersprungen';
    END IF;
END $$;

-- 3. Erstelle die neue Tabelle einladungsliste_2026
--    Falls die Tabelle bereits existiert, wird sie zuerst gelöscht
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'einladungsliste_2026') THEN
        DROP TABLE einladungsliste_2026 CASCADE;
        RAISE NOTICE 'Bestehende einladungsliste_2026 Tabelle gelöscht';
    END IF;
END $$;

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

-- 4. Erstelle Indizes für bessere Performance
CREATE INDEX idx_einladungsliste_2026_kategorie ON einladungsliste_2026(kategorie);
CREATE INDEX idx_einladungsliste_2026_einladung_geschickt ON einladungsliste_2026(einladung_geschickt);
CREATE INDEX idx_einladungsliste_2026_zusage ON einladungsliste_2026(zusage);
CREATE INDEX idx_einladungsliste_2026_absage ON einladungsliste_2026(absage);
CREATE INDEX idx_einladungsliste_2026_email_kurumsal ON einladungsliste_2026(email_kurumsal);
CREATE INDEX idx_einladungsliste_2026_email_privat ON einladungsliste_2026(email_privat);

-- 5. Bestätigung
DO $$
BEGIN
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Migration erfolgreich abgeschlossen!';
    RAISE NOTICE 'Tabelle einladungsliste_2026 wurde erstellt.';
    RAISE NOTICE '============================================';
END $$;
