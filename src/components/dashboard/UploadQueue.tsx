import { CheckCircle2, AlertCircle, Upload, Loader2, Clock, ChevronDown, ChevronUp, X } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { QueueItem } from "@/hooks/useUploadQueue";

const formatSize = (bytes: number) => {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

const StatusIcon = ({ status }: { status: QueueItem["status"] }) => {
  switch (status) {
    case "done":
      return <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />;
    case "uploading":
      return <Loader2 className="h-4 w-4 text-primary shrink-0 animate-spin" />;
    case "processing":
      return <Loader2 className="h-4 w-4 text-amber-500 shrink-0 animate-spin" />;
    case "error":
      return <AlertCircle className="h-4 w-4 text-destructive shrink-0" />;
    default:
      return <Clock className="h-4 w-4 text-muted-foreground shrink-0" />;
  }
};

interface Props {
  queue: QueueItem[];
  minimized: boolean;
  onToggleMinimize: () => void;
  onClose: () => void;
  isActive: boolean;
  doneCount: number;
  totalCount: number;
  overallProgress: number;
}

const UploadQueue = ({
  queue,
  minimized,
  onToggleMinimize,
  onClose,
  isActive,
  doneCount,
  totalCount,
  overallProgress,
}: Props) => {
  if (queue.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 bg-background border rounded-xl shadow-lg overflow-hidden">
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
        <ScrollArea className="max-h-64">
          <div className="divide-y">
            {queue.map((item) => (
              <div key={item.id} className="px-3 py-2 space-y-1">
                <div className="flex items-center gap-2">
                  <StatusIcon status={item.status} />
                  <span className="text-sm truncate flex-1 text-foreground">{item.fileName}</span>
                  <span className="text-xs text-muted-foreground shrink-0">{formatSize(item.fileSize)}</span>
                </div>
                {item.status === "uploading" && (
                  <Progress value={item.progress} className="h-1" />
                )}
                {item.status === "processing" && (
                  <div className="space-y-1">
                    <Progress value={95} className="h-1 animate-pulse" />
                    <p className="text-xs text-muted-foreground">Przetwarzanie na serwerze...</p>
                  </div>
                )}
                {item.status === "error" && (
                  <p className="text-xs text-destructive">{item.error}</p>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
};

export default UploadQueue;
