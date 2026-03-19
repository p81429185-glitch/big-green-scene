/**
 * Strip metadata (GPS, device info, etc.) from MP4/MOV files client-side.
 * Uses a chunked approach: only reads the first 10MB and last 2MB to find
 * metadata boxes, avoiding loading the entire file into memory.
 */

const STRIP_TYPES = new Set(["udta", "meta"]);
const MP4_SIGNATURES = new Set(["ftyp"]);

const HEAD_SIZE = 10 * 1024 * 1024; // 10MB
const TAIL_SIZE = 2 * 1024 * 1024;  // 2MB

function readAtomHeader(view: DataView, offset: number): { size: number; type: string } | null {
  if (offset + 8 > view.byteLength) return null;
  const size = view.getUint32(offset);
  const type = String.fromCharCode(
    view.getUint8(offset + 4),
    view.getUint8(offset + 5),
    view.getUint8(offset + 6),
    view.getUint8(offset + 7)
  );
  return { size, type };
}

function getAtomSize(view: DataView, offset: number, header: { size: number; type: string }, chunkLen: number): number {
  if (header.size === 1) {
    if (offset + 16 > chunkLen) return chunkLen - offset;
    const hi = view.getUint32(offset + 8);
    const lo = view.getUint32(offset + 12);
    return hi * 0x100000000 + lo;
  }
  if (header.size === 0) {
    return chunkLen - offset;
  }
  return header.size;
}

/** Recursively filter sub-atoms inside a container atom, removing udta/meta */
function filterContainerAtom(buffer: ArrayBuffer, start: number, end: number): Uint8Array[] {
  const view = new DataView(buffer);
  const kept: Uint8Array[] = [];
  let offset = start;

  while (offset < end) {
    const header = readAtomHeader(view, offset);
    if (!header) break;

    const atomSize = getAtomSize(view, offset, header, end);
    if (atomSize < 8 || offset + atomSize > end) break;

    if (STRIP_TYPES.has(header.type)) {
      offset += atomSize;
      continue;
    }

    const CONTAINER_TYPES = new Set(["trak", "mdia", "minf", "stbl", "edts"]);
    if (CONTAINER_TYPES.has(header.type)) {
      const headerLen = header.size === 1 ? 16 : 8;
      const childStart = offset + headerLen;
      const childEnd = offset + atomSize;
      const filteredChildren = filterContainerAtom(buffer, childStart, childEnd);

      const childrenSize = filteredChildren.reduce((sum, c) => sum + c.byteLength, 0);
      const newSize = headerLen + childrenSize;
      const newHeader = new Uint8Array(headerLen);
      const hView = new DataView(newHeader.buffer);
      hView.setUint32(0, newSize);
      newHeader[4] = header.type.charCodeAt(0);
      newHeader[5] = header.type.charCodeAt(1);
      newHeader[6] = header.type.charCodeAt(2);
      newHeader[7] = header.type.charCodeAt(3);

      kept.push(newHeader);
      filteredChildren.forEach((c) => kept.push(c));
    } else {
      kept.push(new Uint8Array(buffer, offset, atomSize));
    }

    offset += atomSize;
  }

  return kept;
}

/**
 * For small files (≤HEAD_SIZE): use the original full-buffer approach.
 * For large files: scan head and tail chunks only.
 */
export async function stripVideoMetadata(file: File): Promise<File> {
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();

  const isMP4 = type === "video/mp4" || type === "video/quicktime" ||
    name.endsWith(".mp4") || name.endsWith(".mov") || name.endsWith(".m4v");

  if (!isMP4) return file;

  try {
    // Small file: process entirely in memory (safe)
    if (file.size <= HEAD_SIZE) {
      return await stripSmallFile(file);
    }

    // Large file: chunked approach
    return await stripLargeFile(file);
  } catch (err) {
    console.error("stripVideoMetadata failed, returning original:", err);
    return file;
  }
}

