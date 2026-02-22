import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
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
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(2)} GB`;
}

const VideoPlayer = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [video, setVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState(true);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

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

      const { data: urlData } = supabase.storage.from("videos").getPublicUrl(v.storage_path);
      setVideoUrl(urlData.publicUrl);

      // Increment plays
      await supabase.from("videos").update({ plays: v.plays + 1 }).eq("id", id);
      setLoading(false);
    };

    load();
  }, [id]);

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
    <div className="min-h-screen bg-black flex flex-col">
      <header className="flex items-center gap-3 p-4 bg-background border-b">
        <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0">
          <h1 className="font-semibold truncate">{video.title}</h1>
          <p className="text-xs text-muted-foreground">
            {formatSize(video.size)} · {new Date(video.created_at).toLocaleDateString("pl-PL")} · {video.plays + 1} odtworzeń
          </p>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center bg-black">
        <video
          src={videoUrl}
          controls
          autoPlay
          className="max-w-full max-h-[calc(100vh-80px)] w-full"
          poster={video.thumbnail_url || undefined}
        />
      </div>
    </div>
  );
};

export default VideoPlayer;
