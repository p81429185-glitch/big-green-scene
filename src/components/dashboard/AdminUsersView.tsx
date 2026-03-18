import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Trash2, Loader2, RefreshCw, Video, X, Download, Cpu, Upload, CheckCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { isFaststart, relocateMoovToStart } from "@/lib/moovAtomUtils";
import type { FaststartResponse } from "@/workers/faststartWorker";

interface UserProfile {
  id: string;
  email: string;
  created_at: string;
  role?: string;
}

interface UnprocessedVideo {
  id: string;
  title: string;
  size: number;
  storage_path: string;
}

type ProcessingPhase = "idle" | "fetching-list" | "downloading" | "checking" | "optimizing" | "uploading" | "updating-db" | "done";

interface ProcessingState {
  phase: ProcessingPhase;
  currentVideo: string;
  currentIndex: number;
  totalVideos: number;
  successCount: number;
  failedCount: number;
  failedTitles: string[];
}

const initialProcessingState: ProcessingState = {
  phase: "idle",
  currentVideo: "",
  currentIndex: 0,
  totalVideos: 0,
  successCount: 0,
  failedCount: 0,
  failedTitles: [],
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(2)} GB`;
}

function phaseLabel(phase: ProcessingPhase, videoTitle: string): string {
  switch (phase) {
    case "fetching-list": return "Pobieranie listy filmów...";
    case "downloading": return `Pobieranie: ${videoTitle}...`;
    case "checking": return `Sprawdzanie: ${videoTitle}...`;
    case "optimizing": return `Optymalizacja: ${videoTitle}...`;
    case "uploading": return `Wysyłanie: ${videoTitle}...`;
    case "updating-db": return `Aktualizacja bazy: ${videoTitle}...`;
    case "done": return "Zakończono";
    default: return "";
  }
}

const AdminUsersView = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("user");
  const [creating, setCreating] = useState(false);

  // Video reprocessing state
  const [processing, setProcessing] = useState<ProcessingState>(initialProcessingState);
  const abortRef = useRef(false);

  const isReprocessing = processing.phase !== "idle" && processing.phase !== "done";

  const fetchUsers = async () => {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email, created_at");

    if (!profiles) return;

    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id, role");

    const roleMap = new Map<string, string>();
    roles?.forEach((r) => roleMap.set(r.user_id, r.role));

    setUsers(
      profiles.map((p) => ({
        ...p,
        email: p.email ?? "",
        role: roleMap.get(p.id) ?? "user",
      }))
    );
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setCreating(true);

    const { data, error } = await supabase.functions.invoke("create-user", {
      body: { email, password, role, action: "create" },
    });

    if (error || data?.error) {
      toast.error(data?.error || error?.message || "Błąd tworzenia użytkownika");
    } else {
      toast.success("Użytkownik utworzony");
      setEmail("");
      setPassword("");
      setRole("user");
      fetchUsers();
    }
    setCreating(false);
  };

  const handleDelete = async (userEmail: string) => {
    if (!confirm(`Czy na pewno chcesz usunąć ${userEmail}?`)) return;

    const { data, error } = await supabase.functions.invoke("create-user", {
      body: { email: userEmail, action: "delete" },
    });

    if (error || data?.error) {
      toast.error(data?.error || error?.message || "Błąd usuwania");
    } else {
      toast.success("Użytkownik usunięty");
      fetchUsers();
    }
  };

  const processVideoInWorker = (buffer: ArrayBuffer, videoId: string): Promise<ArrayBuffer> => {
    return new Promise((resolve, reject) => {
      const worker = new Worker(
        new URL("../../workers/faststartWorker.ts", import.meta.url),
        { type: "module" }
      );

      worker.onmessage = (e: MessageEvent<FaststartResponse>) => {
        worker.terminate();
        if (e.data.type === "DONE") {
          resolve(e.data.buffer);
        } else {
          reject(new Error(e.data.error));
        }
      };

      worker.onerror = (err) => {
        worker.terminate();
        reject(new Error(err.message || "Worker error"));
      };

      worker.postMessage(
        { type: "PROCESS", buffer, videoId },
        [buffer] // transfer
      );
    });
  };

  const generateAndUploadThumbnail = async (videoId: string, storagePath: string): Promise<boolean> => {
    let objectUrl: string | null = null;
    let videoEl: HTMLVideoElement | null = null;
    try {
      // 1. Fetch the (now faststart) file from storage
      const { data: urlData } = supabase.storage.from("videos").getPublicUrl(storagePath);
      const resp = await fetch(urlData.publicUrl);
      if (!resp.ok) throw new Error(`Fetch failed: ${resp.status}`);
      const blob = await resp.blob();

      // 2. Create video element
      videoEl = document.createElement("video");
      objectUrl = URL.createObjectURL(blob);
      videoEl.src = objectUrl;
      videoEl.crossOrigin = "anonymous";
      videoEl.preload = "metadata";
      videoEl.muted = true;

      // 3. Wait for loadeddata
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("loadeddata timeout")), 30000);
        videoEl!.addEventListener("loadeddata", () => { clearTimeout(timeout); resolve(); }, { once: true });
        videoEl!.addEventListener("error", () => { clearTimeout(timeout); reject(new Error("video load error")); }, { once: true });
        videoEl!.load();
      });

      // 4. Seek
      videoEl.currentTime = Math.min(1, videoEl.duration / 2);
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("seeked timeout")), 15000);
        videoEl!.addEventListener("seeked", () => { clearTimeout(timeout); resolve(); }, { once: true });
      });

      // 5. Draw to canvas
      const canvas = document.createElement("canvas");
      canvas.width = 320;
      canvas.height = 180;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("No canvas context");
      ctx.drawImage(videoEl, 0, 0, 320, 180);

      // 6. Export as JPEG
      const jpegBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("toBlob returned null"))),
          "image/jpeg",
          0.7
        );
      });

      // 7. Upload to thumbnails bucket
      const thumbPath = `${videoId}.jpg`;
      const { error: uploadErr } = await supabase.storage
        .from("thumbnails")
        .upload(thumbPath, jpegBlob, { upsert: true, contentType: "image/jpeg" });
      if (uploadErr) throw new Error(`Thumbnail upload: ${uploadErr.message}`);

      // 8. Get public URL & update DB
      const { data: thumbUrlData } = supabase.storage.from("thumbnails").getPublicUrl(thumbPath);
      await supabase
        .from("videos")
        .update({ thumbnail_url: thumbUrlData.publicUrl })
        .eq("id", videoId);

      return true;
    } catch (err) {
      console.error(`Thumbnail generation failed for ${videoId}:`, err);
      return false;
    } finally {
      // 9. Cleanup
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      if (videoEl) videoEl.remove();
    }
  };

  const handleReprocessVideos = async () => {
    abortRef.current = false;

    // Phase 1: Fetch list from Edge Function
    setProcessing({ ...initialProcessingState, phase: "fetching-list" });

    const { data, error } = await supabase.functions.invoke("backfill-video-faststart");

    if (error) {
      toast.error(`Błąd pobierania listy: ${error.message}`);
      setProcessing(initialProcessingState);
      return;
    }

    const videos: UnprocessedVideo[] = data?.videos ?? [];

    if (videos.length === 0) {
      toast.info("Wszystkie filmy są już przetworzone");
      setProcessing(initialProcessingState);
      return;
    }

    let successCount = 0;
    let failedCount = 0;
    const failedTitles: string[] = [];

    setProcessing({
      phase: "downloading",
      currentVideo: videos[0].title,
      currentIndex: 0,
      totalVideos: videos.length,
      successCount: 0,
      failedCount: 0,
      failedTitles: [],
    });

    // Phase 2: Process each video sequentially
    for (let i = 0; i < videos.length; i++) {
      if (abortRef.current) break;

      const video = videos[i];
      const sizeLabel = `(${formatSize(video.size)})`;

      try {
        // Step a: Download
        setProcessing((prev) => ({
          ...prev,
          phase: "downloading",
          currentVideo: `${video.title} ${sizeLabel}`,
          currentIndex: i,
        }));

        const { data: publicUrlData } = supabase.storage.from("videos").getPublicUrl(video.storage_path);
        const response = await fetch(publicUrlData.publicUrl);
        if (!response.ok) throw new Error(`Download failed: ${response.status}`);

        // Step b: Read as ArrayBuffer
        const buffer = await response.arrayBuffer();

        // Step c: Check if already faststart
        setProcessing((prev) => ({ ...prev, phase: "checking" }));

        if (isFaststart(buffer)) {
          // Already optimized — just update DB
          setProcessing((prev) => ({ ...prev, phase: "updating-db" }));
          await supabase
            .from("videos")
            .update({ is_processed: true, processing_status: "ready" })
            .eq("id", video.id);

          successCount++;
          setProcessing((prev) => ({
            ...prev,
            successCount,
            failedCount,
          }));

          // Step h: Breathing room
          await new Promise((r) => setTimeout(r, 500));
          continue;
        }

        // Step d: Process in Web Worker
        setProcessing((prev) => ({ ...prev, phase: "optimizing" }));
        const processedBuffer = await processVideoInWorker(buffer, video.id);

        // Step e: Re-upload
        setProcessing((prev) => ({ ...prev, phase: "uploading" }));
        const blob = new Blob([processedBuffer], { type: "video/mp4" });
        const { error: uploadError } = await supabase.storage
          .from("videos")
          .upload(video.storage_path, blob, { upsert: true });

        if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

        // Step f: Update DB
        setProcessing((prev) => ({ ...prev, phase: "updating-db" }));
        await supabase
          .from("videos")
          .update({ is_processed: true, processing_status: "ready" })
          .eq("id", video.id);

        successCount++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`Failed to process "${video.title}":`, msg);
        toast.warning(`${video.title} — pominięty (błąd)`);
        failedCount++;
        failedTitles.push(video.title);

        // Mark as failed in DB (best effort)
        try {
          await supabase
            .from("videos")
            .update({ processing_status: "failed" })
            .eq("id", video.id);
        } catch {
          // ignore
        }
      }

      // Step g+h: Update counters & breathing room
      setProcessing((prev) => ({
        ...prev,
        successCount,
        failedCount,
        failedTitles: [...failedTitles],
      }));

      await new Promise((r) => setTimeout(r, 500));
    }

    // Phase 3: Done
    setProcessing((prev) => ({
      ...prev,
      phase: "done",
      successCount,
      failedCount,
      failedTitles: [...failedTitles],
    }));

    if (failedCount === 0) {
      toast.success(`Wszystkie ${successCount} filmów zoptymalizowane!`);
    } else {
      toast.warning(`Zakończono: ${successCount} OK, ${failedCount} nieudanych`);
    }
  };

  const handleClosePanel = () => {
    if (isReprocessing) {
      abortRef.current = true;
    }
    setProcessing(initialProcessingState);
  };

  const progressPercent =
    processing.totalVideos > 0
      ? Math.round(((processing.currentIndex + (processing.phase === "done" ? 1 : 0)) / processing.totalVideos) * 100)
      : 0;

  return (
    <div className="space-y-6">
      {/* Video Reprocessing Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="h-5 w-5" />
            Przetwarzanie wideo
          </CardTitle>
          <CardDescription>
            Przetwarza wszystkie filmy w bazie, które nie mają zoptymalizowanego formatu (faststart).
            Przetwarzanie odbywa się w przeglądarce — nie zamykaj tej karty.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {processing.phase === "idle" ? (
            <Button onClick={handleReprocessVideos} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Przetwórz wszystkie filmy
            </Button>
          ) : processing.phase === "done" ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-primary" />
                <span className="font-medium">
                  Zakończono: {processing.successCount} OK
                  {processing.failedCount > 0 && (
                    <span className="text-destructive">, {processing.failedCount} nieudanych</span>
                  )}
                </span>
              </div>
              {processing.failedTitles.length > 0 && (
                <div className="rounded-md border border-destructive/20 bg-destructive/5 p-3">
                  <p className="text-sm font-medium text-destructive flex items-center gap-1.5 mb-1">
                    <AlertTriangle className="h-4 w-4" />
                    Nieudane filmy:
                  </p>
                  <ul className="text-sm text-muted-foreground space-y-0.5">
                    {processing.failedTitles.map((t, i) => (
                      <li key={i}>• {t}</li>
                    ))}
                  </ul>
                </div>
              )}
              <Button onClick={handleClosePanel} variant="outline" size="sm">
                <X className="h-4 w-4 mr-2" />
                Zamknij
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {processing.phase === "downloading" && <Download className="h-5 w-5 animate-pulse text-primary" />}
                  {processing.phase === "checking" && <Cpu className="h-5 w-5 animate-pulse text-primary" />}
                  {processing.phase === "optimizing" && <Cpu className="h-5 w-5 animate-spin text-primary" />}
                  {processing.phase === "uploading" && <Upload className="h-5 w-5 animate-pulse text-primary" />}
                  {(processing.phase === "fetching-list" || processing.phase === "updating-db") && (
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  )}
                  <span className="font-medium text-sm">
                    {phaseLabel(processing.phase, processing.currentVideo)}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={handleClosePanel}
                  title="Anuluj"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Postęp</span>
                  <span>
                    {processing.currentIndex + (processing.phase !== "fetching-list" ? 1 : 0)} / {processing.totalVideos} filmów
                  </span>
                </div>
                <Progress value={progressPercent} className="h-2" />
              </div>

              {(processing.successCount > 0 || processing.failedCount > 0) && (
                <p className="text-xs text-muted-foreground">
                  ✓ {processing.successCount} OK
                  {processing.failedCount > 0 && (
                    <span className="text-destructive ml-2">✗ {processing.failedCount} nieudanych</span>
                  )}
                </p>
              )}

              <p className="text-xs text-muted-foreground">
                Nie zamykaj tej karty przeglądarki. Duże pliki (500MB–1GB) mogą przetwarzać się kilka minut.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create User Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Dodaj użytkownika
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1.5 flex-1 min-w-[200px]">
              <Label htmlFor="new-email">Email</Label>
              <Input id="new-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="user@example.com" />
            </div>
            <div className="space-y-1.5 flex-1 min-w-[200px]">
              <Label htmlFor="new-password">Hasło</Label>
              <Input id="new-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" />
            </div>
            <div className="space-y-1.5 w-32">
              <Label>Rola</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={creating}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserPlus className="h-4 w-4 mr-2" />}
              Dodaj
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Users List Card */}
      <Card>
        <CardHeader>
          <CardTitle>Użytkownicy ({users.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Rola</TableHead>
                  <TableHead>Data utworzenia</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.email}</TableCell>
                    <TableCell>
                      <Badge variant={u.role === "admin" ? "default" : "secondary"}>
                        {u.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(u.created_at).toLocaleDateString("pl-PL")}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(u.email)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminUsersView;
