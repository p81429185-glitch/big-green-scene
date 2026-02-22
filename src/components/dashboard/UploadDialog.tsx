import { useState, useRef, useCallback } from "react";
import { Upload, CheckCircle2, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

const ACCEPTED = ".mp4,.mov,.avi,.mkv,.webm";

const formatSize = (bytes: number) => {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

const getStageLabel = (pct: number) => {
  if (pct < 90) return "Przesyłanie pliku...";
  if (pct < 95) return "Zapisywanie metadanych...";
  return "Generowanie miniaturki...";
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentFolderId: string | null;
  onUpload: (file: File, folderId: string | null, onProgress: (pct: number) => void) => Promise<any>;
}

const UploadDialog = ({ open, onOpenChange, currentFolderId, onUpload }: Props) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState(0);

  const reset = () => {
    setProgress(null);
    setDone(false);
    setError(null);
    setFileName("");
    setFileSize(0);
  };

  const handleFile = useCallback(
    async (file: File) => {
      reset();
      setFileName(file.name);
      setFileSize(file.size);
      setProgress(0);
      try {
        await onUpload(file, currentFolderId, setProgress);
        setDone(true);
        setTimeout(() => {
          onOpenChange(false);
          reset();
        }, 800);
      } catch (err: any) {
        setError(err?.message || "Błąd przesyłania");
        setProgress(null);
      }
    },
    [onUpload, onOpenChange, currentFolderId]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Dodaj film</DialogTitle>
          <DialogDescription>Przeciągnij plik lub kliknij, aby wybrać</DialogDescription>
        </DialogHeader>

        {error && (
          <div className="flex items-center gap-2 text-destructive text-sm p-3 bg-destructive/10 rounded-lg">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {progress === null ? (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center gap-4 text-center transition-colors ${
              dragOver ? "border-primary bg-primary/5" : "border-border"
            }`}
          >
            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
              <Upload className="h-7 w-7 text-primary" />
            </div>
            <div>
              <p className="font-medium text-foreground">Przeciągnij plik tutaj</p>
              <p className="text-sm text-muted-foreground mt-1">MP4, MOV, AVI, MKV, WEBM</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
              Wybierz plik
            </Button>
            <input ref={inputRef} type="file" accept={ACCEPTED} className="hidden" onChange={onFileChange} />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 py-6">
            {done ? (
              <CheckCircle2 className="h-12 w-12 text-primary" />
            ) : (
              <Upload className="h-12 w-12 text-primary animate-pulse" />
            )}
            <div className="w-full space-y-2">
              <Progress value={progress} className="h-2 [&>div]:transition-transform [&>div]:duration-300 [&>div]:ease-out" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span className="truncate max-w-[200px]">{fileName}</span>
                <span>{formatSize(fileSize)}</span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              {done ? "Gotowe!" : `${getStageLabel(progress ?? 0)} ${Math.round(progress ?? 0)}%`}
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default UploadDialog;
