

# Fix: Progress bar not showing for dual (MP4+MP3) uploads

## Root Cause Analysis

After auditing the code, I found two issues:

### Issue 1: Status shows "cleaning" but dual uploads don't need cleaning
In `useUploadQueue.ts` line 99-101, every queue item starts with status `"cleaning"` (metadata stripping phase). But `uploadVideoWithSeparateAudio` doesn't strip metadata — it skips straight to TUS upload. The `updateProgress` function (line 82-84) only transitions from `"cleaning"` → `"uploading"` when `onProgress` fires. If TUS takes a moment to initialize, the user sees a pulsing shield icon with "Usuwanie metadanych..." instead of an upload progress bar.

### Issue 2: If upload errors immediately, queue flashes and disappears
If auth session is expired or bucket doesn't exist, the upload throws instantly. The queue item goes `waiting → cleaning → error` in a single render batch — the widget may not render visibly before the error state.

## Plan

### File: `src/hooks/useUploadQueue.ts`

1. **For dual uploads, skip "cleaning" → go straight to "uploading"**:
   In `processNext`, check `nextItem.isDual` — if true, set initial status to `"uploading"` instead of `"cleaning"`.

2. **After upload completes or errors, keep `processingRef.current = false` and trigger processing of next item**:
   Currently if there are multiple queued items, after one finishes, `processingRef.current` is set to false but the effect only re-runs when `queue` changes. The `setQueue` call for "done"/"error" status does change queue, so this should trigger. But add a safety check.

3. **Add a small delay before processNext starts** to ensure React has committed the queue state and the widget is visible:
   ```
   await new Promise(r => setTimeout(r, 50));
   ```
   This ensures the UploadQueue component has rendered before the upload starts.

### File: `src/components/dashboard/UploadQueue.tsx`

4. **Show meaningful status for dual uploads in "uploading" state from the start** — no changes needed here since the fix is in the queue hook.

These are minimal, targeted fixes. No changes to upload logic, player, embed, or any other functionality.

