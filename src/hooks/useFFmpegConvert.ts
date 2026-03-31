import { useState, useRef, useCallback } from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toast } from "@/hooks/use-toast";

export function useFFmpegConvert() {
  const ffmpegRef = useRef<FFmpeg | null>(null);
  const loadedRef = useRef(false);
  const [progress, setProgress] = useState(0);
  const [isConverting, setIsConverting] = useState(false);

  const convertToMp3 = useCallback(async (videoUrl: string, outputName: string) => {
    try {
      // #region agent log
      fetch("http://127.0.0.1:7939/ingest/406639ab-d399-4adb-99bb-94bd7c7ec39f", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "ea7bfa" }, body: JSON.stringify({ sessionId: "ea7bfa", runId: "pre-fix", hypothesisId: "H1_H2", location: "useFFmpegConvert.ts:convertToMp3:start", message: "FFmpeg convert start env check", data: { crossOriginIsolated: window.crossOriginIsolated, sharedArrayBuffer: typeof SharedArrayBuffer !== "undefined", videoUrlPresent: !!videoUrl, outputNamePresent: !!outputName }, timestamp: Date.now() }) }).catch(() => {});
      // #endregion
      setIsConverting(true);
      setProgress(0);

      if (!ffmpegRef.current) {
        ffmpegRef.current = new FFmpeg();
      }

      const ffmpeg = ffmpegRef.current;

      if (!loadedRef.current) {
        // #region agent log
        fetch("http://127.0.0.1:7939/ingest/406639ab-d399-4adb-99bb-94bd7c7ec39f", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "ea7bfa" }, body: JSON.stringify({ sessionId: "ea7bfa", runId: "pre-fix", hypothesisId: "H1", location: "useFFmpegConvert.ts:ffmpeg.load:before", message: "Before ffmpeg.load", data: { loaded: loadedRef.current }, timestamp: Date.now() }) }).catch(() => {});
        // #endregion
        await ffmpeg.load({
          coreURL: "https://unpkg.com/@ffmpeg/core-st@0.12.6/dist/umd/ffmpeg-core.js",
        });
        loadedRef.current = true;
        // #region agent log
        fetch("http://127.0.0.1:7939/ingest/406639ab-d399-4adb-99bb-94bd7c7ec39f", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "ea7bfa" }, body: JSON.stringify({ sessionId: "ea7bfa", runId: "pre-fix", hypothesisId: "H1", location: "useFFmpegConvert.ts:ffmpeg.load:after", message: "After ffmpeg.load success", data: { loaded: true }, timestamp: Date.now() }) }).catch(() => {});
        // #endregion
      }

      ffmpeg.on("progress", ({ progress: p }) => {
        setProgress(Math.round(p * 100));
      });

      const response = await fetch(videoUrl);
      const buffer = await response.arrayBuffer();

      await ffmpeg.writeFile("input.mp4", new Uint8Array(buffer));
      await ffmpeg.exec(["-i", "input.mp4", "-vn", "-acodec", "libmp3lame", "-q:a", "2", "-y", "output.mp3"]);

      const data = await ffmpeg.readFile("output.mp3");
      const blob = new Blob([new Uint8Array((data as Uint8Array).buffer as ArrayBuffer)], { type: "audio/mpeg" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = outputName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      await ffmpeg.deleteFile("input.mp4");
      await ffmpeg.deleteFile("output.mp3");

      setIsConverting(false);
      setProgress(0);
    } catch (err) {
      // #region agent log
      fetch("http://127.0.0.1:7939/ingest/406639ab-d399-4adb-99bb-94bd7c7ec39f", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "ea7bfa" }, body: JSON.stringify({ sessionId: "ea7bfa", runId: "pre-fix", hypothesisId: "H1_H3", location: "useFFmpegConvert.ts:convertToMp3:catch", message: "FFmpeg convert failed", data: { errorMessage: err instanceof Error ? err.message : String(err), crossOriginIsolated: window.crossOriginIsolated, sharedArrayBuffer: typeof SharedArrayBuffer !== "undefined" }, timestamp: Date.now() }) }).catch(() => {});
      // #endregion
      console.error("FFmpeg conversion error:", err);
      toast({
        title: "Błąd konwersji",
        description: "Błąd konwersji — spróbuj ponownie",
        variant: "destructive",
      });
      setIsConverting(false);
      setProgress(0);
    }
  }, []);

  return { convertToMp3, progress, isConverting };
}