/** Original full-buffer approach for files ≤10MB */
async function stripSmallFile(file: File): Promise<File> {
  const buffer = await file.arrayBuffer();
  const view = new DataView(buffer);

  const firstHeader = readAtomHeader(view, 0);
  if (!firstHeader || !MP4_SIGNATURES.has(firstHeader.type)) return file;

  const parts: Uint8Array[] = [];
  let offset = 0;
  let modified = false;

  while (offset < buffer.byteLength) {
    const header = readAtomHeader(view, offset);
    if (!header) break;

    const atomSize = getAtomSize(view, offset, header, buffer.byteLength);
    if (atomSize < 8) break;

    if (header.type === "moov") {
      const headerLen = header.size === 1 ? 16 : 8;
      const childStart = offset + headerLen;
      const childEnd = offset + atomSize;
      const filteredChildren = filterContainerAtom(buffer, childStart, childEnd);

      const childrenSize = filteredChildren.reduce((sum, c) => sum + c.byteLength, 0);
      const originalChildrenSize = atomSize - headerLen;

      if (childrenSize !== originalChildrenSize) {
        modified = true;
        const newSize = headerLen + childrenSize;
        const newHeader = new Uint8Array(headerLen);
        const hView = new DataView(newHeader.buffer);
        hView.setUint32(0, newSize);
        newHeader[4] = 0x6D; newHeader[5] = 0x6F; newHeader[6] = 0x6F; newHeader[7] = 0x76;
        parts.push(newHeader);
        filteredChildren.forEach((c) => parts.push(c));
      } else {
        parts.push(new Uint8Array(buffer, offset, atomSize));
      }
    } else {
      parts.push(new Uint8Array(buffer, offset, atomSize));
    }

    offset += atomSize;
    if (offset <= 0) break;
  }

  if (!modified) return file;

  const blob = new Blob(parts as BlobPart[], { type: file.type || "video/mp4" });
  return new File([blob], file.name, { type: file.type || "video/mp4", lastModified: file.lastModified });
}

/**
 * Chunked approach for large files:
 * 1. Read first 10MB — scan top-level atoms to find moov location
 * 2. If moov is fully within the head chunk, strip it there
 * 3. If moov is at the end, read the tail and strip there
 * 4. Reassemble using Blob slices (middle of file is never loaded into RAM)
 */
