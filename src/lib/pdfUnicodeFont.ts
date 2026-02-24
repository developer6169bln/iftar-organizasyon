import type { PDFDocument, PDFFont } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'

/** NotoSans unterstützt Türkisch (ğ, ş, ı, ü, ö, ç, İ, …) und weitere Unicode-Zeichen. */
const UNICODE_FONT_URLS = [
  'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/notosans/NotoSans-Regular.ttf',
  'https://github.com/google/fonts/raw/main/ofl/notosans/NotoSans-Regular.ttf',
  'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/arimo/Arimo-Regular.ttf',
]

/**
 * Registriert Fontkit und lädt eine Unicode-Schrift (z. B. NotoSans) für PDFs.
 * Damit können türkische Zeichen (ğ, ş, ı, ü, ö, ç, İ, …) und andere Unicode-Zeichen ausgegeben werden.
 * Kein WinAnsi/Helvetica, das nur Latin-1 unterstützt.
 */
export async function loadUnicodeFontForPdf(pdfDoc: PDFDocument): Promise<PDFFont | null> {
  try {
    ;(pdfDoc as PDFDocument & { registerFontkit: (fk: unknown) => void }).registerFontkit(fontkit)
  } catch {
    return null
  }
  for (const url of UNICODE_FONT_URLS) {
    try {
      const res = await fetch(url, {
        headers: { Accept: 'font/ttf, application/octet-stream, */*' },
      })
      if (res.ok) {
        const bytes = await res.arrayBuffer()
        if (bytes.byteLength > 1000) {
          return await pdfDoc.embedFont(bytes) as PDFFont
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
