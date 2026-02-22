import { useState, useEffect } from "react";
import { Plus, Trash2, BookOpen, ClipboardPaste } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Chapter {
  id: string;
  title: string;
  timestamp_seconds: number;
}

interface ChaptersTabProps {
  videoId: string;
  onSeek: (seconds: number) => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function parseTime(value: string): number | null {
  const parts = value.split(":");
  if (parts.length !== 2) return null;
  const m = parseInt(parts[0], 10);
  const s = parseInt(parts[1], 10);
  if (isNaN(m) || isNaN(s) || s < 0 || s > 59 || m < 0) return null;
  return m * 60 + s;
}

function parseBulkChapters(text: string): { timestamp_seconds: number; title: string }[] {
  const lines = text.split("\n").filter((l) => l.trim());
  const results: { timestamp_seconds: number; title: string }[] = [];
  for (const line of lines) {
    // Match HH:MM:SS or MM:SS or M:SS at the start
    const match = line.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*[-–—]?\s*(.+)/);
    if (!match) continue;
    let seconds: number;
    if (match[3] !== undefined) {
      // HH:MM:SS
      seconds = parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseInt(match[3]);
    } else {
      // MM:SS
      seconds = parseInt(match[1]) * 60 + parseInt(match[2]);
    }
    const title = match[4].trim();
    if (title) results.push({ timestamp_seconds: seconds, title });
  }
  return results;
}

const ChaptersTab = ({ videoId, onSeek }: ChaptersTabProps) => {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("");
  const [loading, setLoading] = useState(true);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState("");

  const loadChapters = async () => {
    const { data } = await supabase
      .from("video_chapters")
      .select("id, title, timestamp_seconds")
      .eq("video_id", videoId)
      .order("timestamp_seconds", { ascending: true });
    if (data) setChapters(data);
    setLoading(false);
  };

  useEffect(() => {
    loadChapters();
  }, [videoId]);

  const addChapter = async () => {
    const seconds = parseTime(time);
    if (!title.trim()) {
      toast.error("Wpisz tytuł rozdziału");
      return;
    }
    if (seconds === null) {
      toast.error("Podaj czas w formacie M:SS");
      return;
    }

    const { error } = await supabase.from("video_chapters").insert({
      video_id: videoId,
      title: title.trim(),
      timestamp_seconds: seconds,
    });

    if (error) {
      toast.error("Błąd dodawania rozdziału");
      return;
    }

    setTitle("");
    setTime("");
    loadChapters();
    toast.success("Rozdział dodany");
  };

  const deleteChapter = async (id: string) => {
    await supabase.from("video_chapters").delete().eq("id", id);
    loadChapters();
  };

  if (loading) {
    return <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">Ładowanie...</div>;
  }

  const parsedBulk = bulkMode ? parseBulkChapters(bulkText) : [];

  const importBulk = async () => {
    if (parsedBulk.length === 0) {
      toast.error("Nie znaleziono rozdziałów do importu");
      return;
    }
    const rows = parsedBulk.map((ch) => ({ video_id: videoId, ...ch }));
    const { error } = await supabase.from("video_chapters").insert(rows);
    if (error) {
      toast.error("Błąd importu rozdziałów");
      return;
    }
    setBulkText("");
    setBulkMode(false);
    loadChapters();
    toast.success(`Zaimportowano ${parsedBulk.length} rozdziałów`);
  };

  return (
    <div className="space-y-4">
      {/* Add chapter form */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Nowy rozdział</Label>
          <Button variant="ghost" size="sm" onClick={() => setBulkMode((v) => !v)}>
            <ClipboardPaste className="h-4 w-4 mr-1" />
            {bulkMode ? "Pojedynczo" : "Wklej rozdziały"}
          </Button>
        </div>

        {bulkMode ? (
          <div className="space-y-2">
            <Textarea
              placeholder={"00:00 Wstęp\n03:20 Pierwsze informacje\n15:45 Podsumowanie"}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              rows={6}
            />
            {bulkText && (
              <p className="text-xs text-muted-foreground">
                Znaleziono {parsedBulk.length} rozdziałów
              </p>
            )}
            <Button onClick={importBulk} disabled={parsedBulk.length === 0} className="w-full">
              Importuj {parsedBulk.length > 0 ? `(${parsedBulk.length})` : ""}
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Input
              placeholder="Tytuł"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="flex-1"
            />
            <Input
              placeholder="0:00"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-20"
            />
            <Button size="icon" onClick={addChapter}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <Separator />

      {/* Chapters list */}
      {chapters.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-24 text-muted-foreground gap-2">
          <BookOpen className="h-8 w-8" />
          <p className="text-sm">Brak rozdziałów</p>
        </div>
      ) : (
        <ScrollArea className="h-[250px]">
          <div className="space-y-1">
            {chapters.map((ch) => (
              <div
                key={ch.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent cursor-pointer group"
                onClick={() => onSeek(ch.timestamp_seconds)}
              >
                <span className="text-xs font-mono text-primary w-10 shrink-0">
                  {formatTime(ch.timestamp_seconds)}
                </span>
                <span className="text-sm flex-1 truncate">{ch.title}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteChapter(ch.id);
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
};

export default ChaptersTab;
