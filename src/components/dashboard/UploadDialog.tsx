import { useState, useRef, useCallback } from "react";
import { Upload, AlertCircle, FileVideo, Music } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";

const ACCEPTED_VIDEO = ".mp4,.mov,.avi,.mkv,.webm";
const ACCEPTED_AUDIO = ".mp3,.m4a,.aac,.wav";
const MAX_FILES = 20;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFilesSelected: (files: File[]) => void;
  onDualFilesSelected?: (videoFile: File, audioFile: File) => void;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(2)} GB`;
}

const UploadDialog = ({ open, onOpenChange, onFilesSelected, onDualFilesSelected }: Props) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadMode, setUploadMode] = useState<"standard" | "dual">("standard");

  // Dual mode state
  const [dualVideoFile, setDualVideoFile] = useState<File | null>(null);
  const [dualAudioFile, setDualAudioFile] = useState<File | null>(null);
  const [videoDragOver, setVideoDragOver] = useState(false);
  const [audioDragOver, setAudioDragOver] = useState(false);

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

  const handleDualVideoDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setVideoDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) setDualVideoFile(files[0]);
  };

  const handleDualAudioDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setAudioDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) setDualAudioFile(files[0]);
  };

  const handleDualUpload = () => {
    if (!dualVideoFile || !dualAudioFile || !onDualFilesSelected) return;
    setError(null);
    onDualFilesSelected(dualVideoFile, dualAudioFile);
    setDualVideoFile(null);
    setDualAudioFile(null);
    onOpenChange(false);
  };

  const resetDualState = () => {
    setDualVideoFile(null);
    setDualAudioFile(null);
    setError(null);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setError(null); resetDualState(); } }}>
      <DialogContent className="sm:max-w-lg border-border/50 bg-card/95 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle>Dodaj filmy</DialogTitle>
          <DialogDescription>Wybierz tryb przesyłania plików</DialogDescription>
        </DialogHeader>

        <Tabs value={uploadMode} onValueChange={(v) => { setUploadMode(v as "standard" | "dual"); setError(null); }}>
          <TabsList className="w-full">
            <TabsTrigger value="standard" className="flex-1 text-xs">Standardowy</TabsTrigger>
            <TabsTrigger value="dual" className="flex-1 text-xs">Wideo + Audio MP3</TabsTrigger>
          </TabsList>

          <TabsContent value="standard" className="mt-4">
            {error && (
              <div className="flex items-center gap-2 text-destructive text-sm p-3 bg-destructive/10 rounded-lg mb-3">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              className={`border-2 border-dashed rounded-xl p-12 flex flex-col items-center gap-4 text-center transition-all duration-300 ${
                dragOver ? "border-primary bg-primary/5 scale-[1.02]" : "border-border/50 hover:border-primary/30"
              }`}
            >
              <div className="h-16 w-16 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                <Upload className="h-8 w-8 text-primary" />
              </div>
              <div>
                <p className="font-medium text-foreground">Przeciągnij pliki tutaj</p>
                <p className="text-sm text-muted-foreground mt-1">MP4, MOV, AVI, MKV, WEBM (maks. {MAX_FILES})</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} className="border-border/50">
                Wybierz pliki
              </Button>
              <input ref={inputRef} type="file" accept={ACCEPTED_VIDEO + ",.avi,.mkv"} multiple className="hidden" onChange={onFileChange} />
            </div>
          </TabsContent>

          <TabsContent value="dual" className="mt-4">
            {error && (
              <div className="flex items-center gap-2 text-destructive text-sm p-3 bg-destructive/10 rounded-lg mb-3">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              {/* Video drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setVideoDragOver(true); }}
                onDragLeave={() => setVideoDragOver(false)}
                onDrop={handleDualVideoDrop}
                className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center gap-3 text-center transition-all duration-300 ${
                  videoDragOver ? "border-primary bg-primary/5 scale-[1.02]" : "border-border/50 hover:border-primary/30"
                }`}
              >
                <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                  <FileVideo className="h-6 w-6 text-primary" />
                </div>
                {dualVideoFile ? (
                  <div className="text-center">
                    <p className="text-xs font-medium text-foreground truncate max-w-[140px]">{dualVideoFile.name}</p>
                    <p className="text-[10px] text-muted-foreground">{formatSize(dualVideoFile.size)}</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs font-medium text-foreground">Plik wideo (bez audio)</p>
                    <p className="text-[10px] text-muted-foreground mt-1">MP4, MOV, WEBM</p>
                  </div>
                )}
                <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => videoInputRef.current?.click()}>
                  {dualVideoFile ? "Zmień" : "Wybierz"}
                </Button>
                <input
                  ref={videoInputRef}
                  type="file"
                  accept=".mp4,.mov,.webm"
                  className="hidden"
                  onChange={(e) => { if (e.target.files?.[0]) setDualVideoFile(e.target.files[0]); e.target.value = ""; }}
                />
              </div>

              {/* Audio drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setAudioDragOver(true); }}
                onDragLeave={() => setAudioDragOver(false)}
                onDrop={handleDualAudioDrop}
                className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center gap-3 text-center transition-all duration-300 ${
                  audioDragOver ? "border-accent bg-accent/5 scale-[1.02]" : "border-border/50 hover:border-accent/30"
                }`}
              >
                <div className="h-12 w-12 rounded-full bg-gradient-to-br from-accent/20 to-primary/20 flex items-center justify-center">
                  <Music className="h-6 w-6 text-accent-foreground" />
                </div>
                {dualAudioFile ? (
                  <div className="text-center">
                    <p className="text-xs font-medium text-foreground truncate max-w-[140px]">{dualAudioFile.name}</p>
                    <p className="text-[10px] text-muted-foreground">{formatSize(dualAudioFile.size)}</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs font-medium text-foreground">Ścieżka audio</p>
                    <p className="text-[10px] text-muted-foreground mt-1">MP3, M4A, AAC, WAV</p>
                  </div>
                )}
                <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => audioInputRef.current?.click()}>
                  {dualAudioFile ? "Zmień" : "Wybierz"}
                </Button>
                <input
                  ref={audioInputRef}
                  type="file"
                  accept={ACCEPTED_AUDIO}
                  className="hidden"
                  onChange={(e) => { if (e.target.files?.[0]) setDualAudioFile(e.target.files[0]); e.target.value = ""; }}
                />
              </div>
            </div>

            <Button
              className="w-full mt-4"
              disabled={!dualVideoFile || !dualAudioFile || !onDualFilesSelected}
              onClick={handleDualUpload}
            >
              <Upload className="h-4 w-4 mr-2" />
              Prześlij oba pliki
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default UploadDialog;
