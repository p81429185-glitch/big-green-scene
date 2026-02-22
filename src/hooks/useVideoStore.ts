import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

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
}

export interface FolderItem {
  id: string;
  name: string;
  created_at: string;
}

export function useVideoStore() {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchVideos = useCallback(async () => {
    const { data } = await supabase
      .from("videos")
      .select("*")
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
  }, [fetchVideos, fetchFolders]);

  const getPublicUrl = (bucket: string, path: string) => {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  };

  const generateThumbnail = async (videoUrl: string, videoId: string): Promise<string | null> => {
    return new Promise((resolve) => {
      const video = document.createElement("video");
      video.crossOrigin = "anonymous";
      video.muted = true;
      video.preload = "metadata";
      video.src = videoUrl;

      video.addEventListener("loadeddata", () => {
        video.currentTime = Math.min(1, video.duration / 2);
      });

      video.addEventListener("seeked", async () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = 320;
          canvas.height = 180;
          const ctx = canvas.getContext("2d");
          if (!ctx) { resolve(null); return; }
          ctx.drawImage(video, 0, 0, 320, 180);
          canvas.toBlob(async (blob) => {
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
          resolve(null);
        }
      });

      video.addEventListener("error", () => resolve(null));
      setTimeout(() => resolve(null), 10000);
    });
  };

  const uploadVideo = useCallback(
    async (
      file: File,
      folderId: string | null,
      onProgress?: (pct: number) => void
    ) => {
      const storagePath = `${crypto.randomUUID()}_${file.name}`;

      // Upload file
      onProgress?.(10);
      const { error: uploadError } = await supabase.storage
        .from("videos")
        .upload(storagePath, file, { contentType: file.type, upsert: false });

      if (uploadError) throw uploadError;
      onProgress?.(60);

      const title = file.name.replace(/\.[^/.]+$/, "");

      // Insert metadata
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
      onProgress?.(80);

      // Generate thumbnail in background
      const videoUrl = getPublicUrl("videos", storagePath);
      const thumbUrl = await generateThumbnail(videoUrl, inserted.id);
      onProgress?.(100);

      const videoItem: VideoItem = {
        ...inserted,
        thumbnail_url: thumbUrl ?? inserted.thumbnail_url,
      } as VideoItem;

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

  const createFolder = useCallback(async (name: string) => {
    const { data, error } = await supabase
      .from("folders")
      .insert({ name })
      .select()
      .single();
    if (error) throw error;
    setFolders((prev) => [data as FolderItem, ...prev]);
  }, []);

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
    createFolder,
    deleteFolder,
    getVideoUrl,
    fetchVideos,
    fetchFolders,
  };
}
