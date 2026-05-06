import { forwardRef } from "react";
import { CheckCircle2, AlertCircle, Upload, Loader2, Clock, ChevronDown, ChevronUp, X, Ban } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { QueueItem } from "@/hooks/useUploadQueue";
import { formatBytes, formatSpeed, formatEta } from "@/lib/uploadConstants";

const StatusIcon = forwardRef<SVGSVGElement, { status: QueueItem["status"] }>(({ status }, ref) => {
  switch (status) {
    case "done":
      return <CheckCircle2 ref={ref} className="h-4 w-4 text-primary shrink-0" />;
    case "uploading":
      return <Loader2 ref={ref} className="h-4 w-4 text-primary shrink-0 animate-spin" />;
    case "processing":
      return <Loader2 ref={ref} className="h-4 w-4 text-amber-500 shrink-0 animate-spin" />;
    case "error":
      return <AlertCircle ref={ref} className="h-4 w-4 text-destructive shrink-0" />;
    case "cancelled":
      return <Ban ref={ref} className="h-4 w-4 text-muted-foreground shrink-0" />;
    default:
      return <Clock ref={ref} className="h-4 w-4 text-muted-foreground shrink-0" />;
  }
});
StatusIcon.displayName = "StatusIcon";

interface Props {
  queue: QueueItem[];
  minimized: boolean;
  onToggleMinimize: () => void;
  onClose: () => void;
  onCancelItem: (id: string) => void;
  isActive: boolean;
  doneCount: number;
  totalCount: number;
  overallProgress: number;
}

const UploadQueue = forwardRef<HTMLDivElement, Props>(({
  queue,
  minimized,
  onToggleMinimize,
  onClose,
  onCancelItem,
  isActive,
  doneCount,
  totalCount,
  overallProgress,
}, ref) => {
  if (queue.length === 0) return null;

  return (
    <div ref={ref} className="fixed bottom-4 right-4 z-50 w-[22rem] max-w-[calc(100vw-2rem)] bg-background border rounded-xl shadow-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Upload className="h-4 w-4" />
          <span>
            Przesyłanie ({doneCount}/{totalCount})
          </span>
          {minimized && <span className="text-muted-foreground">{overallProgress}%</span>}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onToggleMinimize}
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            {minimized ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {!isActive && (
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {minimized ? (
        <div className="px-3 py-2">
          <Progress value={overallProgress} className="h-1.5" />
        </div>
      ) : (
        <ScrollArea className="max-h-72">
          <div className="divide-y">
            {queue.map((item) => {
              const canCancel = item.status === "waiting" || item.status === "uploading";
              return (
                <div key={item.id} className="px-3 py-2 space-y-1">
                  <div className="flex items-center gap-2">
                    <StatusIcon status={item.status} />
                    <span className="text-sm truncate flex-1 text-foreground">{item.fileName}</span>
                    <span className="text-xs text-muted-foreground shrink-0">{formatBytes(item.fileSize)}</span>
                    {canCancel && (
                      <button
                        onClick={() => onCancelItem(item.id)}
                        className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                        title="Anuluj"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {item.status === "uploading" && (
                    <>
                      <Progress value={item.progress} className="h-1" />
                      <div className="flex justify-between text-[11px] text-muted-foreground">
                        <span>
                          {formatBytes(item.bytesUploaded)} / {formatBytes(item.fileSize)} · {Math.round(item.progress)}%
                        </span>
                        <span>{formatSpeed(item.speed)} · ETA {formatEta(item.eta)}</span>
                      </div>
                    </>
                  )}

                  {item.status === "processing" && (
                    <div className="space-y-1">
                      <Progress value={100} className="h-1 animate-pulse" />
                      <p className="text-xs text-muted-foreground">Weryfikacja i przetwarzanie po stronie serwera...</p>
                    </div>
                  )}

                  {item.status === "error" && (
                    <p className="text-xs text-destructive break-words">{item.error}</p>
                  )}

                  {item.status === "cancelled" && (
                    <p className="text-xs text-muted-foreground">Anulowano</p>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
});
UploadQueue.displayName = "UploadQueue";

export default UploadQueue;
