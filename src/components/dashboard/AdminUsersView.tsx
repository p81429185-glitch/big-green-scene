import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Trash2, Loader2, RefreshCw, Video } from "lucide-react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";

interface UserProfile {
  id: string;
  email: string;
  created_at: string;
  role?: string;
}

const AdminUsersView = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("user");
  const [creating, setCreating] = useState(false);

  // Video reprocessing state
  const [isReprocessing, setIsReprocessing] = useState(false);
  const [totalVideos, setTotalVideos] = useState(0);
  const [processedVideos, setProcessedVideos] = useState(0);

  const fetchUsers = async () => {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email, created_at");

    if (!profiles) return;

    // Fetch roles for all users
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

  // Count processed videos
  const countProcessedVideos = useCallback(async () => {
    const { count } = await supabase
      .from("videos")
      .select("*", { count: "exact", head: true })
      .eq("is_processed", true);
    return count ?? 0;
  }, []);

  // Reprocess all videos handler
  const handleReprocessVideos = async () => {
    // First, count total unprocessed videos
    const { count: unprocessedCount } = await supabase
      .from("videos")
      .select("*", { count: "exact", head: true })
      .or("is_processed.is.null,is_processed.eq.false");

    if (!unprocessedCount || unprocessedCount === 0) {
      toast.info("Wszystkie filmy są już przetworzone");
      return;
    }

    setTotalVideos(unprocessedCount);
    setProcessedVideos(0);
    setIsReprocessing(true);

    // Subscribe to realtime updates on videos table
    const channel = supabase
      .channel("reprocess-progress")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "videos",
        },
        async () => {
          // Recount processed videos on any update
          const count = await countProcessedVideos();
          setProcessedVideos(count);
        }
      )
      .subscribe();

    // Get initial count of already processed
    const initialCount = await countProcessedVideos();
    setProcessedVideos(initialCount);

    try {
      const { data, error } = await supabase.functions.invoke("backfill-video-faststart");

      if (error) {
        toast.error(`Błąd przetwarzania: ${error.message}`);
      } else if (data) {
        const result = data as { total: number; success: number; failed: number; failed_ids: string[] };
        if (result.failed > 0) {
          toast.warning(`Przetworzono ${result.success}/${result.total} filmów. ${result.failed} nieudanych.`);
        } else {
          toast.success(`Wszystkie ${result.success} filmów zostało przetworzonych!`);
        }
      }
    } catch (err) {
      toast.error("Nieoczekiwany błąd podczas przetwarzania");
    } finally {
      // Cleanup subscription
      supabase.removeChannel(channel);
      setIsReprocessing(false);
    }
  };

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
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isReprocessing ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="font-medium">
                  Przetwarzanie filmów... Nie zamykaj tej strony.
                </span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Postęp</span>
                  <span>{processedVideos} przetworzone</span>
                </div>
                <Progress 
                  value={totalVideos > 0 ? (processedVideos / (processedVideos + totalVideos)) * 100 : 0} 
                  className="h-2" 
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Duże pliki (500MB-1GB) mogą przetwarzać się kilka minut każdy.
              </p>
            </div>
          ) : (
            <Button onClick={handleReprocessVideos} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Przetwórz wszystkie filmy
            </Button>
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
