import { useState, useRef, useCallback } from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";

interface CompressionProgress {
  phase: "loading" | "analyzing" | "compressing" | "done" | "error";
  progress: number; // 0-100
  eta: number; // seconds
  message: string;
}

interface VideoMetadata {
  width: number;
  height: number;
  duration: number;
  bitrate: number; // bytes/sec
  size: number;
}

interface CompressionResult {
  file: File;
  originalSize: number;
  compressedSize: number;
  savingsPercent: number;
}

export function useVideoCompression() {
  const ffmpegRef = useRef<FFmpeg | null>(null);
  const [progress, setProgress] = useState<CompressionProgress>({
    phase: "loading",
    progress: 0,
    eta: Infinity,
    message: "",
  });
  const [isCompressing, setIsCompressing] = useState(false);

  const checkSupport = useCallback((): { supported: boolean; reason?: string } => {
    if (typeof SharedArrayBuffer === "undefined") {
      return { supported: false, reason: "SharedArrayBuffer niedostępny (brak COOP/COEP headers)" };
    }
    if (!crossOriginIsolated) {
      return { supported: false, reason: "crossOriginIsolated = false" };
    }
    return { supported: true };
  }, []);

  const loadFFmpeg = useCallback(async (): Promise<void> => {
    if (ffmpegRef.current) return;

    setProgress({ phase: "loading", progress: 0, eta: Infinity, message: "Ładowanie ffmpeg.wasm..." });

    const ffmpeg = new FFmpeg();
    ffmpeg.on("log", ({ message }) => {
      console.log("[ffmpeg]", message);
    });

    await ffmpeg.load({
      coreURL: "https://unpkg.com/@ffmpeg/core-st@0.12.6/dist/umd/ffmpeg-core.js",
    });

    ffmpegRef.current = ffmpeg;
    console.info("[compression] ffmpeg.wasm loaded");
  }, []);

  const analyzeVideo = useCallback(async (file: File): Promise<VideoMetadata | null> => {
    try {
      setProgress({ phase: "analyzing", progress: 10, eta: Infinity, message: "Analiza wideo..." });

      const video = document.createElement("video");
      video.preload = "metadata";
      video.src = URL.createObjectURL(file);

      const metadata = await new Promise<VideoMetadata | null>((resolve) => {
        video.onloadedmetadata = () => {
          const width = video.videoWidth;
          const height = video.videoHeight;
          const duration = video.duration;
          const bitrate = file.size / duration; // bytes/sec

          URL.revokeObjectURL(video.src);

          if (!width || !height || !duration) {
            resolve(null);
            return;
          }

          resolve({ width, height, duration, bitrate, size: file.size });
        };

        video.onerror = () => {
          URL.revokeObjectURL(video.src);
          resolve(null);
        };

        setTimeout(() => {
          URL.revokeObjectURL(video.src);
          resolve(null);
        }, 10000);
      });

      return metadata;
    } catch (err) {
      console.error("[compression] analyze failed:", err);
      return null;
    }
  }, []);

  const selectBitrate = useCallback((width: number, height: number): string => {
    const pixels = width * height;
    if (pixels <= 640 * 480) return "1M";      // 480p
    if (pixels <= 1280 * 720) return "2.5M";   // 720p
    if (pixels <= 1920 * 1080) return "5M";    // 1080p
    return "15M";                               // 4K
  }, []);

  const shouldCompress = useCallback((metadata: VideoMetadata, targetBitrate: string): boolean => {
    const targetBps = parseFloat(targetBitrate) * 1024 * 1024 / 8; // Mbps → bytes/sec
    const currentBps = metadata.bitrate;

    // Skip jeśli już skompresowany (bitrate <= target * 1.2)
    if (currentBps <= targetBps * 1.2) {
      console.info("[compression] already compressed, skipping", {
        currentMbps: (currentBps * 8 / (1024 * 1024)).toFixed(2),
        targetMbps: targetBitrate,
      });
      return false;
    }

    return true;
  }, []);

  const compressVideo = useCallback(
    async (file: File): Promise<CompressionResult | null> => {
      const support = checkSupport();
      if (!support.supported) {
        console.warn("[compression] not supported:", support.reason);
        return null;
      }

      if (file.size > 2 * 1024 * 1024 * 1024) {
        console.warn("[compression] file too large (>2GB), skipping");
        setProgress({
          phase: "error",
          progress: 0,
          eta: 0,
          message: "Pliki >2GB: kompresja niedostępna (limit pamięci)",
        });
        return null;
      }

      try {
        setIsCompressing(true);

        await loadFFmpeg();

        const metadata = await analyzeVideo(file);
        if (!metadata) {
          throw new Error("Nie udało się przeanalizować wideo");
        }

        const targetBitrate = selectBitrate(metadata.width, metadata.height);

        if (!shouldCompress(metadata, targetBitrate)) {
          setProgress({
            phase: "done",
            progress: 100,
            eta: 0,
            message: "Plik już skompresowany, pomijam",
          });
          return null;
        }

        const ffmpeg = ffmpegRef.current!;

        setProgress({
          phase: "compressing",
          progress: 20,
          eta: metadata.duration * 0.5, // Estymacja: 0.5× realtime
          message: `Kompresja do ${targetBitrate}...`,
        });

        const startTs = Date.now();
        let lastProgressUpdate = 0;

        ffmpeg.on("progress", ({ progress: p, time }) => {
          const now = Date.now();
          if (now - lastProgressUpdate < 500) return;
          lastProgressUpdate = now;

          const pct = Math.min(95, 20 + p * 75); // 20-95%
          const elapsed = (now - startTs) / 1000;
          const eta = p > 0 ? (elapsed / p) * (1 - p) : Infinity;

          setProgress({
            phase: "compressing",
            progress: pct,
            eta,
            message: `Kompresja: ${Math.round(pct)}%`,
          });
        });

        await ffmpeg.writeFile("input.mp4", await fetchFile(file));

        await ffmpeg.exec([
          "-i", "input.mp4",
          "-c:v", "libx264",
          "-preset", "fast",
          "-b:v", targetBitrate,
          "-c:a", "aac",
          "-b:a", "128k",
          "-movflags", "+faststart",
          "-y", "output.mp4",
        ]);

        const data = await ffmpeg.readFile("output.mp4");
        const blob = new Blob([data as BlobPart], { type: "video/mp4" });
        const compressedFile = new File([blob], file.name, { type: "video/mp4" });

        await ffmpeg.deleteFile("input.mp4");
        await ffmpeg.deleteFile("output.mp4");

        const savingsPercent = Math.round((1 - compressedFile.size / file.size) * 100);

        setProgress({
          phase: "done",
          progress: 100,
          eta: 0,
          message: `Gotowe! Oszczędność: ${savingsPercent}%`,
        });

        console.info("[compression] success", {
          originalSize: file.size,
          compressedSize: compressedFile.size,
          savingsPercent,
          elapsedSec: Math.round((Date.now() - startTs) / 1000),
        });

        setIsCompressing(false);

        return {
          file: compressedFile,
          originalSize: file.size,
          compressedSize: compressedFile.size,
          savingsPercent,
        };
      } catch (err) {
        console.error("[compression] failed:", err);
        setProgress({
          phase: "error",
          progress: 0,
          eta: 0,
          message: err instanceof Error ? err.message : "Błąd kompresji",
        });
        setIsCompressing(false);
        return null;
      }
    },
    [checkSupport, loadFFmpeg, analyzeVideo, selectBitrate, shouldCompress]
  );

  const estimateCompressedSize = useCallback(
    async (file: File): Promise<{ originalSize: number; estimatedSize: number; savingsPercent: number } | null> => {
      const metadata = await analyzeVideo(file);
      if (!metadata) return null;

      const targetBitrate = selectBitrate(metadata.width, metadata.height);
      const targetBps = parseFloat(targetBitrate) * 1024 * 1024 / 8;

      if (!shouldCompress(metadata, targetBitrate)) {
        return { originalSize: file.size, estimatedSize: file.size, savingsPercent: 0 };
      }

      const estimatedVideoSize = targetBps * metadata.duration;
      const audioSize = 128 * 1024 / 8 * metadata.duration; // 128 kbps AAC
      const estimatedSize = estimatedVideoSize + audioSize;
      const savingsPercent = Math.round((1 - estimatedSize / file.size) * 100);

      return {
        originalSize: file.size,
        estimatedSize: Math.round(estimatedSize),
        savingsPercent: Math.max(0, savingsPercent),
      };
    },
    [analyzeVideo, selectBitrate, shouldCompress]
  );

  return {
    compressVideo,
    estimateCompressedSize,
    progress,
    isCompressing,
    isSupported: checkSupport().supported,
    supportReason: checkSupport().reason,
  };
}
