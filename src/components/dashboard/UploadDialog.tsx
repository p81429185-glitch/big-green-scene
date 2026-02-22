import { useState, useRef, useCallback } from "react";
import { Upload, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const ACCEPTED = ".mp4,.mov,.avi,.mkv,.webm";
const MAX_FILES = 20;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFilesSelected: (files: File[]) => void;
}

const UploadDialog = ({ open, onOpenChange, onFilesSelected }: Props) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      setError(null);
      const arr = Array.from(files);
      if (arr.length === 0) return;
      if (arr.length > MAX_FILES) {
        setError(`Maksymalnie ${MAX_FILES} plików na raz`);
        return;
      }
      onFilesSelected(arr);
      onOpenChange(false);
    },
    [onFilesSelected, onOpenChange]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleFiles(e.target.files);
    e.target.value = "";
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setError(null); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Dodaj filmy</DialogTitle>
          <DialogDescription>Przeciągnij pliki lub kliknij, aby wybrać (maks. {MAX_FILES})</DialogDescription>
        </DialogHeader>

        {error && (
          <div className="flex items-center gap-2 text-destructive text-sm p-3 bg-destructive/10 rounded-lg">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

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
            <p className="font-medium text-foreground">Przeciągnij pliki tutaj</p>
            <p className="text-sm text-muted-foreground mt-1">MP4, MOV, AVI, MKV, WEBM</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
            Wybierz pliki
          </Button>
          <input ref={inputRef} type="file" accept={ACCEPTED} multiple className="hidden" onChange={onFileChange} />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UploadDialog;
