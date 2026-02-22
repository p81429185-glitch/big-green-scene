import { useState, useCallback } from "react";

export interface VideoItem {
  id: string;
  title: string;
  fileName: string;
  size: number;
  createdAt: string;
  folderId: string | null;
  plays: number;
}

export interface FolderItem {
  id: string;
  name: string;
  createdAt: string;
}

interface Store {
  videos: VideoItem[];
  folders: FolderItem[];
}

const STORAGE_KEY = "bighosting_store";

function loadStore(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { videos: [], folders: [] };
}

function saveStore(store: Store) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function useVideoStore() {
  const [store, setStore] = useState<Store>(loadStore);

  const persist = useCallback((next: Store) => {
    setStore(next);
    saveStore(next);
  }, []);

  const addVideo = useCallback(
    (video: Omit<VideoItem, "id" | "createdAt" | "plays">) => {
      setStore((prev) => {
        const next = {
          ...prev,
          videos: [
            ...prev.videos,
            {
              ...video,
              id: crypto.randomUUID(),
              createdAt: new Date().toISOString(),
              plays: 0,
            },
          ],
        };
        saveStore(next);
        return next;
      });
    },
    []
  );

  const deleteVideo = useCallback((id: string) => {
    setStore((prev) => {
      const next = { ...prev, videos: prev.videos.filter((v) => v.id !== id) };
      saveStore(next);
      return next;
    });
  }, []);

  const createFolder = useCallback((name: string) => {
    setStore((prev) => {
      const next = {
        ...prev,
        folders: [
          ...prev.folders,
          { id: crypto.randomUUID(), name, createdAt: new Date().toISOString() },
        ],
      };
      saveStore(next);
      return next;
    });
  }, []);

  const deleteFolder = useCallback((id: string) => {
    setStore((prev) => {
      const next = {
        ...prev,
        folders: prev.folders.filter((f) => f.id !== id),
        videos: prev.videos.map((v) =>
          v.folderId === id ? { ...v, folderId: null } : v
        ),
      };
      saveStore(next);
      return next;
    });
  }, []);

  return {
    videos: store.videos,
    folders: store.folders,
    addVideo,
    deleteVideo,
    createFolder,
    deleteFolder,
  };
}
