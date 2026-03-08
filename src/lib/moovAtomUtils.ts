/**
 * Browser-compatible MP4 moov atom utilities for FastStart optimization.
 * Relocates the moov atom to the beginning of an MP4 file so that
 * playback can start before the entire file is downloaded.
 */

// ── Binary helpers ──────────────────────────────────────────────────

function readUint32BE(data: Uint8Array, offset: number): number {
  return (
    (data[offset] << 24) |
    (data[offset + 1] << 16) |
    (data[offset + 2] << 8) |
    data[offset + 3]
  ) >>> 0;
}

function writeUint32BE(data: Uint8Array, offset: number, value: number): void {
  data[offset] = (value >>> 24) & 0xff;
  data[offset + 1] = (value >>> 16) & 0xff;
  data[offset + 2] = (value >>> 8) & 0xff;
  data[offset + 3] = value & 0xff;
}

function readUint64BE(data: Uint8Array, offset: number): bigint {
  const high = BigInt(readUint32BE(data, offset));
  const low = BigInt(readUint32BE(data, offset + 4));
  return (high << 32n) | low;
}

function getAtomType(data: Uint8Array, offset: number): string {
  return String.fromCharCode(
    data[offset],
    data[offset + 1],
    data[offset + 2],
    data[offset + 3],
  );
}

// ── Internal types ──────────────────────────────────────────────────

interface MoovInfo {
  found: boolean;
  isAtStart: boolean;
  moovStart: number;
  moovSize: number;
  mdatStart: number;
  mdatSize: number;
  ftypEnd: number;
}

// ── Atom scanning ───────────────────────────────────────────────────

function scanAtoms(data: Uint8Array): MoovInfo {
  const result: MoovInfo = {
    found: false,
    isAtStart: false,
    moovStart: 0,
    moovSize: 0,
    mdatStart: 0,
    mdatSize: 0,
    ftypEnd: 0,
  };

  let offset = 0;
  let moovBeforeMdat = false;

  while (offset < data.length - 8) {
    let atomSize = readUint32BE(data, offset);
    const atomType = getAtomType(data, offset + 4);

    if (atomSize === 1 && offset + 16 <= data.length) {
      atomSize = Number(readUint64BE(data, offset + 8));
    }
    if (atomSize === 0) {
      atomSize = data.length - offset;
    }
    if (atomSize < 8) break;

    if (atomType === "ftyp") {
      result.ftypEnd = offset + atomSize;
    } else if (atomType === "moov") {
      result.found = true;
      result.moovStart = offset;
      result.moovSize = atomSize;
      if (result.mdatStart === 0) {
        moovBeforeMdat = true;
      }
    } else if (atomType === "mdat") {
      result.mdatStart = offset;
      result.mdatSize = atomSize;
    }

    offset += atomSize;
  }

  result.isAtStart = moovBeforeMdat;
  return result;
}

// ── Chunk offset adjustment ─────────────────────────────────────────

function adjustStcoAtoms(data: Uint8Array, adjustment: number): void {
  let offset = 0;

  while (offset < data.length - 8) {
    const atomType = getAtomType(data, offset + 4);
    let atomSize = readUint32BE(data, offset);

    if (atomSize === 1 && offset + 16 <= data.length) {
      atomSize = Number(readUint64BE(data, offset + 8));
    }
    if (atomSize === 0) atomSize = data.length - offset;
    if (atomSize < 8) break;

    if (atomType === "stco") {
      const entryCount = readUint32BE(data, offset + 12);
      for (let i = 0; i < entryCount; i++) {
        const entryOffset = offset + 16 + i * 4;
        if (entryOffset + 4 <= data.length) {
          const currentOffset = readUint32BE(data, entryOffset);
          writeUint32BE(data, entryOffset, currentOffset + adjustment);
        }
      }
    }

    if (["moov", "trak", "mdia", "minf", "stbl"].includes(atomType)) {
      offset += 8;
    } else {
      offset += atomSize;
    }
  }
}

