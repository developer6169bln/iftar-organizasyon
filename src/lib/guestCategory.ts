/**
 * Kategorie aus der Gästeliste (additionalData: "Kategorie" / "Kategori" etc.)
 * kann auf Türkisch oder Deutsch geschrieben sein.
 * Normalisierung auf einen kanonischen Key für Template-Zuordnung (DE/TR/EN).
 */

export type CategoryLabels = { de: string; tr: string; en: string }

/** Bekannte Kategorien: kanonischer Key -> Bezeichnungen in DE, TR, EN */
export const GUEST_CATEGORY_LABELS: Record<string, CategoryLabels> = {
  protokol: { de: 'Protokoll', tr: 'Protokol', en: 'Protocol' },
  gasteliste: { de: 'Gästeliste', tr: 'Davet Listesi', en: 'Guest List' },
  diplomatik: { de: 'Diplomatik', tr: 'Diplomatik', en: 'Diplomatic' },
  medien: { de: 'Medien', tr: 'Medya', en: 'Media' },
  vip: { de: 'VIP', tr: 'VIP', en: 'VIP' },
  wirtschaft: { de: 'Wirtschaft', tr: 'İş Dünyası', en: 'Business' },
  wissenschaft: { de: 'Wissenschaft', tr: 'Bilim', en: 'Science' },
  kultur: { de: 'Kultur', tr: 'Kültür', en: 'Culture' },
  religion: { de: 'Religion', tr: 'Din', en: 'Religion' },
  politik: { de: 'Politik', tr: 'Siyaset', en: 'Politics' },
  sport: { de: 'Sport', tr: 'Spor', en: 'Sports' },
  andere: { de: 'Andere', tr: 'Diğer', en: 'Other' },
}

/** Alle kanonischen Kategorie-Keys (für Dropdown / „Templates pro Kategorie“). */
export function getKnownCategoryKeys(): string[] {
  return Object.keys(GUEST_CATEGORY_LABELS)
}

/** Labels für eine Kategorie (DE/TR/EN). */
export function getCategoryLabel(key: string, lang: 'de' | 'tr' | 'en'): string {
  const labels = GUEST_CATEGORY_LABELS[key]
  return labels?.[lang] ?? key
}

/** Normalisierter String für Vergleiche (lowercase, trim). */
function normalize(s: string): string {
  return String(s).trim().toLowerCase()
}

/**
 * Liest die Kategorie eines Gastes aus additionalData.
 * Sucht nach Keys: "Kategorie", "Kategori", "Category" (TR/DE/EN Schreibweise).
 */
export function getGuestCategoryFromAdditionalData(guest: {
  additionalData?: string | null
}): string {
  if (!guest?.additionalData) return ''
  try {
    const ad = typeof guest.additionalData === 'string' ? JSON.parse(guest.additionalData) : guest.additionalData
    if (!ad || typeof ad !== 'object') return ''
    const raw =
      ad['Kategorie'] ?? ad['Kategori'] ?? ad['Category'] ?? ad['kategorie'] ?? ad['kategori'] ?? ad['category'] ?? ''
    const value = raw != null ? String(raw).trim() : ''
    return value
  } catch {
    return ''
  }
}

/**
 * Mappt einen Kategorie-Text aus der Gästeliste (kann TR oder DE sein) auf den kanonischen Key.
 * Vergleicht mit allen bekannten DE/TR/EN Bezeichnungen; bei Treffer wird der Key zurückgegeben.
 * Bei keinem Treffer: normalisierter Wert (lowercase, Leerzeichen durch _) oder "".
 */
export function normalizeGuestCategoryToKey(guestCategoryValue: string): string {
  const n = normalize(guestCategoryValue)
  if (!n) return ''

  for (const [key, labels] of Object.entries(GUEST_CATEGORY_LABELS)) {
    if (normalize(labels.de) === n || normalize(labels.tr) === n || normalize(labels.en) === n) return key
  }

  // Teilweise Übereinstimmung (z. B. "Protokol" ohne l)
  for (const [key, labels] of Object.entries(GUEST_CATEGORY_LABELS)) {
    if (normalize(labels.de).startsWith(n) || n.startsWith(normalize(labels.de))) return key
    if (normalize(labels.tr).startsWith(n) || n.startsWith(normalize(labels.tr))) return key
    if (normalize(labels.en).startsWith(n) || n.startsWith(normalize(labels.en))) return key
  }

  // Unbekannte Kategorie: als Key verwenden (bereinigt)
  return n.replace(/\s+/g, '_')
}

/**
 * Kategorie-Key eines Gastes (aus additionalData, TR/DE-tauglich normalisiert).
 */
export function getGuestCategoryKey(guest: { additionalData?: string | null }): string {
  const value = getGuestCategoryFromAdditionalData(guest)
  return normalizeGuestCategoryToKey(value)
}
