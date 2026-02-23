/**
 * Strip metadata (GPS, device info, etc.) from MP4/MOV files client-side.
 * Works by parsing the MP4 atom/box structure and removing `udta` and `meta` atoms
 * from inside the `moov` atom. Video/audio data remains untouched.
 */

const STRIP_TYPES = new Set(["udta", "meta"]);
const MP4_SIGNATURES = new Set(["ftyp"]);

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

function getAtomSize(view: DataView, offset: number, header: { size: number; type: string }): number {
  if (header.size === 1) {
    // 64-bit extended size
    if (offset + 16 > view.byteLength) return view.byteLength - offset;
    const hi = view.getUint32(offset + 8);
    const lo = view.getUint32(offset + 12);
    return hi * 0x100000000 + lo;
  }
  if (header.size === 0) {
    // Atom extends to end of file
    return view.byteLength - offset;
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

    const atomSize = getAtomSize(view, offset, header);
    if (atomSize < 8 || offset + atomSize > end) break;

    if (STRIP_TYPES.has(header.type)) {
      // Skip this atom entirely
      offset += atomSize;
      continue;
    }

    // For trak, mdia, minf, stbl — recurse into them to strip nested udta/meta
    const CONTAINER_TYPES = new Set(["trak", "mdia", "minf", "stbl", "edts"]);
    if (CONTAINER_TYPES.has(header.type)) {
      const headerLen = header.size === 1 ? 16 : 8;
      const childStart = offset + headerLen;
      const childEnd = offset + atomSize;
      const filteredChildren = filterContainerAtom(buffer, childStart, childEnd);
      
      // Rebuild this container with filtered children
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
      // Keep atom as-is
      kept.push(new Uint8Array(buffer, offset, atomSize));
    }

    offset += atomSize;
  }

  return kept;
}

export async function stripVideoMetadata(file: File): Promise<File> {
  // Skip stripping for large files to avoid browser OOM crash
  if (file.size > 500 * 1024 * 1024) return file;

  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  
  // Only process MP4/MOV files
  const isMP4 = type === "video/mp4" || type === "video/quicktime" ||
    name.endsWith(".mp4") || name.endsWith(".mov") || name.endsWith(".m4v");
  
  if (!isMP4) return file;

  try {
    const buffer = await file.arrayBuffer();
    const view = new DataView(buffer);

    // Verify it's an MP4 — first atom should be ftyp
    const firstHeader = readAtomHeader(view, 0);
    if (!firstHeader || !MP4_SIGNATURES.has(firstHeader.type)) {
      return file; // Not a valid MP4
    }

    // Parse top-level atoms
    const parts: Uint8Array[] = [];
    let offset = 0;
    let modified = false;

    while (offset < buffer.byteLength) {
      const header = readAtomHeader(view, offset);
      if (!header) break;

      const atomSize = getAtomSize(view, offset, header);
      if (atomSize < 8) break;

      if (header.type === "moov") {
        // Process moov — filter its children
        const headerLen = header.size === 1 ? 16 : 8;
        const childStart = offset + headerLen;
        const childEnd = offset + atomSize;
        const filteredChildren = filterContainerAtom(buffer, childStart, childEnd);
        
        const childrenSize = filteredChildren.reduce((sum, c) => sum + c.byteLength, 0);
        const originalChildrenSize = atomSize - headerLen;
        
        if (childrenSize !== originalChildrenSize) {
          modified = true;
          // Rebuild moov with filtered children
          const newSize = headerLen + childrenSize;
          const newHeader = new Uint8Array(headerLen);
          const hView = new DataView(newHeader.buffer);
          hView.setUint32(0, newSize);
          newHeader[4] = 0x6D; // m
          newHeader[5] = 0x6F; // o
          newHeader[6] = 0x6F; // o
          newHeader[7] = 0x76; // v
          
          parts.push(newHeader);
          filteredChildren.forEach((c) => parts.push(c));
        } else {
          parts.push(new Uint8Array(buffer, offset, atomSize));
        }
      } else {
        parts.push(new Uint8Array(buffer, offset, atomSize));
      }

      offset += atomSize;
      if (offset <= 0) break; // Safety
    }

    if (!modified) return file;

    const blob = new Blob(parts as BlobPart[], { type: file.type || "video/mp4" });
    return new File([blob], file.name, { type: file.type || "video/mp4", lastModified: file.lastModified });
  } catch {
    // If anything fails, return original file
    return file;
  }
}