function adjustCo64Atoms(data: Uint8Array, adjustment: bigint): void {
  let offset = 0;

  while (offset < data.length - 8) {
    const atomType = getAtomType(data, offset + 4);
    let atomSize = readUint32BE(data, offset);

    if (atomSize === 1 && offset + 16 <= data.length) {
      atomSize = Number(readUint64BE(data, offset + 8));
    }
    if (atomSize === 0) atomSize = data.length - offset;
    if (atomSize < 8) break;

    if (atomType === "co64") {
      const entryCount = readUint32BE(data, offset + 12);
      for (let i = 0; i < entryCount; i++) {
        const entryOffset = offset + 16 + i * 8;
        if (entryOffset + 8 <= data.length) {
          const currentOffset = readUint64BE(data, entryOffset);
          const newOffset = currentOffset + adjustment;
          writeUint32BE(data, entryOffset, Number(newOffset >> 32n));
          writeUint32BE(data, entryOffset + 4, Number(newOffset & 0xffffffffn));
        }
      }
    }

    if (["moov", "trak", "mdia", "minf", "stbl"].includes(atomType)) {
      offset += 8;
    } else {
      offset += atomSize;
    }
  }
}

function adjustChunkOffsets(moov: Uint8Array, adjustment: number): Uint8Array {
  const result = new Uint8Array(moov);
  adjustStcoAtoms(result, adjustment);
  adjustCo64Atoms(result, BigInt(adjustment));
  return result;
}

// ── Public API ──────────────────────────────────────────────────────

/**
 * Locate the moov atom in a full MP4 buffer.
 * Returns offset & size if found, or null.
 */
export function findMoovAtom(
  buffer: ArrayBuffer,
): { offset: number; size: number } | null {
  const data = new Uint8Array(buffer);
  const info = scanAtoms(data);
  if (!info.found) return null;
  return { offset: info.moovStart, size: info.moovSize };
}

/**
 * Returns true if the moov atom is already near the start of the file
 * (before mdat), meaning the file is already FastStart-optimized.
 */
export function isFaststart(buffer: ArrayBuffer): boolean {
  const data = new Uint8Array(buffer);
  const info = scanAtoms(data);
  return !info.found || info.isAtStart;
}

/**
 * Quick check using only the first and last 64 KB of the file.
 * Returns true if moov appears to be at the start (or is not found
 * in the sampled regions, which we treat as "probably OK").
 *
 * This avoids loading the full file into memory just for detection.
 * Pass the result of reading the first 64 KB concatenated with
 * the last 64 KB, together with the total file size.
 *
 * For simplicity this overload also accepts a full buffer — it will
 * just scan the whole thing.
 */
export function quickCheck(buffer: ArrayBuffer): boolean {
  const data = new Uint8Array(buffer);

  // Scan top-level atoms in the provided buffer.  If the buffer is
  // only a partial view (first+last 64 KB) we can still detect
  // whether moov comes before mdat in the top-level atom order.
  let offset = 0;
  let foundMoov = false;
  let foundMdat = false;

  while (offset < data.length - 8) {
    let atomSize = readUint32BE(data, offset);
    const atomType = getAtomType(data, offset + 4);

    if (atomSize === 1 && offset + 16 <= data.length) {
      atomSize = Number(readUint64BE(data, offset + 8));
    }
    if (atomSize === 0) atomSize = data.length - offset;
    if (atomSize < 8) break;

    if (atomType === "moov") {
      foundMoov = true;
      if (!foundMdat) return true; // moov before mdat → already faststart
    }
    if (atomType === "mdat") {
      foundMdat = true;
      if (!foundMoov) return false; // mdat before moov → needs processing
    }

    offset += atomSize;
  }

  // If we didn't find both atoms in the sample, assume OK
  return true;
}

/**
 * Relocate the moov atom to the beginning of the file (after ftyp).
 * Returns a new ArrayBuffer with the optimized layout.
 * Throws on failure.
 */
export function relocateMoovToStart(buffer: ArrayBuffer): ArrayBuffer {
  const data = new Uint8Array(buffer);
  const info = scanAtoms(data);

  if (!info.found) {
    throw new Error("No moov atom found — file may not be a valid MP4");
  }

  if (info.isAtStart) {
    // Already optimized — return a copy so the caller can transfer it
    return buffer.slice(0);
  }

  const moov = data.slice(info.moovStart, info.moovStart + info.moovSize);
  const offsetAdjustment = info.moovSize;
  const adjustedMoov = adjustChunkOffsets(moov, offsetAdjustment);

  const ftyp = data.slice(0, info.ftypEnd);
  const beforeMoov = data.slice(info.ftypEnd, info.moovStart);
  const afterMoov = data.slice(info.moovStart + info.moovSize);

  const result = new Uint8Array(data.length);
  let writeOffset = 0;

  result.set(ftyp, writeOffset);
  writeOffset += ftyp.length;

  result.set(adjustedMoov, writeOffset);
  writeOffset += adjustedMoov.length;

  result.set(beforeMoov, writeOffset);
  writeOffset += beforeMoov.length;

  result.set(afterMoov, writeOffset);

  return result.buffer;
}
