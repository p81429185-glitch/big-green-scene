/**
 * NO-OP. Previously this stripped MP4 udta/meta atoms client-side, which
 * shifted mdat without updating stco/co64 and corrupted large files.
 * Mux strips identifying container metadata server-side anyway.
 *
 * Kept as a thin pass-through so existing imports compile. DO NOT add
 * byte-rewriting logic here — corruption of large MP4s was the root
 * cause of every "uploaded but destroyed" file >300MB.
 */
export async function stripVideoMetadata(file: File): Promise<File> {
  return file;
}
