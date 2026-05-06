import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import * as tus from "tus-js-client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  MAX_FILE_SIZE,
  TUS_CHUNK_SIZE,
  TUS_THRESHOLD,
  UPLOAD_PIPELINE_VERSION,
  isAllowedVideo,
  formatBytes,
  clearStaleTusFingerprints,
  CHUNK_SIZE_SMALL,
  CHUNK_SIZE_MEDIUM,
  CHUNK_SIZE_LARGE,
  SPEED_THRESHOLD_LOW,
  SPEED_THRESHOLD_HIGH,
  CHUNKS_BEFORE_ADAPT,
  SPEED_DROP_THRESHOLD,
} from "@/lib/uploadConstants";

export interface VideoItem {
  id: string;
  title: string;
  file_name: string;
  size: number;
  created_at: string;
  folder_id: string | null;
  plays: number;
  storage_path: string;
  thumbnail_url: string | null;
  is_favorite: boolean;
  is_processed: boolean;
  processing_status: string;
  audio_track_path: string | null;
  aspect_ratio: string | null;
}

export interface FolderItem {
  id: string;
  name: string;
  created_at: string;
  parent_id: string | null;
}

function sanitizeFileName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9_\-.]/g, '_')
    .replace(/_+/g, '_')
    .substring(0, 100);
}

