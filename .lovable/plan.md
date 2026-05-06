## Problem

The upload progress bar visibly jumps backward and glitches during large uploads (visible in the screenshot at 9% / 3.9 MB of 43.5 MB). The percentage drops, ETA flickers, and the bar appears to "rewind."

## Root cause

In `src/hooks/useVideoStore.ts`, the TUS upload runs with `parallelUploads: 6`. The `tus-js-client` `onProgress` callback sums `bytesUploaded` across all 6 in-flight chunks. When a chunk fails and retries (very common on flaky networks or when the server rejects a chunk), its already-counted bytes are subtracted, so `bytesUploaded` legitimately decreases. The same happens briefly when chunks reorder.

Currently in `useUploadQueue.ts → updateProgress` and `useVideoStore.ts → onProgress`, every reported value is forwarded to the UI verbatim. Result:
- progress bar moves backward
- speed sample becomes negative → EMA goes haywire → ETA flickers between huge values and `Infinity`
- status briefly bounces between `uploading` and `processing` near the end (the `pct >= 99.9 → processing` rule re-fires)

## Fix (surgical, UI-layer only)

1. **Monotonic progress in TUS `onProgress`** (`useVideoStore.ts`)
   - Track `maxBytesUploaded` per upload. Clamp the reported `bytesUploaded` to never decrease.
   - Skip negative speed samples (when `inst < 0`, don't update EMA).
   - Compute `pct` from the clamped value.

2. **Defensive clamp in queue** (`useUploadQueue.ts → updateProgress`)
   - Never let `progress` decrease for the same item.
   - Never let `bytesUploaded` decrease.
   - Don't flip back from `processing` to `uploading` — once an item enters `processing`, it stays there until `done`/`error`.

3. **Smoother ETA**
   - Floor `eta` display at 0 and ignore samples where smoothedSpeed <= 0.
   - Keep the existing EMA, just guard inputs.

No changes to upload protocol, chunk size, parallelism, DB lifecycle, or visual design. Pure progress-reporting hardening.

## Files to edit

- `src/hooks/useVideoStore.ts` — clamp `bytesUploaded`, ignore negative speed samples in the TUS `onProgress` block.
- `src/hooks/useUploadQueue.ts` — clamp `progress`/`bytesUploaded` and lock status transitions in `updateProgress`.

## Verification

- Upload a 1 GB file on a throttled connection (DevTools → Network → Slow 4G).
- Watch the queue widget: progress should only ever increase or hold; speed/ETA should not flicker to negative or `Infinity` mid-upload.
- Confirm final transition is `uploading → processing → done` with no bounce.
