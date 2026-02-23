import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import BrandedVideoPlayer, { BrandedVideoPlayerHandle } from "@/components/video/BrandedVideoPlayer";
import {
  ArrowLeft, HardDrive, Calendar, Play, MoreHorizontal, Code, Share2,
  Scissors, Settings, BarChart3, Pencil, FileVideo, MessageSquare,
  FileText, ExternalLink, BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import EmbedDialog from "@/components/dashboard/EmbedDialog";
import ChaptersTab from "@/components/video/ChaptersTab";
import TranscriptionTab from "@/components/video/TranscriptionTab";
import VideoCustomizeTab from "@/components/video/VideoCustomizeTab";
import VideoAnalyticsTab from "@/components/video/VideoAnalyticsTab";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

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
            <BrandedVideoPlayer
              ref={playerRef}
              src={videoUrl}
              poster={video.thumbnail_url || undefined}
              subtitlesSrt={subtitlesSrt}
              videoId={id}
              autoPlay
            />
            <Button variant="outline" className="w-full mt-3" asChild>
              <a href="https://notebooklm.google.com/" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-1.5" />
                Otwórz w NotebookLM
              </a>
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
        thumbnailUrl={video.thumbnail_url}
        transcription={transcription}
      />
    </div>
  );
};

export default VideoPlayer;
