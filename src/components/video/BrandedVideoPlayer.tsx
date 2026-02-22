import { useRef, useState, useEffect, useCallback, forwardRef, useImperativeHandle } from "react";
import { useBrandSettings } from "@/hooks/useBrandSettings";

interface SrtSegment {
  id: number;
  startTime: number;
  endTime: number;
  text: string;
}

function parseSrt(srt: string): SrtSegment[] {
  const blocks = srt.trim().split(/\n\s*\n/);
  const segments: SrtSegment[] = [];
  for (const block of blocks) {
    const lines = block.trim().split("\n");
    if (lines.length < 3) continue;
    const id = parseInt(lines[0], 10);
    const timeMatch = lines[1].match(
      /(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/
    );
    if (!timeMatch) continue;
    const startTime =
      +timeMatch[1] * 3600 + +timeMatch[2] * 60 + +timeMatch[3] + +timeMatch[4] / 1000;
    const endTime =
      +timeMatch[5] * 3600 + +timeMatch[6] * 60 + +timeMatch[7] + +timeMatch[8] / 1000;
    const text = lines.slice(2).join("\n");
    segments.push({ id, startTime, endTime, text });
  }
  return segments;
}

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec < 10 ? "0" : ""}${sec}`;
}

interface BrandedVideoPlayerProps {
  src: string;
  poster?: string;
  subtitlesSrt?: string | null;
  autoPlay?: boolean;
  onTimeUpdate?: (time: number) => void;
}

export interface BrandedVideoPlayerHandle {
  seek: (seconds: number) => void;
  play: () => void;
}

const BrandedVideoPlayer = forwardRef<BrandedVideoPlayerHandle, BrandedVideoPlayerProps>(
  ({ src, poster, subtitlesSrt, autoPlay, onTimeUpdate }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const { settings } = useBrandSettings();

    const [playing, setPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [muted, setMuted] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const [currentSubtitle, setCurrentSubtitle] = useState("");
    const [started, setStarted] = useState(false);

    const segments = subtitlesSrt ? parseSrt(subtitlesSrt) : [];

    useImperativeHandle(ref, () => ({
      seek: (seconds: number) => {
        if (videoRef.current) {
          videoRef.current.currentTime = seconds;
          videoRef.current.play();
        }
      },
      play: () => videoRef.current?.play(),
    }));

    const togglePlay = useCallback(() => {
      const v = videoRef.current;
      if (!v) return;
      if (v.paused) {
        v.play();
        setStarted(true);
      } else {
        v.pause();
      }
    }, []);

    const handleTimeUpdate = useCallback(() => {
      const v = videoRef.current;
      if (!v) return;
      setCurrentTime(v.currentTime);
      onTimeUpdate?.(v.currentTime);

      if (segments.length > 0) {
        const active = segments.find(
          (s) => v.currentTime >= s.startTime && v.currentTime <= s.endTime
        );
        setCurrentSubtitle(active?.text ?? "");
      }
    }, [segments, onTimeUpdate]);

    const handleSeek = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        const v = videoRef.current;
        if (!v || !duration) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const ratio = (e.clientX - rect.left) / rect.width;
        v.currentTime = ratio * duration;
      },
      [duration]
    );

    const toggleFullscreen = useCallback(() => {
      const el = containerRef.current;
      if (!el) return;
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        el.requestFullscreen();
      }
    }, []);

    useEffect(() => {
      const v = videoRef.current;
      if (!v) return;
      const onPlay = () => setPlaying(true);
      const onPause = () => setPlaying(false);
      const onLoaded = () => setDuration(v.duration);
      v.addEventListener("play", onPlay);
      v.addEventListener("pause", onPause);
      v.addEventListener("loadedmetadata", onLoaded);
      return () => {
        v.removeEventListener("play", onPlay);
        v.removeEventListener("pause", onPause);
        v.removeEventListener("loadedmetadata", onLoaded);
      };
    }, []);

    const progress = duration ? (currentTime / duration) * 100 : 0;

    return (
      <div
        ref={containerRef}
        className="relative bg-black rounded-lg overflow-hidden aspect-video group cursor-pointer select-none"
        onMouseEnter={() => setShowControls(true)}
        onMouseLeave={() => playing && setShowControls(false)}
        onClick={togglePlay}
      >
        <video
          ref={videoRef}
          src={src}
          poster={poster}
          autoPlay={autoPlay}
          muted={muted}
          onTimeUpdate={handleTimeUpdate}
          className="w-full h-full"
        />

        {/* Logo */}
        {settings.logo_url && (
          <img
            src={settings.logo_url}
            alt="Logo"
            className="absolute top-3 right-3 h-7 z-10 pointer-events-none"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        )}

        {/* Big play button */}
        {!playing && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ background: settings.play_bg_color }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill={settings.icon_color}>
                <polygon points="5,3 19,12 5,21" />
              </svg>
            </div>
          </div>
        )}

        {/* Subtitle overlay */}
        {currentSubtitle && (
          <div className="absolute bottom-14 left-0 right-0 flex justify-center pointer-events-none z-10">
            <span
              className="px-3 py-1 rounded text-sm font-medium"
              style={{
                background: "rgba(0,0,0,0.7)",
                color: "#fff",
                fontFamily: settings.font_family,
              }}
            >
              {currentSubtitle}
            </span>
          </div>
        )}

        {/* Control bar */}
        <div
          className="absolute bottom-0 left-0 right-0 flex items-center gap-2 px-3 py-2 transition-opacity duration-300 z-20"
          style={{
            background: settings.player_color,
            opacity: showControls ? 1 : 0,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Play/Pause */}
          <button onClick={togglePlay} className="shrink-0" style={{ color: settings.icon_color }}>
            {playing ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill={settings.icon_color}>
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill={settings.icon_color}>
                <polygon points="5,3 19,12 5,21" />
              </svg>
            )}
          </button>

          {/* Time */}
          <span className="text-xs min-w-[80px] shrink-0" style={{ color: settings.icon_color }}>
            {fmt(currentTime)} / {fmt(duration)}
          </span>

          {/* Progress bar */}
          <div
            className="flex-1 h-1 rounded-full cursor-pointer relative"
            style={{ background: "rgba(255,255,255,0.3)" }}
            onClick={handleSeek}
          >
            <div
              className="h-full rounded-full"
              style={{ width: `${progress}%`, background: settings.progress_color }}
            />
          </div>

          {/* Mute */}
          <button onClick={() => setMuted((m) => !m)} className="shrink-0">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke={settings.icon_color}
              strokeWidth="2"
            >
              <polygon points="11,5 6,9 2,9 2,15 6,15 11,19" />
              {!muted && <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />}
            </svg>
          </button>

          {/* Fullscreen */}
          <button onClick={toggleFullscreen} className="shrink-0">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke={settings.icon_color}
              strokeWidth="2"
            >
              <polyline points="15,3 21,3 21,9" />
              <polyline points="9,21 3,21 3,15" />
              <line x1="21" y1="3" x2="14" y2="10" />
              <line x1="3" y1="21" x2="10" y2="14" />
            </svg>
          </button>
        </div>
      </div>
    );
  }
);

BrandedVideoPlayer.displayName = "BrandedVideoPlayer";

export default BrandedVideoPlayer;
