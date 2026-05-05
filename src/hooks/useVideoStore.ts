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

  const uploadFileTus = async (file: File, storagePath: string, onProgress?: (pct: number) => void, bucket = "videos"): Promise<void> => {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      throw new Error("Sesja wygasła – zaloguj się ponownie, aby przesłać plik.");
    }

    return new Promise((resolve, reject) => {
      const upload = new tus.Upload(file, {
        endpoint: `${url}/storage/v1/upload/resumable`,
        retryDelays: [0, 3000, 5000, 10000, 15000, 20000],
        chunkSize: 3 * 1024 * 1024, // 3MB
        headers: {
          // authorization is set dynamically in onBeforeRequest to avoid XHR header accumulation
          apikey: anonKey,
        },
        uploadDataDuringCreation: true,
        removeFingerprintOnSuccess: true,
        // CRITICAL: bind fingerprint to the destination path so re-uploads of the
        // same file to a NEW path don't resume into an OLD orphaned upload.
        fingerprint: async (f) =>
          ["tus-br", bucket, storagePath, f.size, f.lastModified].join("-"),
        metadata: {
          bucketName: bucket,
          objectName: storagePath,
          contentType: file.type || "application/octet-stream",
          cacheControl: "3600",
        },
        onBeforeRequest: async (req) => {
          const { data: { session } } = await supabase.auth.getSession();
          const freshToken = session?.access_token ?? token;
          req.setHeader("authorization", `Bearer ${freshToken}`);
        },
        onError: (error) => {
          console.error("TUS error:", error);
          toast.error("Błąd uploadu", { description: String(error.message) });
          reject(new Error(`Upload failed: ${error.message}`));
        },
        onProgress: (bytesUploaded, bytesTotal) => {
          const pct = Math.round((bytesUploaded / bytesTotal) * 95);
          onProgress?.(pct);
        },
        onSuccess: () => {
          resolve();
        },
      });

      // Check for previous uploads to resume
      upload.findPreviousUploads().then((previousUploads) => {
        if (previousUploads.length) {
          upload.resumeFromPreviousUpload(previousUploads[0]);
        }
        upload.start();
      });
    });
  };

  const processFileInWorker = (buffer: ArrayBuffer): Promise<ArrayBuffer> => {
    return new Promise((resolve, reject) => {
      const worker = new Worker(
        new URL("../workers/faststartWorker.ts", import.meta.url),
        { type: "module" }
      );
      worker.onmessage = (e: MessageEvent<FaststartResponse>) => {
        worker.terminate();
        if (e.data.type === "DONE") resolve(e.data.buffer);
        else reject(new Error(e.data.error));
      };
      worker.onerror = (err) => {
        worker.terminate();
        reject(new Error(err.message || "Worker error"));
      };
      worker.postMessage(
        { type: "PROCESS", buffer, videoId: "upload" },
        [buffer]
      );
    });
  };

  const uploadVideo = useCallback(
    async (
      file: File,
      folderId: string | null,
      onProgress?: (pct: number) => void,
      aspectRatio?: string
    ) => {
      const storagePath = `${crypto.randomUUID()}_${sanitizeFileName(file.name)}`;

      // SAFETY: For large files (>200MB) skip ALL client-side byte rewriting
      // (metadata strip + faststart). Past attempts to rewrite the moov atom
      // shifted media data without updating stco/co64 offsets, which produced
      // corrupted MP4s that Mux rejected. Mux will handle faststart server-side.
      const STRIP_MAX_SIZE = 200 * 1024 * 1024;
      const cleanFile = file.size > STRIP_MAX_SIZE ? file : await stripVideoMetadata(file);
      console.log("Strip done, file size:", cleanFile.size, "(original:", file.size, ")");

      // --- Faststart pre-processing ---
      let fileToUpload: File = cleanFile;
      let isProcessed = false;
      const isMp4 = /\.(mp4|m4v|mov)$/i.test(file.name);

      const FASTSTART_MAX_SIZE = 200 * 1024 * 1024;

      if (isMp4 && cleanFile.size > FASTSTART_MAX_SIZE) {
        console.log("Skipping client-side faststart for large file:", cleanFile.size);
        toast.info("Duży plik – optymalizacja zostanie wykonana po stronie serwera (Mux).");
        fileToUpload = cleanFile;
        isProcessed = false;
      } else if (isMp4) {
        try {
          // Step 1: Quick check using only first 64KB
          const headerSlice = cleanFile.slice(0, 65536);
          const headerBuffer = await headerSlice.arrayBuffer();

          const isFast = quickCheck(headerBuffer);
          console.log("Is faststart:", isFast);

          if (!isFast) {
            // Need to process — safely read full file (may OOM on edge cases)
            let fullBuffer: ArrayBuffer;
            try {
              fullBuffer = await cleanFile.arrayBuffer();
            } catch (allocErr) {
              console.error("arrayBuffer() failed (likely OOM), skipping faststart:", allocErr);
              toast.info("Pominięto optymalizację (Mux dokończy po stronie serwera).");
              fileToUpload = cleanFile;
              isProcessed = false;
              throw new Error("__skip_faststart__");
            }

            const SIZE_100MB = 100 * 1024 * 1024;
            let processedBuffer: ArrayBuffer;

            if (cleanFile.size < SIZE_100MB) {
              processedBuffer = relocateMoovToStart(fullBuffer);
            } else {
              console.log("Starting faststart worker for file size:", cleanFile.size);
              toast.info("Optymalizacja wideo dla szybkiego odtwarzania...");
              processedBuffer = await processFileInWorker(fullBuffer);
              console.log("Worker done, processed size:", processedBuffer.byteLength);
            }

            fileToUpload = new File([processedBuffer], cleanFile.name, {
              type: cleanFile.type || "video/mp4",
            });
            isProcessed = true;
          }
        } catch (err: any) {
          if (err?.message !== "__skip_faststart__") {
            console.error("Worker/faststart failed:", err);
            toast.info("Pominięto optymalizację (Mux dokończy po stronie serwera).");
            fileToUpload = cleanFile;
            isProcessed = false;
          }
        }
      }

      // Upload file with real progress
      console.log("Starting TUS upload, file size:", fileToUpload.size, "storage path:", storagePath);
      onProgress?.(0);
      await uploadFileTus(fileToUpload, storagePath, onProgress);

      // Verify the object actually landed in storage before creating a DB row.
      // Otherwise we'd create a "ghost" video that submit-to-mux can't sign.
      const { data: headData, error: headErr } = await supabase.storage
        .from("videos")
        .list("", { search: storagePath, limit: 1 });
      if (headErr || !headData || headData.length === 0) {
        const msg = "Plik nie pojawił się w magazynie po wysyłce. Spróbuj ponownie.";
        toast.error("Upload niekompletny", { description: msg });
        throw new Error(msg);
      }

      // Insert metadata (90-95%)
      onProgress?.(91);
      console.log("Inserting to DB, is_processed:", isProcessed);
      const title = file.name.replace(/\.[^/.]+$/, "");
      const { data: inserted, error: insertError } = await supabase
        .from("videos")
        .insert({
          title,
          file_name: file.name,
          size: file.size,
          folder_id: folderId,
          storage_path: storagePath,
          is_processed: isProcessed,
          processing_status: isProcessed ? "ready" : "pending",
          aspect_ratio: aspectRatio || "16:9",
        } as any)
        .select()
        .single();

      if (insertError) {
        console.error("DB insert error:", insertError);
        toast.error("Błąd bazy danych", { description: insertError.message });
        throw insertError;
      }
      onProgress?.(95);

      const videoItem: VideoItem = {
        ...inserted,
        thumbnail_url: null,
        is_processed: isProcessed,
        processing_status: isProcessed ? "ready" : "pending",
      } as VideoItem;

      // Generate thumbnail in background (non-blocking)
      generateThumbnail(file, inserted.id).then((thumbUrl) => {
        if (thumbUrl) {
          setVideos((prev) => prev.map((v) => v.id === inserted.id ? { ...v, thumbnail_url: thumbUrl } : v));
        }
      });

      // Submit to Mux for HLS transcoding (fire-and-forget)
      supabase.functions.invoke("submit-to-mux", {
        body: { video_id: inserted.id, storage_path: storagePath },
      }).then(({ error }) => {
        if (error) console.error("Mux submit error (non-blocking):", error);
        else console.log("Submitted to Mux for processing:", inserted.id);
      });

      onProgress?.(100);
      setVideos((prev) => [videoItem, ...prev]);

      // Subscribe for real-time status updates if still processing
      if (!isProcessed) {
        subscribeToProcessingStatus(inserted.id);
      }

      return videoItem;
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
      onProgress?: (pct: number) => void,
      aspectRatio?: string
    ) => {
      const uuid = crypto.randomUUID();
      const videoStoragePath = `${uuid}_${sanitizeFileName(videoFile.name)}`;
      const audioStoragePath = `${uuid}_audio.mp3`;

      // Upload video file via TUS
      onProgress?.(0);
      await uploadFileTus(videoFile, videoStoragePath, (pct) => {
        onProgress?.(Math.round(pct * 0.6)); // 0-57% for video
      });

      // Upload audio file to audio-tracks bucket via TUS (resumable)
      onProgress?.(60);
      await uploadFileTus(audioFile, audioStoragePath, (pct) => {
        onProgress?.(60 + Math.round(pct * 0.2)); // 60-80% for audio
      }, "audio-tracks");
      onProgress?.(80);

      // Insert metadata
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
        console.error("DB insert error:", insertError);
        toast.error("Błąd bazy danych", { description: insertError.message });
        throw insertError;
      }
      onProgress?.(90);

      const videoItem: VideoItem = {
        ...inserted,
        thumbnail_url: null,
        is_processed: true,
        processing_status: "ready",
      } as VideoItem;

      // Generate thumbnail
      generateThumbnail(videoFile, inserted.id).then((thumbUrl) => {
        if (thumbUrl) {
          setVideos((prev) => prev.map((v) => v.id === inserted.id ? { ...v, thumbnail_url: thumbUrl } : v));
        }
      });

      // Submit to Mux
      supabase.functions.invoke("submit-to-mux", {
        body: { video_id: inserted.id, storage_path: videoStoragePath },
      }).catch(() => {});

      onProgress?.(100);
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
