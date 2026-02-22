import { useState, useCallback, useRef, useEffect } from "react";

export interface QueueItem {
  id: string;
  file: File;
  fileName: string;
  fileSize: number;
  folderId: string | null;
  progress: number;
  status: "waiting" | "cleaning" | "uploading" | "processing" | "done" | "error";
  error?: string;
}

interface UseUploadQueueOptions {
  uploadVideo: (file: File, folderId: string | null, onProgress: (pct: number) => void) => Promise<any>;
}

export function useUploadQueue({ uploadVideo }: UseUploadQueueOptions) {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [minimized, setMinimized] = useState(false);
  const processingRef = useRef(false);

  const addFiles = useCallback((files: File[], folderId: string | null) => {
    const items: QueueItem[] = Array.from(files).slice(0, 20).map((file) => ({
      id: crypto.randomUUID(),
      file,
      fileName: file.name,
      fileSize: file.size,
      folderId,
      progress: 0,
      status: "waiting" as const,
    }));
    setQueue((prev) => [...prev, ...items]);
  }, []);

  const clearQueue = useCallback(() => {
    setQueue([]);
  }, []);

  const isActive = queue.some((item) => item.status === "waiting" || item.status === "cleaning" || item.status === "uploading" || item.status === "processing");
  const hasItems = queue.length > 0;

  const doneCount = queue.filter((i) => i.status === "done").length;
  const totalCount = queue.length;
  const currentItem = queue.find((i) => i.status === "uploading");
  const overallProgress = totalCount === 0 ? 0 : Math.round(
    queue.reduce((sum, i) => {
      if (i.status === "done") return sum + 100;
      if (i.status === "uploading") return sum + i.progress;
      return sum;
    }, 0) / totalCount
  );

  useEffect(() => {
    const processNext = async () => {
      if (processingRef.current) return;

      const nextItem = queue.find((i) => i.status === "waiting");
      if (!nextItem) return;

      processingRef.current = true;

      setQueue((prev) =>
        prev.map((i) => (i.id === nextItem.id ? { ...i, status: "cleaning" as const } : i))
      );

      try {
        // stripVideoMetadata is called inside uploadVideo, status will change to uploading via callback
        await uploadVideo(nextItem.file, nextItem.folderId, (pct) => {
          setQueue((prev) =>
            prev.map((i) => {
              if (i.id !== nextItem.id) return i;
              if (pct >= 95 && i.status !== "processing") {
                return { ...i, progress: pct, status: "processing" as const };
              }
              // First progress call means upload started — switch from cleaning to uploading
              if (i.status === "cleaning") {
                return { ...i, progress: pct, status: "uploading" as const };
              }
              return { ...i, progress: pct };
            })
          );
        });
        setQueue((prev) =>
          prev.map((i) => (i.id === nextItem.id ? { ...i, status: "done" as const, progress: 100 } : i))
        );
      } catch (err: any) {
        setQueue((prev) =>
          prev.map((i) =>
            i.id === nextItem.id
              ? { ...i, status: "error" as const, error: err?.message || "Błąd przesyłania" }
              : i
          )
        );
      }

      processingRef.current = false;
    };

    processNext();
  }, [queue, uploadVideo]);

  return {
    queue,
    minimized,
    setMinimized,
    addFiles,
    clearQueue,
    isActive,
    hasItems,
    doneCount,
    totalCount,
    currentItem,
    overallProgress,
  };
}
