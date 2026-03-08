import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { stripVideoMetadata } from "@/lib/stripVideoMetadata";
import * as tus from "tus-js-client";
import type { RealtimeChannel } from "@supabase/supabase-js";

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
      .select("id,title,file_name,size,folder_id,plays,storage_path,thumbnail_url,created_at,is_favorite,is_processed,processing_status")
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
    const objectUrl = URL.createObjectURL(file);
    return new Promise((resolve) => {
      const video = document.createElement("video");
      video.muted = true;
      video.preload = "metadata";
      video.src = objectUrl;

      const cleanup = () => URL.revokeObjectURL(objectUrl);

      video.addEventListener("loadeddata", () => {
        video.currentTime = Math.min(1, video.duration / 2);
      });

      video.addEventListener("seeked", async () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = 320;
          canvas.height = 180;
          const ctx = canvas.getContext("2d");
          if (!ctx) { cleanup(); resolve(null); return; }
          ctx.drawImage(video, 0, 0, 320, 180);
          canvas.toBlob(async (blob) => {
            cleanup();
            if (!blob) { resolve(null); return; }
            const thumbPath = `${videoId}.jpg`;
            const { error } = await supabase.storage
              .from("thumbnails")
              .upload(thumbPath, blob, { contentType: "image/jpeg", upsert: true });
            if (error) { resolve(null); return; }
            const url = getPublicUrl("thumbnails", thumbPath);
            await supabase.from("videos").update({ thumbnail_url: url }).eq("id", videoId);
            resolve(url);
          }, "image/jpeg", 0.7);
        } catch {
          cleanup();
          resolve(null);
        }
      });

      video.addEventListener("error", () => { cleanup(); resolve(null); });
      setTimeout(() => { cleanup(); resolve(null); }, 10000);
    });
  };

  const uploadFileTus = async (file: File, storagePath: string, onProgress?: (pct: number) => void): Promise<void> => {
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
        retryDelays: [0, 1000, 3000, 5000],
        chunkSize: 6 * 1024 * 1024, // 6MB
        headers: {
          authorization: `Bearer ${token}`,
          apikey: anonKey,
        },
        uploadDataDuringCreation: true,
        removeFingerprintOnSuccess: true,
        metadata: {
          bucketName: "videos",
          objectName: storagePath,
          contentType: file.type || "application/octet-stream",
          cacheControl: "3600",
        },
        onError: (error) => {
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

  const uploadVideo = useCallback(
    async (
      file: File,
      folderId: string | null,
      onProgress?: (pct: number) => void
    ) => {
      const storagePath = `${crypto.randomUUID()}_${sanitizeFileName(file.name)}`;

      // Strip metadata (GPS, device info) before upload
      const cleanFile = await stripVideoMetadata(file);

      // Upload cleaned file with real progress
      onProgress?.(0);
      await uploadFileTus(cleanFile, storagePath, onProgress);

      // Insert metadata (90-95%)
      onProgress?.(91);
      const title = file.name.replace(/\.[^/.]+$/, "");
      const { data: inserted, error: insertError } = await supabase
        .from("videos")
        .insert({
          title,
          file_name: file.name,
          size: file.size,
          folder_id: folderId,
          storage_path: storagePath,
        })
        .select()
        .single();

      if (insertError) throw insertError;
      onProgress?.(95);

      const videoItem: VideoItem = {
        ...inserted,
        thumbnail_url: null,
        is_processed: false,
        processing_status: "pending",
      } as VideoItem;

      // Subscribe to realtime processing status updates
      subscribeToProcessingStatus(inserted.id);

      // Trigger faststart processing in background (fire-and-forget)
      supabase.functions.invoke("process-video-faststart", {
        body: { videoId: inserted.id, storagePath },
      }).catch((err) => {
        console.error("Faststart processing invocation error:", err);
      });

      // Generate thumbnail in background (non-blocking)
      generateThumbnail(file, inserted.id).then((thumbUrl) => {
        if (thumbUrl) {
          setVideos((prev) => prev.map((v) => v.id === inserted.id ? { ...v, thumbnail_url: thumbUrl } : v));
        }
      });

      onProgress?.(100);
      setVideos((prev) => [videoItem, ...prev]);
      return videoItem;
    },
    []
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

  return {
    videos,
    folders,
    loading,
    uploadVideo,
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
