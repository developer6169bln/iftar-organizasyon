import { join } from 'path'

/**
 * Verzeichnis für Uploads.
 * Standard: public/uploads.
 * Auf Railway: UPLOAD_DIR auf ein Volume setzen (z. B. /data/uploads), damit Uploads nach Deploy erhalten bleiben.
 */
export function getUploadDir(): string {
  const base = process.env.UPLOAD_DIR || join(process.cwd(), 'public', 'uploads')
  return base
}