export function useVideoStore() {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const channelsRef = useRef<Map<string, RealtimeChannel>>(new Map());

  // Adaptive chunk sizing state (persists between uploads)
  const adaptiveChunkSizeRef = useRef(TUS_CHUNK_SIZE);
  const speedHistoryRef = useRef<number[]>([]);

  const fetchVideos = useCallback(async () => {
    const { data } = await supabase
      .from("videos")
      .select("id,title,file_name,size,folder_id,plays,storage_path,thumbnail_url,created_at,is_favorite,is_processed,processing_status,audio_track_path,aspect_ratio")
      .order("created_at", { ascending: false });
    if (data) setVideos(data as VideoItem[]);
  }, []);

  const fetchFolders = useCallback(async () => {
    const { data } = await supabase
      .from("folders")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setFolders(data as FolderItem[]);
  }, []);

  useEffect(() => {
    // One-time per browser/version cleanup of stale TUS fingerprints
    // from previous (corrupted-byte-stripping) pipeline.
    clearStaleTusFingerprints();
    Promise.all([fetchVideos(), fetchFolders()]).finally(() => setLoading(false));

    // Cleanup realtime subscriptions on unmount
    return () => {
      channelsRef.current.forEach((channel) => {
        supabase.removeChannel(channel);
      });
      channelsRef.current.clear();
    };
  }, [fetchVideos, fetchFolders]);

  // Subscribe to processing status changes for a specific video
  const subscribeToProcessingStatus = useCallback((videoId: string) => {
    // Don't create duplicate subscriptions
    if (channelsRef.current.has(videoId)) return;

    const channel = supabase
      .channel(`video-processing-${videoId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'videos',
          filter: `id=eq.${videoId}`,
        },
        (payload) => {
          const newData = payload.new as VideoItem;
          console.log(`Video ${videoId} status updated:`, newData.processing_status);
          
          // Update local state with new processing status
          setVideos((prev) => prev.map((v) => 
            v.id === videoId 
              ? { ...v, is_processed: newData.is_processed, processing_status: newData.processing_status }
              : v
          ));

          // If processing is complete, unsubscribe
          if (newData.processing_status === "ready" || newData.processing_status === "failed") {
            const ch = channelsRef.current.get(videoId);
            if (ch) {
              supabase.removeChannel(ch);
              channelsRef.current.delete(videoId);
            }
          }
        }
      )
      .subscribe();

    channelsRef.current.set(videoId, channel);
  }, []);

  const getPublicUrl = (bucket: string, path: string) => {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  };

  const generateThumbnail = async (file: File, videoId: string): Promise<string | null> => {
    try {
      const objectUrl = URL.createObjectURL(file);
      
      return new Promise((resolve) => {
        const video = document.createElement("video");
        video.muted = true;
        video.preload = "metadata";
        video.crossOrigin = "anonymous";
        video.src = objectUrl;

        let resolved = false;
        let metadataLoaded = false;
        let captureAttempted = false;

        const cleanup = () => {
          try { URL.revokeObjectURL(objectUrl); } catch {}
        };

        const safeResolve = (value: string | null) => {
          if (resolved) return;
          resolved = true;
          cleanup();
          resolve(value);
        };

        const captureFrame = async () => {
          if (captureAttempted || resolved) return;
          captureAttempted = true;

          try {
            const canvas = document.createElement("canvas");
            canvas.width = 320;
            canvas.height = 180;
            const ctx = canvas.getContext("2d");
            if (!ctx) { safeResolve(null); return; }
            
            ctx.drawImage(video, 0, 0, 320, 180);
            
            canvas.toBlob(async (blob) => {
              if (!blob || resolved) { safeResolve(null); return; }
              try {
                const thumbPath = `${videoId}.jpg`;
                const { error } = await supabase.storage
                  .from("thumbnails")
                  .upload(thumbPath, blob, { contentType: "image/jpeg", upsert: true });
                if (error) { safeResolve(null); return; }
                const url = getPublicUrl("thumbnails", thumbPath);
                await supabase.from("videos").update({ thumbnail_url: url }).eq("id", videoId);
                safeResolve(url);
              } catch {
                safeResolve(null);
              }
            }, "image/jpeg", 0.7);
          } catch {
            safeResolve(null);
          }
        };

        const attemptSeek = () => {
          if (resolved) return;
          metadataLoaded = true;
          
          const seekTime = video.duration && isFinite(video.duration) 
            ? Math.min(1, video.duration / 2) 
            : 0;
          
          if (seekTime === 0 || video.currentTime === seekTime) {
            // No seek needed or already at position
            captureFrame();
          } else {
            video.currentTime = seekTime;
          }
        };

        // Listen for both loadeddata and canplay - use whichever fires first
        const onMetadataReady = () => {
          if (!metadataLoaded) {
            attemptSeek();
          }
        };

        video.addEventListener("loadeddata", onMetadataReady);
        video.addEventListener("canplay", onMetadataReady);
        video.addEventListener("loadedmetadata", onMetadataReady);

        // Listen for both seeked and timeupdate as fallback for capture
        const onSeekComplete = () => {
          if (!captureAttempted) {
            captureFrame();
          }
        };

        video.addEventListener("seeked", onSeekComplete);
        video.addEventListener("timeupdate", () => {
          // Only capture on timeupdate if we've seeked and not yet captured
          if (metadataLoaded && !captureAttempted && video.currentTime > 0) {
            onSeekComplete();
          }
        });

        video.addEventListener("error", () => safeResolve(null));

        // Fallback: if duration unavailable after 5s, capture at currentTime=0
        setTimeout(() => {
          if (!metadataLoaded && !resolved) {
            console.log("Thumbnail: metadata timeout, attempting capture at t=0");
            captureFrame();
          }
        }, 5000);

        // Final timeout: dynamic based on file size
        const getTimeoutMs = (f: File): number => {
          const mb = f.size / (1024 * 1024);
          if (mb < 100) return 30000;
          if (mb < 500) return 60000;
          return 120000;
        };
        setTimeout(() => {
          if (!resolved) {
            console.log("Thumbnail: final timeout reached");
            safeResolve(null);
          }
        }, getTimeoutMs(file));
      });
    } catch {
      return null;
    }
  };

  /**
   * Resumable upload via Supabase TUS endpoint.
   *
   * - 6 MB chunks (Supabase requires multiple of 6 MB)
   * - parallelUploads = 3 (cap concurrency)
   * - retry per chunk: exponential backoff up to 5 retries
   * - resumes on page reload via tus-js-client URL storage in localStorage
   * - cancellable via AbortSignal
   * - rich progress: bytes sent, speed, ETA
   */
  const uploadFileTus = async (
    file: File,
    storagePath: string,
    options: {
      onProgress?: (info: { bytesUploaded: number; bytesTotal: number; pct: number; speed: number; eta: number }) => void;
      bucket?: string;
      signal?: AbortSignal;
    } = {}
  ): Promise<void> => {
    const { onProgress, bucket = "videos", signal } = options;
    const url = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      throw new Error("Sesja wygasła – zaloguj się ponownie, aby przesłać plik.");
    }

    const startTs = Date.now();
    let lastSampleTs = startTs;
    let lastSampleBytes = 0;
    let smoothedSpeed = 0;
    let maxBytesUploaded = 0;

    // Adaptive chunk sizing: measure speed, adjust for next upload
    let chunksSent = 0;
    const currentChunkSize = adaptiveChunkSizeRef.current;

    return new Promise((resolve, reject) => {
      const upload = new tus.Upload(file, {
        endpoint: `${url}/storage/v1/upload/resumable`,
        // Exponential backoff: 5 retries (0, 2s, 5s, 10s, 20s)
        retryDelays: [0, 2000, 5000, 10000, 20000],
        chunkSize: currentChunkSize,
        // 6 parallel chunks = 36MB in-flight (6MB × 6). Optimized for >50 Mbps uplink.
        // TUS spec allows arbitrary concurrency: https://tus.io/protocols/resumable-upload#upload-concatenation
        parallelUploads: 6,
        headers: {
          apikey: anonKey,
        },
        uploadDataDuringCreation: true,
        removeFingerprintOnSuccess: true,
        // Fingerprint scoped to bucket+path+pipeline-version. Different pipeline
        // versions never resume each other (avoids byte-mismatch corruption).
        fingerprint: async (f) =>
          [UPLOAD_PIPELINE_VERSION, bucket, storagePath, f.size, f.lastModified].join("|"),
        metadata: {
          bucketName: bucket,
          objectName: storagePath,
          contentType: file.type || "application/octet-stream",
          cacheControl: "3600",
        },
        onBeforeRequest: async (req) => {
          const { data: { session: s } } = await supabase.auth.getSession();
          const freshToken = s?.access_token ?? token;
          req.setHeader("authorization", `Bearer ${freshToken}`);
        },
        onShouldRetry: (err: any, retryAttempt: number) => {
          // Cap at 5 retries per chunk; fail fast on auth errors
          const status = err?.originalResponse?.getStatus?.();
          if (status === 401 || status === 403) return false;
          return retryAttempt < 5;
        },
        onError: (error: any) => {
          console.error("[upload] TUS error", {
            fileName: file.name,
            fileSize: file.size,
            storagePath,
            error: error?.message,
            cause: error?.originalResponse?.getStatus?.(),
          });
          reject(new Error(`Upload failed: ${error.message}`));
        },
        onProgress: (bytesUploaded, bytesTotal) => {
          // Monotonic clamp: tus parallelUploads can briefly report a lower
          // bytesUploaded when a chunk retries. Never let UI go backward.
          if (bytesUploaded > maxBytesUploaded) maxBytesUploaded = bytesUploaded;
          const reportedBytes = maxBytesUploaded;

          const now = Date.now();
          const dt = (now - lastSampleTs) / 1000;
          if (dt >= 0.5) {
            const inst = (reportedBytes - lastSampleBytes) / dt;
            // Ignore negative/zero samples (chunk retry artifacts)
            if (inst > 0) {
              smoothedSpeed = smoothedSpeed === 0 ? inst : smoothedSpeed * 0.7 + inst * 0.3;
            }
            lastSampleTs = now;
            lastSampleBytes = reportedBytes;

            // Track speed for adaptive chunk sizing
            chunksSent++;
            if (chunksSent <= CHUNKS_BEFORE_ADAPT) {
              speedHistoryRef.current.push(smoothedSpeed);
            }

            // After measuring initial chunks, select optimal chunk size for NEXT upload
            if (chunksSent === CHUNKS_BEFORE_ADAPT && speedHistoryRef.current.length >= CHUNKS_BEFORE_ADAPT) {
              const avgSpeed = speedHistoryRef.current.reduce((a, b) => a + b, 0) / speedHistoryRef.current.length;
              const newChunkSize = avgSpeed < SPEED_THRESHOLD_LOW
                ? CHUNK_SIZE_SMALL
                : avgSpeed < SPEED_THRESHOLD_HIGH
                  ? CHUNK_SIZE_MEDIUM
                  : CHUNK_SIZE_LARGE;

              adaptiveChunkSizeRef.current = newChunkSize;
              console.info(`[adaptive-chunk] Measured speed: ${(avgSpeed / (1024 * 1024)).toFixed(2)} MB/s, selected chunk size: ${formatBytes(newChunkSize)} for next upload`);
            }

            // Detect speed drops (downgrade chunk size for next upload)
            if (chunksSent > CHUNKS_BEFORE_ADAPT && speedHistoryRef.current.length >= 3) {
              const recent = smoothedSpeed;
              const baseline = (speedHistoryRef.current[0] + speedHistoryRef.current[1]) / 2;
              if (recent < baseline * SPEED_DROP_THRESHOLD && adaptiveChunkSizeRef.current > CHUNK_SIZE_SMALL) {
                const oldSize = adaptiveChunkSizeRef.current;
                adaptiveChunkSizeRef.current = adaptiveChunkSizeRef.current === CHUNK_SIZE_LARGE
                  ? CHUNK_SIZE_MEDIUM
                  : CHUNK_SIZE_SMALL;
                console.warn(`[adaptive-chunk] Speed drop detected (${(recent / (1024 * 1024)).toFixed(2)} MB/s vs ${(baseline / (1024 * 1024)).toFixed(2)} MB/s baseline), downgrading: ${formatBytes(oldSize)} → ${formatBytes(adaptiveChunkSizeRef.current)} for next upload`);
                speedHistoryRef.current = []; // Reset history after downgrade
              }
            }
          }
          const pct = bytesTotal > 0 ? Math.min(100, (reportedBytes / bytesTotal) * 100) : 0;
          const remaining = Math.max(0, bytesTotal - reportedBytes);
          const eta = smoothedSpeed > 0 ? Math.max(0, remaining / smoothedSpeed) : Infinity;
          onProgress?.({ bytesUploaded: reportedBytes, bytesTotal, pct, speed: smoothedSpeed, eta });
        },
        onSuccess: () => {
          console.info("[upload] TUS success", {
            fileName: file.name,
            fileSize: file.size,
            storagePath,
            elapsedSec: Math.round((Date.now() - startTs) / 1000),
          });
          resolve();
        },
      });

      // Resume previous upload (same fingerprint = same bucket/path/version/file).
      upload.findPreviousUploads().then((previousUploads) => {
        if (previousUploads.length) {
          console.info("[upload] resuming previous TUS upload", { storagePath });
          upload.resumeFromPreviousUpload(previousUploads[0]);
        }
        upload.start();
      });

      // Cancel hook
      if (signal) {
        if (signal.aborted) {
          upload.abort(true);
          reject(new DOMException("Upload aborted", "AbortError"));
          return;
        }
        signal.addEventListener("abort", () => {
          try { upload.abort(true); } catch {}
          reject(new DOMException("Upload aborted", "AbortError"));
        });
      }
    });
  };

  /**
   * Standard (non-resumable) upload for small files (< 6 MB).
   * Single PUT — no benefit from TUS overhead.
   */
  const uploadFileStandard = async (
    file: File,
    storagePath: string,
    bucket = "videos",
    onProgress?: (info: { bytesUploaded: number; bytesTotal: number; pct: number; speed: number; eta: number }) => void
  ): Promise<void> => {
    onProgress?.({ bytesUploaded: 0, bytesTotal: file.size, pct: 0, speed: 0, eta: Infinity });
    const { error } = await supabase.storage
      .from(bucket)
      .upload(storagePath, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });
    if (error) throw new Error(error.message);
    onProgress?.({ bytesUploaded: file.size, bytesTotal: file.size, pct: 100, speed: 0, eta: 0 });
  };

  /**
   * Pre-flight validation. Returns null if OK, error message otherwise.
   */
  const validateFileForUpload = (file: File): string | null => {
    if (file.size <= 0) return "Plik jest pusty.";
    if (file.size > MAX_FILE_SIZE) {
      return `Plik za duży (${formatBytes(file.size)}). Maksimum to ${formatBytes(MAX_FILE_SIZE)}.`;
    }
    if (!isAllowedVideo(file)) {
      return `Nieobsługiwany format pliku: ${file.type || file.name}. Wgraj plik wideo (mp4, mov, webm, mkv...).`;
    }
    return null;
  };

  const uploadVideo = useCallback(
    async (
      file: File,
      folderId: string | null,
      onProgress?: (info: { bytesUploaded: number; bytesTotal: number; pct: number; speed: number; eta: number }) => void,
      aspectRatio?: string,
      signal?: AbortSignal
    ) => {
      // PRE-FLIGHT: validate size & MIME
      const validationError = validateFileForUpload(file);
      if (validationError) {
        toast.error("Plik odrzucony", { description: validationError });
        throw new Error(validationError);
      }

      const storagePath = `${crypto.randomUUID()}_${sanitizeFileName(file.name)}`;
      const title = file.name.replace(/\.[^/.]+$/, "");

      // Upload FIRST. We do not create a DB row until the upload + integrity
      // check pass. This prevents "ghost" rows that point to non-existent
      // storage objects (e.g. user closes tab mid-upload).
      try {
        if (file.size > TUS_THRESHOLD) {
          await uploadFileTus(file, storagePath, { onProgress, signal });
        } else {
          await uploadFileStandard(file, storagePath, "videos", onProgress);
        }

        // INTEGRITY CHECK: storage object size MUST equal original file size.
        const { data: headData, error: headErr } = await supabase.storage
          .from("videos")
          .list("", { search: storagePath, limit: 1 });

        if (headErr || !headData || headData.length === 0) {
          throw new Error("Plik nie pojawił się w magazynie po wysyłce.");
        }
        const storedSize = (headData[0] as any)?.metadata?.size as number | undefined;
        if (typeof storedSize === "number" && storedSize !== file.size) {
          console.error("[upload] size mismatch", {
            fileName: file.name,
            originalSize: file.size,
            storedSize,
            delta: file.size - storedSize,
          });
          try { await supabase.storage.from("videos").remove([storagePath]); } catch {}
          throw new Error(
            `Niezgodność rozmiaru: wysłano ${file.size} B, w magazynie ${storedSize} B. Plik mógł zostać uszkodzony – spróbuj ponownie.`
          );
        }

        // Now create the DB row.
        const { data: inserted, error: insertError } = await supabase
          .from("videos")
          .insert({
            title,
            file_name: file.name,
            size: file.size,
            folder_id: folderId,
            storage_path: storagePath,
            is_processed: false,
            processing_status: "pending",
            aspect_ratio: aspectRatio || "16:9",
          } as any)
          .select()
          .single();

        if (insertError || !inserted) {
          console.error("[upload] DB insert failed after upload", insertError);
          try { await supabase.storage.from("videos").remove([storagePath]); } catch {}
          toast.error("Błąd bazy danych", { description: insertError?.message });
          throw insertError ?? new Error("DB insert failed");
        }

        const videoId = inserted.id;
        const videoItem: VideoItem = {
          ...inserted,
          thumbnail_url: null,
          is_processed: false,
          processing_status: "pending",
        } as VideoItem;

        // Generate thumbnail (non-blocking)
        generateThumbnail(file, videoId).then((thumbUrl) => {
          if (thumbUrl) {
            setVideos((prev) => prev.map((v) => v.id === videoId ? { ...v, thumbnail_url: thumbUrl } : v));
          }
        });

        // Submit to Mux for HLS transcoding (fire-and-forget)
        supabase.functions.invoke("submit-to-mux", {
          body: { video_id: videoId, storage_path: storagePath },
        }).then(({ error }) => {
          if (error) console.error("[upload] Mux submit error (non-blocking):", error);
        });

        setVideos((prev) => [videoItem, ...prev]);
        subscribeToProcessingStatus(videoId);
        return videoItem;
      } catch (err: any) {
        const isAbort = err?.name === "AbortError";
        console.error("[upload] failed", {
          fileName: file.name,
          fileSize: file.size,
          storagePath,
          aborted: isAbort,
          error: err?.message,
        });
        try { await supabase.storage.from("videos").remove([storagePath]); } catch {}
        if (!isAbort) {
          toast.error("Upload nieudany", { description: err?.message || "Nieznany błąd" });
        }
        throw err;
      }
    },
    [subscribeToProcessingStatus]
  );

  const deleteVideo = useCallback(async (id: string) => {
    const video = videos.find((v) => v.id === id);
    if (video) {
      await supabase.storage.from("videos").remove([video.storage_path]);
      if (video.thumbnail_url) {
        await supabase.storage.from("thumbnails").remove([`${video.id}.jpg`]);
      }
    }
    await supabase.from("videos").delete().eq("id", id);
    setVideos((prev) => prev.filter((v) => v.id !== id));
  }, [videos]);

  const incrementPlays = useCallback(async (id: string) => {
    const video = videos.find((v) => v.id === id);
    if (!video) return;
    const newPlays = video.plays + 1;
    await supabase.from("videos").update({ plays: newPlays }).eq("id", id);
    setVideos((prev) => prev.map((v) => v.id === id ? { ...v, plays: newPlays } : v));
  }, [videos]);

  const createFolder = useCallback(async (name: string, parentId?: string | null) => {
    const { data, error } = await supabase
      .from("folders")
      .insert({ name, parent_id: parentId ?? null } as any)
      .select()
      .single();
    if (error) throw error;
    setFolders((prev) => [data as FolderItem, ...prev]);
  }, []);

  const toggleFavorite = useCallback(async (id: string) => {
    const video = videos.find((v) => v.id === id);
    if (!video) return;
    const newVal = !video.is_favorite;
    await supabase.from("videos").update({ is_favorite: newVal } as any).eq("id", id);
    setVideos((prev) => prev.map((v) => v.id === id ? { ...v, is_favorite: newVal } : v));
  }, [videos]);

  const moveVideo = useCallback(async (videoId: string, targetFolderId: string | null) => {
    await supabase.from("videos").update({ folder_id: targetFolderId }).eq("id", videoId);
    setVideos((prev) => prev.map((v) => v.id === videoId ? { ...v, folder_id: targetFolderId } : v));
  }, []);

  const isDescendant = useCallback((folderId: string, potentialParentId: string): boolean => {
    let current: string | null = potentialParentId;
    while (current) {
      if (current === folderId) return true;
      const folder = folders.find((f) => f.id === current);
      current = folder?.parent_id ?? null;
    }
    return false;
  }, [folders]);

  const moveFolder = useCallback(async (folderId: string, targetParentId: string | null) => {
    if (folderId === targetParentId) return;
    if (targetParentId && isDescendant(folderId, targetParentId)) return;
    await supabase.from("folders").update({ parent_id: targetParentId } as any).eq("id", folderId);
    setFolders((prev) => prev.map((f) => f.id === folderId ? { ...f, parent_id: targetParentId } : f));
  }, [isDescendant]);

  const deleteFolder = useCallback(async (id: string) => {
    await supabase.from("videos").update({ folder_id: null }).eq("folder_id", id);
    await supabase.from("folders").delete().eq("id", id);
    setFolders((prev) => prev.filter((f) => f.id !== id));
    setVideos((prev) => prev.map((v) => v.folder_id === id ? { ...v, folder_id: null } : v));
  }, []);

  const getVideoUrl = useCallback((storagePath: string) => {
    return getPublicUrl("videos", storagePath);
  }, []);

  const uploadVideoWithSeparateAudio = useCallback(
    async (
      videoFile: File,
      audioFile: File,
      folderId: string | null,
      onProgress?: (info: { bytesUploaded: number; bytesTotal: number; pct: number; speed: number; eta: number }) => void,
      aspectRatio?: string,
      signal?: AbortSignal
    ) => {
      const vErr = validateFileForUpload(videoFile);
      if (vErr) {
        toast.error("Plik odrzucony", { description: vErr });
        throw new Error(vErr);
      }
      if (audioFile.size > MAX_FILE_SIZE) {
        toast.error("Plik audio za duży", { description: `${formatBytes(audioFile.size)}` });
        throw new Error("Audio file too large");
      }

      const uuid = crypto.randomUUID();
      const videoStoragePath = `${uuid}_${sanitizeFileName(videoFile.name)}`;
      const audioStoragePath = `${uuid}_audio.mp3`;
      const totalBytes = videoFile.size + audioFile.size;

      const makeProgress = (offsetBytes: number) =>
        (info: { bytesUploaded: number; bytesTotal: number; pct: number; speed: number; eta: number }) => {
          const combinedBytes = offsetBytes + info.bytesUploaded;
          const pct = totalBytes > 0 ? (combinedBytes / totalBytes) * 100 : 0;
          const remaining = totalBytes - combinedBytes;
          const eta = info.speed > 0 ? remaining / info.speed : Infinity;
          onProgress?.({ bytesUploaded: combinedBytes, bytesTotal: totalBytes, pct, speed: info.speed, eta });
        };

      try {
        if (videoFile.size > TUS_THRESHOLD) {
          await uploadFileTus(videoFile, videoStoragePath, { onProgress: makeProgress(0), signal });
        } else {
          await uploadFileStandard(videoFile, videoStoragePath, "videos", makeProgress(0));
        }
        if (audioFile.size > TUS_THRESHOLD) {
          await uploadFileTus(audioFile, audioStoragePath, { onProgress: makeProgress(videoFile.size), bucket: "audio-tracks", signal });
        } else {
          await uploadFileStandard(audioFile, audioStoragePath, "audio-tracks", makeProgress(videoFile.size));
        }
      } catch (err: any) {
        try { await supabase.storage.from("videos").remove([videoStoragePath]); } catch {}
        try { await supabase.storage.from("audio-tracks").remove([audioStoragePath]); } catch {}
        throw err;
      }

      const { data: headData } = await supabase.storage
        .from("videos")
        .list("", { search: videoStoragePath, limit: 1 });
      const storedSize = (headData?.[0] as any)?.metadata?.size as number | undefined;
      if (typeof storedSize === "number" && storedSize !== videoFile.size) {
        try { await supabase.storage.from("videos").remove([videoStoragePath]); } catch {}
        try { await supabase.storage.from("audio-tracks").remove([audioStoragePath]); } catch {}
        const msg = `Niezgodność rozmiaru wideo (${storedSize} vs ${videoFile.size}).`;
        toast.error("Upload uszkodzony", { description: msg });
        throw new Error(msg);
      }

      const title = videoFile.name.replace(/\.[^/.]+$/, "");
      const { data: inserted, error: insertError } = await supabase
        .from("videos")
        .insert({
          title,
          file_name: videoFile.name,
          size: videoFile.size + audioFile.size,
          folder_id: folderId,
          storage_path: videoStoragePath,
          audio_track_path: audioStoragePath,
          is_processed: true,
          processing_status: "ready",
          aspect_ratio: aspectRatio || "16:9",
        } as any)
        .select()
        .single();

      if (insertError) {
        console.error("[upload] DB insert error:", insertError);
        toast.error("Błąd bazy danych", { description: insertError.message });
        throw insertError;
      }

      const videoItem: VideoItem = {
        ...inserted,
        thumbnail_url: null,
        is_processed: true,
        processing_status: "ready",
      } as VideoItem;

      generateThumbnail(videoFile, inserted.id).then((thumbUrl) => {
        if (thumbUrl) {
          setVideos((prev) => prev.map((v) => v.id === inserted.id ? { ...v, thumbnail_url: thumbUrl } : v));
        }
      });

      supabase.functions.invoke("submit-to-mux", {
        body: { video_id: inserted.id, storage_path: videoStoragePath },
      }).catch(() => {});

      setVideos((prev) => [videoItem, ...prev]);
      return videoItem;
    },
    []
  );

  return {
    videos,
    folders,
    loading,
    uploadVideo,
    uploadVideoWithSeparateAudio,
    deleteVideo,
    incrementPlays,
    toggleFavorite,
    createFolder,
    moveVideo,
    moveFolder,
    deleteFolder,
    getVideoUrl,
    fetchVideos,
    fetchFolders,
  };
}
