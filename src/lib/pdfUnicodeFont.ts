import type { PDFDocument, PDFFont } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'

/** Gleiche Reihenfolge wie bei VIP-Namensschildern: Arimo (Arial-ähnlich), dann Noto Sans – volle Unicode/Türkisch-Unterstützung. */
const UNICODE_FONT_URLS = [
  'https://github.com/google/fonts/raw/main/ofl/arimo/Arimo-Regular.ttf',
  'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/arimo/Arimo-Regular.ttf',
  'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/notosans/NotoSans-Regular.ttf',
  'https://github.com/google/fonts/raw/main/ofl/notosans/NotoSans-Regular.ttf',
]

const FONT_FETCH_HEADERS = {
  Accept: 'application/octet-stream, application/font-ttf, font/ttf, font/otf, */*',
  'User-Agent': 'Mozilla/5.0 (compatible; pdf-lib-font-loader)',
}

/**
 * Registriert Fontkit und lädt eine Unicode-Schrift (Arimo/NotoSans) für PDFs.
 * Damit können türkische Zeichen (ğ, ş, ı, ü, ö, ç, İ, …) ausgegeben werden – kein WinAnsi/Helvetica.
 */
export async function loadUnicodeFontForPdf(pdfDoc: PDFDocument): Promise<PDFFont | null> {
  try {
    ;(pdfDoc as PDFDocument & { registerFontkit: (fk: unknown) => void }).registerFontkit(fontkit)
  } catch {
    return null
  }
  for (const url of UNICODE_FONT_URLS) {
    try {
      const res = await fetch(url, { headers: FONT_FETCH_HEADERS })
      if (res.ok) {
        const bytes = await res.arrayBuffer()
        if (bytes.byteLength > 1000) {
          return (await pdfDoc.embedFont(bytes)) as PDFFont
        }
      }
    } catch {
      continue
    }
  }
  return null
}

/** Entfernt nur Emojis/Sonderzeichen, die in Schriftarten oft fehlen; behält türkische Buchstaben (ğ, ş, ı, ü, ö, ç, İ, …). */
export function pdfSafeTextForUnicode(text: string): string {
  return (text || '')
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
    .replace(/📅|🕰|📍/g, '')
    .replace(/\r?\n/g, ' ')
    .trim()
    .slice(0, 300)
}

/** Für Helvetica/WinAnsi: Türkische Zeichen durch ASCII ersetzen, damit drawText nicht wirft. Nur verwenden, wenn kein Unicode-Font geladen wurde. */
export function pdfSafeTextForWinAnsi(text: string): string {
  const m: Record<string, string> = {
    İ: 'I', ı: 'i', Ş: 'S', ş: 's', Ğ: 'G', ğ: 'g', Ü: 'U', ü: 'u', Ö: 'O', ö: 'o', Ç: 'C', ç: 'c',
  }
  let out = (text || '')
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
    .replace(/📅|🕰|📍/g, '')
    .replace(/\r?\n/g, ' ')
    .trim()
    .slice(0, 300)
  for (const [k, v] of Object.entries(m)) out = out.replace(new RegExp(k, 'g'), v)
  // Alle Zeichen außerhalb WinAnsi (0x20–0xFF) durch ? ersetzen, damit pdf-lib drawText nicht wirft
  out = out.replace(/[^\x20-\xFF]/g, '?')
  return out
}
