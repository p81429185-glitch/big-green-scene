/**
 * Web Worker for FastStart (moov atom relocation) processing.
 *
 * Messages IN:
 *   { type: 'PROCESS', buffer: ArrayBuffer, videoId: string }
 *
 * Messages OUT:
 *   { type: 'DONE', buffer: ArrayBuffer, videoId: string }
 *   { type: 'ERROR', error: string, videoId: string }
 *
 * ArrayBuffers are transferred (not copied) for memory efficiency.
 */

import { isFaststart, relocateMoovToStart } from "@/lib/moovAtomUtils";

export interface FaststartRequest {
  type: "PROCESS";
  buffer: ArrayBuffer;
  videoId: string;
}

export interface FaststartDone {
  type: "DONE";
  buffer: ArrayBuffer;
  videoId: string;
}

export interface FaststartError {
  type: "ERROR";
  error: string;
  videoId: string;
}

export type FaststartResponse = FaststartDone | FaststartError;

self.onmessage = (e: MessageEvent<FaststartRequest>) => {
  const { type, buffer, videoId } = e.data;

  if (type !== "PROCESS") return;

  try {
    // If already faststart, return the buffer unchanged
    if (isFaststart(buffer)) {
      (self as unknown as Worker).postMessage(
        { type: "DONE", buffer, videoId } satisfies FaststartDone,
        [buffer], // transfer
      );
      return;
    }

    const processed = relocateMoovToStart(buffer);

    (self as unknown as Worker).postMessage(
      { type: "DONE", buffer: processed, videoId } satisfies FaststartDone,
      [processed], // transfer
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    (self as unknown as Worker).postMessage(
      { type: "ERROR", error: message, videoId } satisfies FaststartError,
    );
  }
};
