import { useState, useCallback, useRef, useEffect } from "react";

export interface UploadProgressInfo {
  bytesUploaded: number;
  bytesTotal: number;
  pct: number;       // 0..100
  speed: number;     // bytes/sec
  eta: number;       // seconds
}

export interface QueueItem {
  id: string;
  file: File;
  fileName: string;
  fileSize: number;
  folderId: string | null;
  aspectRatio: string;
  progress: number;       // 0..100
  bytesUploaded: number;
  speed: number;          // bytes/sec
  eta: number;            // seconds
  status: "waiting" | "uploading" | "processing" | "done" | "error" | "cancelled";
  error?: string;
  audioFile?: File;
  isDual?: boolean;
  abort?: AbortController;
}

interface UseUploadQueueOptions {
  uploadVideo: (
    file: File,
    folderId: string | null,
    onProgress: (info: UploadProgressInfo) => void,
    aspectRatio?: string,
    signal?: AbortSignal
  ) => Promise<any>;
  uploadVideoWithSeparateAudio?: (
    videoFile: File,
    audioFile: File,
    folderId: string | null,
    onProgress: (info: UploadProgressInfo) => void,
    aspectRatio?: string,
    signal?: AbortSignal
  ) => Promise<any>;
}

export function useUploadQueue({ uploadVideo, uploadVideoWithSeparateAudio }: UseUploadQueueOptions) {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [minimized, setMinimized] = useState(false);
  const processingRef = useRef(false);

  const addFiles = useCallback((files: File[], folderId: string | null, aspectRatio: string = "16:9") => {
    const items: QueueItem[] = Array.from(files).slice(0, 20).map((file) => ({
      id: crypto.randomUUID(),
      file,
      fileName: file.name,
      fileSize: file.size,
      folderId,
      aspectRatio,
      progress: 0,
      bytesUploaded: 0,
      speed: 0,
      eta: Infinity,
      status: "waiting" as const,
    }));
    setQueue((prev) => [...prev, ...items]);
  }, []);

  const addDualFiles = useCallback((videoFile: File, audioFile: File, folderId: string | null, aspectRatio: string = "16:9") => {
    const item: QueueItem = {
      id: crypto.randomUUID(),
      file: videoFile,
      fileName: `${videoFile.name} + ${audioFile.name}`,
      fileSize: videoFile.size + audioFile.size,
      folderId,
      aspectRatio,
      progress: 0,
      bytesUploaded: 0,
      speed: 0,
      eta: Infinity,
      status: "waiting" as const,
      audioFile,
      isDual: true,
    };
    setQueue((prev) => [...prev, item]);
  }, []);

  const clearQueue = useCallback(() => {
    setQueue([]);
  }, []);

  const cancelItem = useCallback((id: string) => {
    setQueue((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i;
        try { i.abort?.abort(); } catch {}
        if (i.status === "waiting") {
          return { ...i, status: "cancelled" as const };
        }
        return i;
      })
    );
  }, []);

  const isActive = queue.some((i) => i.status === "waiting" || i.status === "uploading" || i.status === "processing");
  const hasItems = queue.length > 0;

  const doneCount = queue.filter((i) => i.status === "done").length;
  const totalCount = queue.length;
  const currentItem = queue.find((i) => i.status === "uploading");
  const overallProgress = totalCount === 0 ? 0 : Math.round(
    queue.reduce((sum, i) => {
      if (i.status === "done") return sum + 100;
      if (i.status === "uploading" || i.status === "processing") return sum + i.progress;
      return sum;
    }, 0) / totalCount
  );

  // Batch progress updates via requestAnimationFrame so high-frequency TUS
  // callbacks never trigger more than one React render per frame.
  const pendingProgressRef = useRef<Map<string, UploadProgressInfo>>(new Map());
  const rafRef = useRef<number | null>(null);

  const flushProgress = useCallback(() => {
    rafRef.current = null;
    const pending = pendingProgressRef.current;
    if (pending.size === 0) return;
    const updates = new Map(pending);
    pending.clear();

    setQueue((prev) => {
      let changed = false;
      const next = prev.map((i) => {
        const info = updates.get(i.id);
        if (!info) return i;
        const nextProgress = Math.max(i.progress, info.pct);
        const nextBytes = Math.max(i.bytesUploaded, info.bytesUploaded);
        let status: QueueItem["status"] = i.status;
        if (i.status !== "processing" && i.status !== "done") {
          status = nextProgress >= 99.9 ? "processing" : "uploading";
        }
        const nextSpeed = info.speed > 0 ? info.speed : i.speed;
        const nextEta = Number.isFinite(info.eta) ? Math.max(0, info.eta) : i.eta;

        // Skip if nothing visible changed (compare rounded % shown in UI).
        if (
          status === i.status &&
          Math.round(nextProgress) === Math.round(i.progress) &&
          nextBytes - i.bytesUploaded < 256 * 1024
        ) {
          return i;
        }
        changed = true;
        return {
          ...i,
          progress: nextProgress,
          bytesUploaded: nextBytes,
          speed: nextSpeed,
          eta: nextEta,
          status,
        };
      });
      return changed ? next : prev;
    });
  }, []);

  const updateProgress = useCallback((itemId: string, info: UploadProgressInfo) => {
    pendingProgressRef.current.set(itemId, info);
    if (rafRef.current == null) {
      rafRef.current = requestAnimationFrame(flushProgress);
    }
  }, [flushProgress]);

  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  useEffect(() => {
    const processNext = async () => {
      if (processingRef.current) return;

      const nextItem = queue.find((i) => i.status === "waiting");
      if (!nextItem) return;

      processingRef.current = true;

      const abort = new AbortController();
      setQueue((prev) =>
        prev.map((i) => (i.id === nextItem.id ? { ...i, status: "uploading", abort } : i))
      );

      // Small delay to ensure widget renders
      await new Promise((r) => setTimeout(r, 30));

      try {
        if (nextItem.isDual && nextItem.audioFile && uploadVideoWithSeparateAudio) {
          await uploadVideoWithSeparateAudio(
            nextItem.file,
            nextItem.audioFile,
            nextItem.folderId,
            (info) => updateProgress(nextItem.id, info),
            nextItem.aspectRatio,
            abort.signal
          );
        } else {
          await uploadVideo(
            nextItem.file,
            nextItem.folderId,
            (info) => updateProgress(nextItem.id, info),
            nextItem.aspectRatio,
            abort.signal
          );
        }
        setQueue((prev) =>
          prev.map((i) => (i.id === nextItem.id ? { ...i, status: "done" as const, progress: 100 } : i))
        );
      } catch (err: any) {
        const isAbort = err?.name === "AbortError";
        setQueue((prev) =>
          prev.map((i) =>
            i.id === nextItem.id
              ? {
                  ...i,
                  status: isAbort ? ("cancelled" as const) : ("error" as const),
                  error: isAbort ? "Anulowano" : (err?.message || "Błąd przesyłania"),
                }
              : i
          )
        );
      }

      processingRef.current = false;
    };

    processNext();
  }, [queue, uploadVideo, uploadVideoWithSeparateAudio, updateProgress]);

  return {
    queue,
    minimized,
    setMinimized,
    addFiles,
    addDualFiles,
    clearQueue,
    cancelItem,
    isActive,
    hasItems,
    doneCount,
    totalCount,
    currentItem,
    overallProgress,
  };
}
