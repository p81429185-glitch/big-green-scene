import { useState, useRef, useCallback } from "react";
import { Upload, CheckCircle2 } from "lucide-react";
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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentFolderId: string | null;
  onUpload: (video: { title: string; fileName: string; size: number; folderId: string | null }) => void;
}

const UploadDialog = ({ open, onOpenChange, currentFolderId, onUpload }: Props) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [done, setDone] = useState(false);

  const reset = () => {
    setProgress(null);
    setDone(false);
  };

  const handleFile = useCallback(
    (file: File) => {
      reset();
      setProgress(0);
      const interval = setInterval(() => {
        setProgress((p) => {
          const next = (p ?? 0) + Math.random() * 30 + 10;
          if (next >= 100) {
            clearInterval(interval);
            setDone(true);
            const title = file.name.replace(/\.[^/.]+$/, "");
            onUpload({ title, fileName: file.name, size: file.size, folderId: currentFolderId });
            setTimeout(() => {
              onOpenChange(false);
              reset();
            }, 800);
            return 100;
          }
          return next;
        });
      }, 300);
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
            <Progress value={progress} className="h-2" />
            <p className="text-sm text-muted-foreground">
              {done ? "Gotowe!" : "Przesyłanie..."}
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default UploadDialog;
