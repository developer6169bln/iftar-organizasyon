import { join } from 'path'

/**
 * Verzeichnis für Grundriss-Uploads.
 * - UPLOAD_DIR gesetzt (z.B. Railway Volume /data/uploads) → nutzen.
 * - Production ohne UPLOAD_DIR → /tmp/uploads (Railway-Container sind oft read-only außer /tmp).
 * - Sonst → public/uploads (lokal).
 */
export function getUploadsDir(): string {
  if (process.env.UPLOAD_DIR) {
    return process.env.UPLOAD_DIR
  }
  if (process.env.NODE_ENV === 'production') {
    return '/tmp/uploads'
  }
  return join(process.cwd(), 'public', 'uploads')
}

/** Dateiname aus floorPlanUrl (z.B. /uploads/floorplan-xxx.jpg → floorplan-xxx.jpg). */
export function getFileNameFromFloorPlanUrl(floorPlanUrl: string | null): string | null {
  if (!floorPlanUrl || typeof floorPlanUrl !== 'string') return null
  const parts = floorPlanUrl.replace(/^\/+/, '').split('/')
  const name = parts[parts.length - 1]
  return name && !name.includes('..') ? name : null
}
