

## Problem

When uploading in "Wideo + Audio MP3" mode, the dual upload calls `uploadVideoWithSeparateAudio` directly with an empty progress callback `() => {}`, completely bypassing the `UploadQueue` UI component. The user sees no progress indicator — the dialog just closes and nothing visible happens until a toast appears at the end.

## Solution

Route dual uploads through the same `UploadQueue` system used for standard uploads, so the user sees the same progress widget (bottom-right corner with file names, progress bars, status icons).

### Changes

**1. `src/hooks/useUploadQueue.ts`** — Add dual upload support:
- Add a new `addDualFiles` method that creates a single `QueueItem` with extra fields (`audioFile`, `isDual`) to identify it as a dual upload
- In `processNext` effect, detect dual items and call `uploadVideoWithSeparateAudio` instead of `uploadVideo`, passing the progress callback
- Add `audioFile` and `isDual` optional fields to the `QueueItem` interface

**2. `src/hooks/useUploadQueue.ts`** — Accept `uploadVideoWithSeparateAudio` in options:
- Add `uploadVideoWithSeparateAudio` to the `UseUploadQueueOptions` interface
- Use it when processing dual queue items

**3. `src/pages/Dashboard.tsx`** — Wire up dual uploads through queue:
- Pass `uploadVideoWithSeparateAudio` to `useUploadQueue`
- Change `handleDualFilesSelected` to call `addDualFiles` instead of calling `uploadVideoWithSeparateAudio` directly
- Remove the direct `.then()` / `.catch()` toast handling (queue already shows status)

### Technical details

```
QueueItem gets two new optional fields:
  audioFile?: File       — the MP3/audio file
  isDual?: boolean       — flag to route to the correct upload function

useUploadQueue options adds:
  uploadVideoWithSeparateAudio?: (videoFile, audioFile, folderId, onProgress, aspectRatio) => Promise<any>

processNext logic change:
  if (nextItem.isDual && nextItem.audioFile) {
    await uploadVideoWithSeparateAudio(nextItem.file, nextItem.audioFile, ...)
  } else {
    await uploadVideo(nextItem.file, ...)
  }
```

This ensures dual uploads show the same progress widget with file name, size, progress bar, and status transitions (waiting → cleaning → uploading → processing → done/error).

