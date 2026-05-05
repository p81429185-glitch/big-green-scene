import { useState, useEffect } from "react";
import { AlertCircle, Zap, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { useVideoCompression } from "@/hooks/useVideoCompression";
import { formatBytes } from "@/lib/uploadConstants";

interface Props {
  file: File;
  onCompress: (compressedFile: File) => void;
  onSkip: () => void;
  onCancel: () => void;
}

export function CompressionPrompt({ file, onCompress, onSkip, onCancel }: Props) {
  const { compressVideo, estimateCompressedSize, progress, isCompressing, isSupported, supportReason } = useVideoCompression();
  const [wantsCompression, setWantsCompression] = useState(true);
  const [estimation, setEstimation] = useState<{ originalSize: number; estimatedSize: number; savingsPercent: number } | null>(null);
  const [isEstimating, setIsEstimating] = useState(true);

  useEffect(() => {
    if (!isSupported) {
      setIsEstimating(false);
      return;
    }

    estimateCompressedSize(file).then((est) => {
      setEstimation(est);
      setIsEstimating(false);
      if (est && est.savingsPercent < 10) {
        setWantsCompression(false);
      }
    });
  }, [file, estimateCompressedSize, isSupported]);

  const handleProceed = async () => {
    if (!wantsCompression || !isSupported) {
      onSkip();
      return;
    }

    const result = await compressVideo(file);
    if (result) {
      onCompress(result.file);
    } else {
      onSkip();
    }
  };

  if (!isSupported) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-card border rounded-xl p-6 max-w-md w-full space-y-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">Kompresja niedostępna</h3>
              <p className="text-sm text-muted-foreground mt-1">{supportReason}</p>
            </div>
            <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onCancel}>Anuluj</Button>
            <Button onClick={onSkip}>Prześlij bez kompresji</Button>
          </div>
        </div>
      </div>
    );
  }

  if (isCompressing) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-card border rounded-xl p-6 max-w-md w-full space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground">{progress.message}</h3>
              <span className="text-sm text-muted-foreground">{Math.round(progress.progress)}%</span>
            </div>
            <Progress value={progress.progress} className="h-2" />
            {progress.eta !== Infinity && progress.eta > 0 && (
              <p className="text-xs text-muted-foreground">
                Pozostało: {Math.floor(progress.eta / 60)}m {Math.round(progress.eta % 60)}s
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border rounded-xl p-6 max-w-md w-full space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Kompresja wideo</h3>
              <p className="text-sm text-muted-foreground mt-0.5">Zmniejsz rozmiar przed uploadem</p>
            </div>
          </div>
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {isEstimating ? (
          <div className="py-4 text-center">
            <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground mt-2">Analiza wideo...</p>
          </div>
        ) : estimation ? (
          <div className="space-y-3">
            <div className="bg-muted/50 rounded-lg p-3 space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Oryginalny:</span>
                <span className="font-medium text-foreground">{formatBytes(estimation.originalSize)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Po kompresji:</span>
                <span className="font-medium text-foreground">{formatBytes(estimation.estimatedSize)}</span>
              </div>
              {estimation.savingsPercent > 0 && (
                <div className="flex justify-between text-sm pt-1 border-t border-border/50">
                  <span className="text-muted-foreground">Oszczędność:</span>
                  <span className="font-semibold text-primary">{estimation.savingsPercent}%</span>
                </div>
              )}
            </div>

            {estimation.savingsPercent < 10 && (
              <div className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-500 bg-amber-500/10 rounded-lg p-2">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>Plik już dobrze skompresowany — kompresja może nie przynieść korzyści</span>
              </div>
            )}

            <div className="flex items-center gap-2 py-2">
              <Checkbox
                id="compress-toggle"
                checked={wantsCompression}
                onCheckedChange={(checked) => setWantsCompression(checked === true)}
              />
              <label htmlFor="compress-toggle" className="text-sm text-foreground cursor-pointer select-none">
                Kompresuj przed uploadem (H.264 5 Mbps, bez utraty jakości)
              </label>
            </div>
          </div>
        ) : (
          <div className="py-4 text-center text-sm text-destructive">
            Nie udało się przeanalizować wideo
          </div>
        )}

        <div className="flex gap-2 justify-end pt-2">
          <Button variant="outline" onClick={onCancel}>Anuluj</Button>
          <Button variant="secondary" onClick={onSkip}>Prześlij bez kompresji</Button>
          <Button onClick={handleProceed} disabled={isEstimating || !estimation}>
            {wantsCompression ? "Kompresuj i prześlij" : "Prześlij"}
          </Button>
        </div>
      </div>
    </div>
  );
}
