import { useState, useRef } from "react";
import { FileText, Loader2, RefreshCw, Download, Subtitles, Upload, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
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
  const [editingSrt, setEditingSrt] = useState(false);
  const [srtDraft, setSrtDraft] = useState("");
  const [savingSrt, setSavingSrt] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const saveSrtToDb = async (srtContent: string) => {
    setSavingSrt(true);
    try {
      const { error } = await supabase
        .from("videos")
        .update({ subtitles_srt: srtContent })
        .eq("id", videoId);
      if (error) throw error;
      onSubtitlesChange(srtContent);
      toast.success("Napisy zapisane");
    } catch {
      toast.error("Błąd zapisu napisów");
    } finally {
      setSavingSrt(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      if (content) saveSrtToDb(content);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleSaveDraft = () => {
    if (srtDraft.trim()) {
      saveSrtToDb(srtDraft.trim());
      setEditingSrt(false);
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
        {/* SRT upload even without transcription */}
        <input ref={fileInputRef} type="file" accept=".srt" className="hidden" onChange={handleFileUpload} />
        <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
          <Upload className="h-4 w-4 mr-1.5" />
          Wgraj plik SRT
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <ScrollArea className="h-[180px]">
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

        {/* Upload SRT file */}
        <input ref={fileInputRef} type="file" accept=".srt" className="hidden" onChange={handleFileUpload} />
        <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="w-full">
          <Upload className="h-4 w-4 mr-1.5" />
          Wgraj plik SRT
        </Button>

        {/* Manual SRT paste / edit */}
        {editingSrt ? (
          <div className="space-y-2">
            <Textarea
              value={srtDraft}
              onChange={(e) => setSrtDraft(e.target.value)}
              placeholder={"1\n00:00:01,000 --> 00:00:04,000\nTekst napisu..."}
              className="text-xs font-mono h-[120px]"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSaveDraft} disabled={savingSrt} className="flex-1">
                {savingSrt ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
                Zapisz
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditingSrt(false)} className="flex-1">
                Anuluj
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setSrtDraft(subtitlesSrt || ""); setEditingSrt(true); }}
            className="w-full"
          >
            <Subtitles className="h-4 w-4 mr-1.5" />
            {subtitlesSrt ? "Edytuj napisy SRT" : "Wklej napisy SRT"}
          </Button>
        )}

        {/* Show existing SRT & download */}
        {subtitlesSrt && !editingSrt && (
          <>
            <ScrollArea className="h-[100px] border rounded-md p-2">
              <pre className="text-xs font-mono whitespace-pre-wrap text-muted-foreground">{subtitlesSrt}</pre>
            </ScrollArea>
            <Button variant="outline" size="sm" onClick={downloadSrt} className="w-full">
              <Download className="h-4 w-4 mr-1.5" />
              Pobierz SRT
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default TranscriptionTab;
