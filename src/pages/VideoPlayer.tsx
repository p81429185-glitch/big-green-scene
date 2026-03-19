import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import Hls from "hls.js";
import BrandedVideoPlayer, { BrandedVideoPlayerHandle } from "@/components/video/BrandedVideoPlayer";
import {
  ArrowLeft, HardDrive, Calendar, Play, MoreHorizontal, Code, Share2,
  Scissors, Settings, BarChart3, Pencil, FileVideo, MessageSquare,
  FileText, ExternalLink, BookOpen, Loader2, RefreshCw, Music,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import EmbedDialog from "@/components/dashboard/EmbedDialog";
import ChaptersTab from "@/components/video/ChaptersTab";
import TranscriptionTab from "@/components/video/TranscriptionTab";
import VideoCustomizeTab from "@/components/video/VideoCustomizeTab";
import VideoAnalyticsTab from "@/components/video/VideoAnalyticsTab";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useFFmpegConvert } from "@/hooks/useFFmpegConvert";

interface Video {
  id: string;
  title: string;
  file_name: string;
  size: number;
  storage_path: string;
  thumbnail_url: string | null;
  plays: number;
  created_at: string;
  folder_id: string | null;
  transcription: string | null;
  is_processed: boolean;
  processing_status: string;
  mux_asset_id: string | null;
  mux_playback_id: string | null;
  mux_status: string;
}