async function stripLargeFile(file: File): Promise<File> {
  // Read head chunk to find top-level atom layout
  const headBytes = Math.min(HEAD_SIZE, file.size);
  const headBuffer = await file.slice(0, headBytes).arrayBuffer();
  const headView = new DataView(headBuffer);

  // Verify MP4
  const firstHeader = readAtomHeader(headView, 0);
  if (!firstHeader || !MP4_SIGNATURES.has(firstHeader.type)) return file;

  // Build a map of top-level atoms from the head chunk
  // We can determine atom boundaries from headers even if the atom extends beyond our chunk
  interface AtomInfo { offset: number; size: number; type: string }
  const topAtoms: AtomInfo[] = [];
  let offset = 0;

  while (offset < headBytes) {
    const header = readAtomHeader(headView, offset);
    if (!header) break;

    // For size calculation, use file.size as the ultimate boundary for size=0 atoms
    let atomSize: number;
    if (header.size === 1) {
      if (offset + 16 > headBytes) break;
      const hi = headView.getUint32(offset + 8);
      const lo = headView.getUint32(offset + 12);
      atomSize = hi * 0x100000000 + lo;
    } else if (header.size === 0) {
      atomSize = file.size - offset;
    } else {
      atomSize = header.size;
    }

    if (atomSize < 8) break;

    topAtoms.push({ offset, size: atomSize, type: header.type });
    offset += atomSize;
    if (offset <= 0) break;
  }

  // Find moov atom
  const moovAtom = topAtoms.find((a) => a.type === "moov");
  if (!moovAtom) return file; // No moov found, nothing to strip

  // Check if moov is fully within the head chunk
  const moovEnd = moovAtom.offset + moovAtom.size;

  if (moovEnd <= headBytes) {
    // moov is entirely in the head chunk — strip it in memory
    const headerLen = moovAtom.size === 1 ? 16 : 8; // won't be 1 typically but handle it
    // Re-check with actual header
    const moovHeader = readAtomHeader(headView, moovAtom.offset);
    if (!moovHeader) return file;
    const hLen = moovHeader.size === 1 ? 16 : 8;

    const filteredChildren = filterContainerAtom(
      headBuffer, moovAtom.offset + hLen, moovEnd
    );
    const childrenSize = filteredChildren.reduce((sum, c) => sum + c.byteLength, 0);
    const originalChildrenSize = moovAtom.size - hLen;

    if (childrenSize === originalChildrenSize) return file; // No metadata found

    // Rebuild moov
    const newMoovSize = hLen + childrenSize;
    const newMoovHeader = new Uint8Array(hLen);
    const hView = new DataView(newMoovHeader.buffer);
    hView.setUint32(0, newMoovSize);
    newMoovHeader[4] = 0x6D; newMoovHeader[5] = 0x6F; newMoovHeader[6] = 0x6F; newMoovHeader[7] = 0x76;

    // Assemble: [before moov slice] + [new moov parts] + [after moov slice]
    const blobParts: BlobPart[] = [];
    if (moovAtom.offset > 0) {
      blobParts.push(file.slice(0, moovAtom.offset));
    }
    blobParts.push(newMoovHeader);
    filteredChildren.forEach((c) => blobParts.push(new Blob([c])));
    if (moovEnd < file.size) {
      blobParts.push(file.slice(moovEnd));
    }

    const blob = new Blob(blobParts, { type: file.type || "video/mp4" });
    return new File([blob], file.name, { type: file.type || "video/mp4", lastModified: file.lastModified });
  }

  // moov is beyond the head chunk — it's likely at the end of the file
  // Read just the moov atom
  const moovStart = moovAtom.offset;
  // Safety: cap moov read to 50MB to avoid OOM on corrupted files
  if (moovAtom.size > 50 * 1024 * 1024) {
    console.warn("moov atom is larger than 50MB, skipping metadata strip");
    return file;
  }

  const moovBuffer = await file.slice(moovStart, moovStart + moovAtom.size).arrayBuffer();
  const moovView = new DataView(moovBuffer);
  const moovH = readAtomHeader(moovView, 0);
  if (!moovH || moovH.type !== "moov") return file;

  const hLen = moovH.size === 1 ? 16 : 8;
  const filteredChildren = filterContainerAtom(moovBuffer, hLen, moovBuffer.byteLength);
  const childrenSize = filteredChildren.reduce((sum, c) => sum + c.byteLength, 0);
  const originalChildrenSize = moovAtom.size - hLen;

  if (childrenSize === originalChildrenSize) return file; // No metadata found

  // Rebuild moov
  const newMoovSize = hLen + childrenSize;
  const newMoovHeader = new Uint8Array(hLen);
  const nhView = new DataView(newMoovHeader.buffer);
  nhView.setUint32(0, newMoovSize);
  newMoovHeader[4] = 0x6D; newMoovHeader[5] = 0x6F; newMoovHeader[6] = 0x6F; newMoovHeader[7] = 0x76;

  // Assemble: [everything before moov] + [new moov] + [everything after moov]
  const blobParts: BlobPart[] = [];
  if (moovStart > 0) {
    blobParts.push(file.slice(0, moovStart));
  }
  blobParts.push(newMoovHeader);
  filteredChildren.forEach((c) => blobParts.push(new Blob([c])));
  if (moovStart + moovAtom.size < file.size) {
    blobParts.push(file.slice(moovStart + moovAtom.size));
  }

  const blob = new Blob(blobParts, { type: file.type || "video/mp4" });
  return new File([blob], file.name, { type: file.type || "video/mp4", lastModified: file.lastModified });
}
