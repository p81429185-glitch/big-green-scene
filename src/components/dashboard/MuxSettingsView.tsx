import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, AlertCircle, ExternalLink, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export type MuxConnectionStatus = "unknown" | "not-configured" | "configured" | "connected";

interface Props {
  onConnectionStatusChange?: (status: MuxConnectionStatus) => void;
}

interface VideoStats {
  ready: number;
  pending: number;
  error: number;
  total: number;
}

const MuxSettingsView = ({ onConnectionStatusChange }: Props) => {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillResult, setBackfillResult] = useState<{ success: boolean; message: string } | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<MuxConnectionStatus>("unknown");
  const [videoStats, setVideoStats] = useState<VideoStats>({ ready: 0, pending: 0, error: 0, total: 0 });

  // Fetch video stats
  useEffect(() => {
    const fetchStats = async () => {
      const { data } = await supabase.from("videos").select("mux_status");
      if (!data) return;
      const stats: VideoStats = { ready: 0, pending: 0, error: 0, total: data.length };
      data.forEach((v) => {
        if (v.mux_status === "ready") stats.ready++;
        else if (v.mux_status === "error" || v.mux_status === "errored") stats.error++;
        else stats.pending++;
      });
      setVideoStats(stats);
    };
    fetchStats();
  }, [backfillResult]);

  const updateStatus = (status: MuxConnectionStatus) => {
    setConnectionStatus(status);
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

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mux-webhook`;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Ustawienia Mux</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Mux automatycznie konwertuje filmy do formatu HLS, zapewniając natychmiastowe odtwarzanie bez problemów z buforowaniem.
        </p>
      </div>

      {/* Video Status Overview */}
      <Card className="p-6">
        <h3 className="text-sm font-medium mb-3">Status filmów w Mux</h3>
        <div className="flex flex-wrap gap-3">
          <Badge variant="outline" className="gap-1.5 px-3 py-1.5 text-sm">
            <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
            Gotowe: {videoStats.ready}
          </Badge>
          <Badge variant="outline" className="gap-1.5 px-3 py-1.5 text-sm">
            <span className="inline-block h-2 w-2 rounded-full bg-yellow-500" />
            Oczekujące: {videoStats.pending}
          </Badge>
          <Badge variant="outline" className="gap-1.5 px-3 py-1.5 text-sm">
            <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
            Błędne: {videoStats.error}
          </Badge>
          <Badge variant="secondary" className="px-3 py-1.5 text-sm">
            Łącznie: {videoStats.total}
          </Badge>
        </div>
      </Card>

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
              {testResult.success ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
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
            Skopiuj ten adres i wklej go w ustawieniach webhooków w panelu Mux. Sekret webhooka (Webhook Secret) jest weryfikowany automatycznie.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <code className="flex-1 bg-muted rounded-md px-3 py-2 text-xs font-mono break-all select-all">
            {webhookUrl}
          </code>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              navigator.clipboard.writeText(webhookUrl);
            }}
          >
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
              {backfillResult.success ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <span>{backfillResult.message}</span>
            </div>
          )}
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
