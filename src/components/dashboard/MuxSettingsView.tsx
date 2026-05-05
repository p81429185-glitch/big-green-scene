import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, CheckCircle2, AlertCircle, ExternalLink, RefreshCw, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type MuxConnectionStatus = "unknown" | "not-configured" | "configured" | "connected";

interface Props {
  onConnectionStatusChange?: (status: MuxConnectionStatus) => void;
}

interface VideoRow {
  id: string;
  title: string;
  size: number;
  mux_status: string;
  mux_asset_id: string | null;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(2)} GB`;
}

const MuxSettingsView = ({ onConnectionStatusChange }: Props) => {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillResult, setBackfillResult] = useState<{ success: boolean; message: string } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string } | null>(null);
  const [videos, setVideos] = useState<VideoRow[]>([]);
  const [submittingIds, setSubmittingIds] = useState<Set<string>>(new Set());

  // Fetch all videos
  const fetchVideos = useCallback(async () => {
    const { data } = await supabase
      .from("videos")
      .select("id, title, size, mux_status, mux_asset_id")
      .order("created_at", { ascending: false });
    if (data) setVideos(data);
  }, []);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("mux-videos-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "videos" },
        (payload) => {
          if (payload.eventType === "DELETE") {
            setVideos((prev) => prev.filter((v) => v.id !== (payload.old as any).id));
          } else {
            const updated = payload.new as any;
            setVideos((prev) => {
              const idx = prev.findIndex((v) => v.id === updated.id);
              const row: VideoRow = {
                id: updated.id,
                title: updated.title,
                size: updated.size,
                mux_status: updated.mux_status,
                mux_asset_id: updated.mux_asset_id,
              };
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = row;
                return next;
              }
              return [row, ...prev];
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Stats derived from videos
  const readyCount = videos.filter((v) => v.mux_status === "ready").length;
  const totalCount = videos.length;

  const updateStatus = (status: MuxConnectionStatus) => {
    onConnectionStatusChange?.(status);
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("test-mux-connection");
      if (error) {
        setTestResult({ success: false, message: `Błąd: ${error.message}` });
        updateStatus("not-configured");
      } else if (data?.success) {
        setTestResult({ success: true, message: data.message });
        updateStatus("connected");
      } else {
        setTestResult({ success: false, message: data?.error || "Nieznany błąd" });
        updateStatus("configured");
      }
    } catch (err) {
      setTestResult({ success: false, message: String(err) });
      updateStatus("not-configured");
    } finally {
      setTesting(false);
    }
  };

  const handleBackfillAll = async () => {
    setBackfilling(true);
    setBackfillResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("submit-to-mux", {
        body: { backfill_all: true },
      });
      if (error) {
        setBackfillResult({ success: false, message: `Błąd: ${error.message}` });
      } else if (data?.success) {
        const msg = data.processed > 0
          ? `Wysłano ${data.processed} z ${data.total} filmów do Mux${data.errors > 0 ? ` (${data.errors} błędów)` : ""}`
          : "Brak filmów do przetworzenia — wszystkie są już w Mux";
        setBackfillResult({ success: true, message: msg });
      } else {
        setBackfillResult({ success: false, message: data?.error || "Nieznany błąd" });
      }
    } catch (err) {
      setBackfillResult({ success: false, message: String(err) });
    } finally {
      setBackfilling(false);
    }
  };

  const handleSyncStatuses = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("sync-mux-status", { body: {} });
      if (error) {
        setSyncResult({ success: false, message: `Błąd: ${error.message}` });
      } else {
        const ready = (data?.results || []).filter((r: any) => r.status === "ready").length;
        setSyncResult({
          success: true,
          message: `Sprawdzono ${data?.count ?? 0} filmów, gotowych: ${ready}`,
        });
        await fetchVideos();
      }
    } catch (err) {
      setSyncResult({ success: false, message: String(err) });
    } finally {
      setSyncing(false);
    }
  };

  const handleSubmitSingle = async (videoId: string) => {
    setSubmittingIds((prev) => new Set(prev).add(videoId));
    try {
      const { data, error } = await supabase.functions.invoke("submit-to-mux", {
        body: { video_id: videoId },
      });
      if (error || !data?.success) {
        toast.error(data?.error || error?.message || "Błąd wysyłania do Mux");
      } else {
        toast.success("Wysłano do Mux");
      }
    } catch (err) {
      toast.error(String(err));
    } finally {
      setSubmittingIds((prev) => {
        const next = new Set(prev);
        next.delete(videoId);
        return next;
      });
    }
  };

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mux-webhook`;

  const renderStatusBadge = (video: VideoRow) => {
    const status = video.mux_status;
    const hasAsset = !!video.mux_asset_id;
    const isSubmitting = submittingIds.has(video.id);

    if (status === "ready") {
      return <Badge className="bg-green-500/15 text-green-700 border-green-500/30 hover:bg-green-500/15">Gotowy ✓</Badge>;
    }
    if (status === "processing" || status === "preparing") {
      return (
        <Badge className="bg-yellow-500/15 text-yellow-700 border-yellow-500/30 hover:bg-yellow-500/15 animate-pulse">
          Przetwarzanie...
        </Badge>
      );
    }
    if (status === "error" || status === "errored") {
      return (
        <div className="flex items-center gap-2">
          <Badge variant="destructive">Błąd</Badge>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            disabled={isSubmitting}
            onClick={() => handleSubmitSingle(video.id)}
          >
            {isSubmitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
            Spróbuj ponownie
          </Button>
        </div>
      );
    }
    if (status === "pending" && hasAsset) {
      return <Badge variant="secondary">Oczekuje</Badge>;
    }
    // Not submitted
    return (
      <div className="flex items-center gap-2">
        <Badge variant="secondary">Nie wysłano</Badge>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          disabled={isSubmitting}
          onClick={() => handleSubmitSingle(video.id)}
        >
          {isSubmitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3 mr-1" />}
          Wyślij do Mux
        </Button>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Ustawienia Mux</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Mux automatycznie konwertuje filmy do formatu HLS, zapewniając natychmiastowe odtwarzanie bez problemów z buforowaniem.
        </p>
      </div>

      {/* Connection Test */}
      <Card className="p-6 space-y-4">
        <div>
          <h3 className="text-sm font-medium">Status połączenia</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Klucze API Mux (Token ID, Token Secret, Webhook Secret) są przechowywane bezpiecznie w ustawieniach projektu.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Button onClick={handleTestConnection} disabled={testing} variant="outline" size="sm">
            {testing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Testowanie...
              </>
            ) : (
              "Testuj połączenie"
            )}
          </Button>
          {testResult && (
            <div className={`flex items-center gap-2 text-sm ${testResult.success ? "text-primary" : "text-destructive"}`}>
              {testResult.success ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
              <span>{testResult.message}</span>
            </div>
          )}
        </div>
      </Card>

      {/* Webhook URL */}
      <Card className="p-6 space-y-4">
        <div>
          <h3 className="text-sm font-medium">Webhook URL</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Skopiuj ten adres i wklej go w ustawieniach webhooków w panelu Mux.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <code className="flex-1 bg-muted rounded-md px-3 py-2 text-xs font-mono break-all select-all">
            {webhookUrl}
          </code>
          <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(webhookUrl)}>
            Kopiuj
          </Button>
        </div>
        <a
          href="https://dashboard.mux.com/settings/webhooks"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Otwórz ustawienia webhooków Mux
        </a>
      </Card>

      {/* Backfill */}
      <Card className="p-6 space-y-4">
        <div>
          <h3 className="text-sm font-medium">Przetwarzanie istniejących filmów</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Wyślij wszystkie filmy, które nie zostały jeszcze przetworzone przez Mux, do transkodowania HLS.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Button onClick={handleBackfillAll} disabled={backfilling} variant="outline" size="sm">
            {backfilling ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Przetwarzanie...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Przetwórz wszystkie filmy przez Mux
              </>
            )}
          </Button>
          {backfillResult && (
            <div className={`flex items-center gap-2 text-sm ${backfillResult.success ? "text-primary" : "text-destructive"}`}>
              {backfillResult.success ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
              <span>{backfillResult.message}</span>
            </div>
          )}
        </div>
      </Card>

      {/* Real-time Video Status Table */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Status filmów</h3>
          <span className="text-sm text-muted-foreground">
            {readyCount} / {totalCount} filmów gotowych przez Mux
          </span>
        </div>

        <div className="rounded-md border overflow-auto max-h-[500px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tytuł</TableHead>
                <TableHead className="w-[100px]">Rozmiar</TableHead>
                <TableHead className="w-[100px]">mux_status</TableHead>
                <TableHead className="w-[220px]">Akcja</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {videos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    Brak filmów w bazie
                  </TableCell>
                </TableRow>
              ) : (
                videos.map((video) => (
                  <TableRow key={video.id}>
                    <TableCell className="font-medium max-w-[300px] truncate">{video.title}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{formatSize(video.size)}</TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{video.mux_status}</code>
                    </TableCell>
                    <TableCell>{renderStatusBadge(video)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* How it works */}
      <Card className="p-6 space-y-3">
        <h3 className="text-sm font-medium">Jak to działa</h3>
        <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
          <li>Po przesłaniu filmu, system automatycznie wysyła go do Mux</li>
          <li>Mux konwertuje film do formatu HLS (adaptacyjne streamowanie)</li>
          <li>Po zakończeniu konwersji (~2-5 min), odtwarzacz automatycznie przełącza się na HLS</li>
          <li>Filmy HLS ładują się natychmiastowo, bez problemów z atomem moov</li>
        </ol>
      </Card>
    </div>
  );
};

export default MuxSettingsView;
