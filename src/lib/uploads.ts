import { join } from 'path'

/** Verzeichnis für Grundriss-Uploads (Railway: UPLOAD_DIR z.B. /data/uploads für Volume). */
export function getUploadsDir(): string {
  const base = process.env.UPLOAD_DIR || join(process.cwd(), 'public', 'uploads')
  return base
}

/** Dateiname aus floorPlanUrl (z.B. /uploads/floorplan-xxx.jpg → floorplan-xxx.jpg). */
export function getFileNameFromFloorPlanUrl(floorPlanUrl: string | null): string | null {
  if (!floorPlanUrl || typeof floorPlanUrl !== 'string') return null
  const parts = floorPlanUrl.replace(/^\/+/, '').split('/')
  const name = parts[parts.length - 1]
  return name && !name.includes('..') ? name : null
}
