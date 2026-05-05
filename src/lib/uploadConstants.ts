// Hard limits & allowed types for video uploads.
// 5 GB = Supabase bucket "videos" file_size_limit.
export const MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024; // 5 368 709 120

// 6 MB = Supabase TUS requirement (chunk size must be multiple of 6MB).
export const TUS_CHUNK_SIZE = 6 * 1024 * 1024;

// Files smaller than this go through standard `supabase.storage.upload()`.
// Above this, switch to resumable TUS.
export const TUS_THRESHOLD = 6 * 1024 * 1024;

// Bump this when upload pipeline changes in a way that should invalidate
// any in-flight TUS fingerprints saved in the user's localStorage.
// 2026-05-05: cleared corrupted-byte stripping; force fresh uploads.
export const UPLOAD_PIPELINE_VERSION = "v2-2026-05-05";

export const ALLOWED_VIDEO_MIME = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-matroska",
  "video/x-msvideo",
  "video/avi",
  "video/mpeg",
  "video/3gpp",
  "video/ogg",
  "application/octet-stream", // some browsers report this for .mkv etc.
]);

export const ALLOWED_VIDEO_EXT = /\.(mp4|m4v|mov|webm|mkv|avi|mpeg|mpg|3gp|ogv)$/i;

export function isAllowedVideo(file: File): boolean {
  if (file.type && ALLOWED_VIDEO_MIME.has(file.type.toLowerCase())) return true;
  return ALLOWED_VIDEO_EXT.test(file.name);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function formatSpeed(bytesPerSec: number): string {
  if (!isFinite(bytesPerSec) || bytesPerSec <= 0) return "—";
  return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
}

export function formatEta(seconds: number): string {
  if (!isFinite(seconds) || seconds <= 0) return "—";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

/**
 * One-time clear of stale TUS fingerprints from previous pipeline versions.
 * Old fingerprints may resume an upload of bytes that were corrupted by the
 * old metadata-stripping logic. Run this once per browser per version.
 */
export function clearStaleTusFingerprints() {
  try {
    const flagKey = "tus-pipeline-version";
    const seen = localStorage.getItem(flagKey);
    if (seen === UPLOAD_PIPELINE_VERSION) return;

    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("tus::")) toRemove.push(k);
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
    localStorage.setItem(flagKey, UPLOAD_PIPELINE_VERSION);
    if (toRemove.length) {
      console.info(`[upload] cleared ${toRemove.length} stale TUS fingerprints (pipeline ${UPLOAD_PIPELINE_VERSION})`);
    }
  } catch (e) {
    console.warn("[upload] failed to clear TUS fingerprints", e);
  }
}
