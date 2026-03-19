import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, CheckCircle2, AlertCircle, ExternalLink, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const MuxSettingsView = () => {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillResult, setBackfillResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("test-mux-connection");

      if (error) {
        setTestResult({ success: false, message: `Błąd: ${error.message}` });
      } else if (data?.success) {
        setTestResult({ success: true, message: data.message });
      } else {
        setTestResult({ success: false, message: data?.error || "Nieznany błąd" });
      }
    } catch (err) {
      setTestResult({ success: false, message: String(err) });
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
        <h2 className="text-lg font-semibold">Integracja Mux</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Mux automatycznie konwertuje filmy do formatu HLS, zapewniając natychmiastowe odtwarzanie bez problemów z buforowaniem.
        </p>
      </div>

      <Card className="p-6 space-y-4">
        <div>
          <h3 className="text-sm font-medium">Status połączenia</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Klucze API Mux (Token ID, Token Secret, Webhook Secret) są przechowywane bezpiecznie w ustawieniach projektu.
          </p>
        </div>

        <div className="flex items-center gap-3">
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

      <Card className="p-6 space-y-4">
        <div>
          <h3 className="text-sm font-medium">Przetwarzanie istniejących filmów</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Wyślij wszystkie filmy, które nie zostały jeszcze przetworzone przez Mux, do transkodowania HLS.
          </p>
        </div>

        <div className="flex items-center gap-3">
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
