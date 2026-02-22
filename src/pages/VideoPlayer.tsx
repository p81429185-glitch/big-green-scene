import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft,
  HardDrive,
  Calendar,
  Play,
  MoreHorizontal,
  Code,
  Share2,
  Scissors,
  Settings,
  BarChart3,
  Pencil,
  FileVideo,
  MessageSquare,
  FileText,
  Loader2,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import EmbedDialog from "@/components/dashboard/EmbedDialog";
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

const actionTabs = [
  { icon: Pencil, label: "Edytuj" },
  { icon: Settings, label: "Dostosuj" },
  { icon: BarChart3, label: "Analityka" },
  { icon: Scissors, label: "Klipy" },
];

const VideoPlayer = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [video, setVideo] = useState<Video | null>(null);
  const [folder, setFolder] = useState<Folder | null>(null);
  const [loading, setLoading] = useState(true);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [embedOpen, setEmbedOpen] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [transcription, setTranscription] = useState<string | null>(null);

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

  const handleTranscribe = async () => {
    if (!id) return;
    setTranscribing(true);
    try {
      const { data, error } = await supabase.functions.invoke("transcribe-video", {
        body: { videoId: id },
      });

      if (error) throw error;

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      setTranscription(data.transcription);
      toast.success("Transkrypcja zakończona");
    } catch (e: any) {
      console.error("Transcription error:", e);
      toast.error("Błąd podczas transkrypcji");
    } finally {
      setTranscribing(false);
    }
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
          {actionTabs.map(({ icon: Icon, label }) => (
            <button
              key={label}
              onClick={() => toast.info("Wkrótce dostępne")}
              className="flex items-center gap-1.5 px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded-t-md transition-colors"
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: video player */}
          <div className="lg:col-span-2">
            <div className="rounded-lg overflow-hidden shadow-lg bg-black aspect-video">
              <video
                src={videoUrl}
                controls
                autoPlay
                className="w-full h-full"
                poster={video.thumbnail_url || undefined}
              />
            </div>
            <Button
              variant="outline"
              className="w-full mt-3"
              asChild
            >
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
                  <TabsTrigger value="details" className="flex-1">Szczegóły</TabsTrigger>
                  <TabsTrigger value="transcription" className="flex-1">
                    <FileText className="h-3.5 w-3.5 mr-1" />
                    Transkrypcja
                  </TabsTrigger>
                  <TabsTrigger value="comments" className="flex-1">Komentarze</TabsTrigger>
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

                <TabsContent value="transcription" className="flex-1 p-4">
                  {transcribing ? (
                    <div className="flex flex-col items-center justify-center h-32 gap-3">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <p className="text-sm text-muted-foreground">Trwa transkrypcja...</p>
                      <p className="text-xs text-muted-foreground">To może potrwać do 60 sekund</p>
                    </div>
                  ) : transcription ? (
                    <div className="space-y-3">
                      <ScrollArea className="h-[300px]">
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{transcription}</p>
                      </ScrollArea>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleTranscribe}
                        className="w-full"
                      >
                        <RefreshCw className="h-4 w-4 mr-1.5" />
                        Transkrybuj ponownie
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-32 gap-3">
                      <FileText className="h-8 w-8 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Brak transkrypcji</p>
                      <Button size="sm" onClick={handleTranscribe}>
                        <FileText className="h-4 w-4 mr-1.5" />
                        Transkrybuj
                      </Button>
                    </div>
                  )}
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

      {/* Embed dialog */}
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