interface Folder {
  id: string;
  name: string;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(2)} GB`;
}

type ActionTabId = "edytuj" | "dostosuj" | "analityka" | "klipy";

const actionTabs: { icon: typeof Pencil; label: string; id: ActionTabId }[] = [
  { icon: Pencil, label: "Edytuj", id: "edytuj" },
  { icon: Settings, label: "Dostosuj", id: "dostosuj" },
  { icon: BarChart3, label: "Analityka", id: "analityka" },
  { icon: Scissors, label: "Klipy", id: "klipy" },
];

// Video loading wrapper with progress, timeout detection, and non-blocking processing banner
interface VideoLoadingWrapperProps {
  src: string;
  poster?: string;
  subtitlesSrt: string | null;
  videoId: string;
  playerRef: React.RefObject<BrandedVideoPlayerHandle>;
  isProcessed: boolean;
  fileSize: number;
  muxStatus: string;
  muxPlaybackId: string | null;
}

const VideoLoadingWrapper = ({ src, poster, subtitlesSrt, videoId, playerRef, isProcessed, fileSize, muxStatus, muxPlaybackId }: VideoLoadingWrapperProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const [loadTimeout, setLoadTimeout] = useState(false);
  const [progress, setProgress] = useState(0);
  const [retryKey, setRetryKey] = useState(0);
  const [showProcessingBanner, setShowProcessingBanner] = useState(false);
  const [showProcessingOverlay, setShowProcessingOverlay] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [canPlayFired, setCanPlayFired] = useState(false);
  const [isStalled, setIsStalled] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const progressRef = useRef<NodeJS.Timeout | null>(null);
  const processingDelayRef = useRef<NodeJS.Timeout | null>(null);
  const bufferTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearBufferTimeout = useCallback(() => {
    if (bufferTimeoutRef.current) {
      clearTimeout(bufferTimeoutRef.current);
      bufferTimeoutRef.current = null;
    }
  }, []);

  const handleCanPlay = useCallback(() => {
    setIsLoading(false);
    setLoadTimeout(false);
    setProgress(100);
    setShowProcessingBanner(false);
    setShowProcessingOverlay(false);
    setCanPlayFired(true);
    setVideoError(false);
    setIsBuffering(false);
    setIsStalled(false);
    clearBufferTimeout();
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (progressRef.current) clearInterval(progressRef.current);
    if (processingDelayRef.current) clearTimeout(processingDelayRef.current);
  }, [clearBufferTimeout]);

  const handleError = useCallback(() => {
    if (!isProcessed) {
      setVideoError(true);
      setIsLoading(false);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (progressRef.current) clearInterval(progressRef.current);
    }
  }, [isProcessed]);

  const handleRetry = useCallback(() => {
    setIsLoading(true);
    setLoadTimeout(false);
    setVideoError(false);
    setIsBuffering(false);
    setIsStalled(false);
    setShowProcessingOverlay(false);
    setCanPlayFired(false);
    setProgress(0);
    clearBufferTimeout();
    setRetryKey(prev => prev + 1);
  }, [clearBufferTimeout]);

  const handleManualRetry = useCallback(() => {
    setIsStalled(false);
    setIsBuffering(false);
    playerRef.current?.reload();
  }, [playerRef]);

  const handleWaiting = useCallback(() => {
    clearBufferTimeout();
    bufferTimeoutRef.current = setTimeout(() => {
      setIsBuffering(true);
    }, 3000);
  }, [clearBufferTimeout]);

  const handlePlaying = useCallback(() => {
    clearBufferTimeout();
    setIsBuffering(false);
    setIsStalled(false);
  }, [clearBufferTimeout]);

  const handleStalled = useCallback(() => {
    setIsStalled(true);
    setIsBuffering(true);
  }, []);

  const handleProgressResume = useCallback(() => {
    setIsStalled(false);
    setIsBuffering(false);
  }, []);

  // Delayed processing overlay — only show after 10s if canplay hasn't fired and not processed
  useEffect(() => {
    if (processingDelayRef.current) clearTimeout(processingDelayRef.current);

    if (!isProcessed && !canPlayFired) {
      processingDelayRef.current = setTimeout(() => {
        setShowProcessingOverlay(true);
        // Also show the banner
        setShowProcessingBanner(true);
      }, 10000);
    } else {
      setShowProcessingOverlay(false);
      setShowProcessingBanner(false);
    }

    return () => {
      if (processingDelayRef.current) clearTimeout(processingDelayRef.current);
    };
  }, [isProcessed, canPlayFired, retryKey]);

  // Update when isProcessed changes (via realtime)
  useEffect(() => {
    if (isProcessed) {
      setShowProcessingBanner(false);
      setShowProcessingOverlay(false);
      if (processingDelayRef.current) clearTimeout(processingDelayRef.current);
      if (videoError) {
        handleRetry();
      }
    }
  }, [isProcessed, videoError, handleRetry]);

  useEffect(() => {
    setIsLoading(true);
    setLoadTimeout(false);
    setVideoError(false);
    setProgress(0);

    progressRef.current = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) return prev;
        return prev + Math.random() * 10;
      });
    }, 500);

    timeoutRef.current = setTimeout(() => {
      setLoadTimeout(true);
      if (progressRef.current) clearInterval(progressRef.current);
    }, 15000);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (progressRef.current) clearInterval(progressRef.current);
    };
  }, [src, retryKey]);

  // Full-screen processing overlay — only after 10s delay OR video error + not processed
  if (showProcessingOverlay && videoError && !isProcessed) {
    return (
      <div className="aspect-video bg-muted rounded-lg flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <div className="text-center">
          <p className="text-lg font-medium">Film jest przetwarzany...</p>
          <p className="text-sm text-muted-foreground mt-1">
            Optymalizacja do szybkiego odtwarzania. Strona odświeży się automatycznie.
          </p>
        </div>
        <Button onClick={handleRetry} variant="outline" className="mt-2">
          <RefreshCw className="h-4 w-4 mr-2" />
          Spróbuj ponownie
        </Button>
      </div>
    );
  }

  const fileSizeMB = Math.round(fileSize / (1024 * 1024));

  return (
    <div>
      {/* Persistent banner ABOVE player for unprocessed files */}
      {!isProcessed && (
        <div className="mb-2 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs font-medium text-center py-2 px-3">
          Ten film nie jest zoptymalizowany — pierwsze odtworzenie może wymagać pobrania całego pliku (~{fileSizeMB}MB)
        </div>
      )}

      <div className="relative">
        {/* Non-blocking amber processing banner */}
        {showProcessingBanner && (
          <div className="absolute top-0 left-0 right-0 z-20 bg-amber-500/90 text-amber-950 text-xs font-medium text-center py-1 px-2 rounded-t-lg pointer-events-none">
            Ten film nie jest jeszcze zoptymalizowany — ładowanie może potrwać do 2 minut przy pierwszym uruchomieniu
          </div>
        )}

        {/* Buffering bar — slim YouTube-style top bar */}
        {isBuffering && !isLoading && (
          <div className="absolute top-0 left-0 right-0 z-10 h-[3px] pointer-events-none overflow-hidden rounded-t-lg">
            <div className="h-full w-1/3 bg-primary animate-[bufferSlide_1.5s_ease-in-out_infinite] rounded-full" />
          </div>
        )}

        {/* Show poster/loading overlay while video loads */}
        {isLoading && (
          <div 
            className="absolute inset-0 z-10 bg-muted rounded-lg flex flex-col items-center justify-center gap-4"
            style={poster ? { backgroundImage: `url(${poster})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
          >
            <div className={`flex flex-col items-center justify-center gap-4 w-full h-full ${poster ? 'bg-black/60' : ''} rounded-lg p-6`}>
              {loadTimeout ? (
                <>
                  <div className="text-center">
                    <p className="text-lg font-medium text-foreground">
                      Ładowanie trwa dłużej niż zwykle
                    </p>
                    <p className="text-sm text-muted-foreground mt-2 max-w-md">
                      Plik może być wciąż przetwarzany lub jest bardzo duży. Spróbuj ponownie za chwilę.
                    </p>
                  </div>
                  <Button onClick={handleRetry} variant="outline" className="mt-2">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Spróbuj ponownie
                  </Button>
                </>
              ) : (
                <>
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  <div className="text-center">
                    <p className="text-sm font-medium text-foreground">Ładowanie wideo...</p>
                  </div>
                  <div className="w-48">
                    <Progress value={progress} className="h-1.5" />
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Actual video player - always rendered but hidden during loading */}
        <div className={isLoading ? 'invisible' : 'visible'}>
          <BrandedVideoPlayer
            key={retryKey}
            ref={playerRef}
            src={src}
            subtitlesSrt={subtitlesSrt}
            videoId={videoId}
            onCanPlay={handleCanPlay}
            onError={handleError}
            onWaiting={handleWaiting}
            onPlaying={handlePlaying}
            onStalled={handleStalled}
            onProgressResume={handleProgressResume}
          />
        </div>
      </div>

      {/* Stall message BELOW the player */}
      {isStalled && !isLoading && (
        <div className="mt-2 flex items-center justify-between gap-3 rounded-lg bg-muted border border-border px-4 py-3">
          <p className="text-sm text-muted-foreground">
            Film ładuje się — to może potrwać chwilę przy pierwszym odtwarzaniu
          </p>
          <Button onClick={handleManualRetry} variant="outline" size="sm" className="shrink-0">
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Spróbuj ponownie
          </Button>
        </div>
      )}
    </div>
  );
};

