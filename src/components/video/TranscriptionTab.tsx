import { useState } from "react";
import { FileText, Loader2, RefreshCw, Download, Subtitles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TranscriptionTabProps {
  videoId: string;
  transcription: string | null;
  onTranscriptionChange: (t: string) => void;
  subtitlesSrt: string | null;
  onSubtitlesChange: (srt: string) => void;
}

const TranscriptionTab = ({
  videoId,
  transcription,
  onTranscriptionChange,
  subtitlesSrt,
  onSubtitlesChange,
}: TranscriptionTabProps) => {
  const [transcribing, setTranscribing] = useState(false);
  const [generatingSrt, setGeneratingSrt] = useState(false);

  const handleTranscribe = async () => {
    setTranscribing(true);
    try {
      const { data, error } = await supabase.functions.invoke("transcribe-video", {
        body: { videoId },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      onTranscriptionChange(data.transcription);
      toast.success("Transkrypcja zakończona");
    } catch {
      toast.error("Błąd podczas transkrypcji");
    } finally {
      setTranscribing(false);
    }
  };

  const handleGenerateSrt = async () => {
    setGeneratingSrt(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-subtitles", {
        body: { videoId },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      onSubtitlesChange(data.srt);
      toast.success("Napisy SRT wygenerowane");
    } catch {
      toast.error("Błąd generowania napisów");
    } finally {
      setGeneratingSrt(false);
    }
  };

  const downloadSrt = () => {
    if (!subtitlesSrt) return;
    const blob = new Blob([subtitlesSrt], { type: "text/srt" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "subtitles.srt";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (transcribing) {
    return (
      <div className="flex flex-col items-center justify-center h-32 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Trwa transkrypcja...</p>
        <p className="text-xs text-muted-foreground">To może potrwać do 60 sekund</p>
      </div>
    );
  }

  if (!transcription) {
    return (
      <div className="flex flex-col items-center justify-center h-32 gap-3">
        <FileText className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Brak transkrypcji</p>
        <Button size="sm" onClick={handleTranscribe}>
          <FileText className="h-4 w-4 mr-1.5" />
          Transkrybuj
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <ScrollArea className="h-[220px]">
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{transcription}</p>
      </ScrollArea>

      <div className="space-y-2">
        <Button variant="outline" size="sm" onClick={handleTranscribe} className="w-full">
          <RefreshCw className="h-4 w-4 mr-1.5" />
          Transkrybuj ponownie
        </Button>

        {generatingSrt ? (
          <Button variant="outline" size="sm" className="w-full" disabled>
            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            Generowanie napisów...
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={handleGenerateSrt} className="w-full">
            <Subtitles className="h-4 w-4 mr-1.5" />
            Generuj napisy (SRT)
          </Button>
        )}

        {subtitlesSrt && (
          <Button variant="outline" size="sm" onClick={downloadSrt} className="w-full">
            <Download className="h-4 w-4 mr-1.5" />
            Pobierz SRT
          </Button>
        )}
      </div>
    </div>
  );
};

export default TranscriptionTab;