const VideoPlayer = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const playerRef = useRef<BrandedVideoPlayerHandle>(null);
  const [video, setVideo] = useState<Video | null>(null);
  const [folder, setFolder] = useState<Folder | null>(null);
  const [loading, setLoading] = useState(true);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [embedOpen, setEmbedOpen] = useState(false);
  const [transcription, setTranscription] = useState<string | null>(null);
  const [subtitlesSrt, setSubtitlesSrt] = useState<string | null>(null);
  const [activeActionTab, setActiveActionTab] = useState<ActionTabId | null>(null);
  const { convertToMp3, progress, isConverting } = useFFmpegConvert();

  useEffect(() => {
    if (!id) return;

    const load = async () => {
      const { data, error } = await supabase
        .from("videos")
        .select("*")
        .eq("id", id)
        .single();

      if (error || !data) {
        setLoading(false);
        return;
      }

      const v = data as Video;
      setVideo(v);
      setTranscription(v.transcription ?? null);
      setSubtitlesSrt((data as any).subtitles_srt ?? null);

      if (v.folder_id) {
        const { data: folderData } = await supabase
          .from("folders")
          .select("id, name")
          .eq("id", v.folder_id)
          .single();
        if (folderData) setFolder(folderData as Folder);
      }

      const { data: urlData } = supabase.storage.from("videos").getPublicUrl(v.storage_path);
      setVideoUrl(urlData.publicUrl);

      await supabase.from("videos").update({ plays: v.plays + 1 }).eq("id", id);
      setLoading(false);
    };

    load();
  }, [id]);

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Link skopiowany do schowka");
  };

  const handleSeek = (seconds: number) => {
    playerRef.current?.seek(seconds);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Ładowanie...</div>
      </div>
    );
  }

  if (!video || !videoUrl) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <p className="text-muted-foreground">Film nie został znaleziony</p>
        <Button variant="outline" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Wróć do panelu
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
        {/* Breadcrumb */}
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/dashboard">Biblioteka</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            {folder && (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link to="/dashboard">{folder.name}</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
              </>
            )}
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{video.title}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Header row */}
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-bold tracking-tight truncate">{video.title}</h1>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-5 w-5" />
            </Button>
            <Button variant="default" size="sm" onClick={() => setEmbedOpen(true)}>
              <Code className="h-4 w-4 mr-1.5" />
              Osadź
            </Button>
            <Button variant="default" size="sm" onClick={handleShare}>
              <Share2 className="h-4 w-4 mr-1.5" />
              Udostępnij
            </Button>
          </div>
        </div>

        {/* Action tabs row */}
        <div className="flex items-center gap-1 border-b border-border">
          {actionTabs.map(({ icon: Icon, label, id }) => (
            <button
              key={id}
              onClick={() => {
                if (id === "edytuj" || id === "klipy") {
                  toast.info("Wkrótce dostępne");
                } else {
                  setActiveActionTab(activeActionTab === id ? null : id);
                }
              }}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-sm transition-colors rounded-t-md ${
                activeActionTab === id
                  ? "text-foreground border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Active tab content */}
        {activeActionTab === "dostosuj" && <VideoCustomizeTab />}
        {activeActionTab === "analityka" && video && id && (
          <VideoAnalyticsTab videoId={id} video={video} />
        )}

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: video player */}
          <div className="lg:col-span-2">
            <VideoLoadingWrapper
              src={videoUrl}
              poster={video.thumbnail_url || undefined}
              subtitlesSrt={subtitlesSrt}
              videoId={id}
              playerRef={playerRef}
              isProcessed={video.is_processed}
              fileSize={video.size}
            />
            <Button variant="outline" className="w-full mt-3" asChild>
              <a href="https://notebooklm.google.com/" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-1.5" />
                Otwórz w NotebookLM
              </a>
            </Button>
            <Button
              variant="outline"
              className="w-full mt-2"
              disabled={isConverting}
              onClick={() => convertToMp3(videoUrl, video.file_name.replace(/\.[^.]+$/, ".mp3"))}
            >
              {isConverting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {progress > 0 ? `Konwertowanie... ${progress}%` : "Ładowanie konwertera..."}
                </>
              ) : (
                <>
                  <Music className="w-4 h-4 mr-2" />
                  Pobierz MP3
                </>
              )}
            </Button>
          </div>

          {/* Right: sidebar panel */}
          <div className="lg:col-span-1">
            <Card className="h-full">
              <Tabs defaultValue="details" className="h-full flex flex-col">
                <TabsList className="w-full rounded-none border-b border-border bg-transparent px-2 pt-2">
                  <TabsTrigger value="details" className="flex-1 text-xs">Szczegóły</TabsTrigger>
                  <TabsTrigger value="chapters" className="flex-1 text-xs">
                    <BookOpen className="h-3.5 w-3.5 mr-1" />
                    Rozdziały
                  </TabsTrigger>
                  <TabsTrigger value="transcription" className="flex-1 text-xs">
                    <FileText className="h-3.5 w-3.5 mr-1" />
                    Transkrypcja
                  </TabsTrigger>
                  <TabsTrigger value="comments" className="flex-1 text-xs">Komentarze</TabsTrigger>
                </TabsList>

                <TabsContent value="details" className="flex-1 p-4 space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <HardDrive className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">Rozmiar</p>
                        <p className="text-sm font-medium">{formatSize(video.size)}</p>
                      </div>
                    </div>
                    <Separator />
                    <div className="flex items-center gap-3">
                      <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">Data dodania</p>
                        <p className="text-sm font-medium">
                          {new Date(video.created_at).toLocaleDateString("pl-PL")}
                        </p>
                      </div>
                    </div>
                    <Separator />
                    <div className="flex items-center gap-3">
                      <Play className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">Odtworzenia</p>
                        <p className="text-sm font-medium">{video.plays + 1}</p>
                      </div>
                    </div>
                    <Separator />
                    <div className="flex items-center gap-3">
                      <FileVideo className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">Nazwa pliku</p>
                        <p className="text-sm font-medium truncate">{video.file_name}</p>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="chapters" className="flex-1 p-4">
                  <ChaptersTab videoId={video.id} onSeek={handleSeek} />
                </TabsContent>

                <TabsContent value="transcription" className="flex-1 p-4">
                  <TranscriptionTab
                    videoId={video.id}
                    transcription={transcription}
                    onTranscriptionChange={setTranscription}
                    subtitlesSrt={subtitlesSrt}
                    onSubtitlesChange={setSubtitlesSrt}
                  />
                </TabsContent>

                <TabsContent value="comments" className="flex-1 p-4">
                  <div className="flex flex-col items-center justify-center h-32 text-muted-foreground gap-2">
                    <MessageSquare className="h-8 w-8" />
                    <p className="text-sm">Brak komentarzy</p>
                  </div>
                </TabsContent>
              </Tabs>
            </Card>
          </div>
        </div>
      </div>

      <EmbedDialog
        open={embedOpen}
        onOpenChange={setEmbedOpen}
        videoUrl={videoUrl}
        videoId={video.id}
        thumbnailUrl={video.thumbnail_url}
        transcription={transcription}
        storage_path={video.storage_path}
      />
    </div>
  );
};

export default VideoPlayer;
