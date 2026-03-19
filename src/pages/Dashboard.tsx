import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Search, Menu, ChevronRight, Loader2 } from "lucide-react";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import ActionCards from "@/components/dashboard/ActionCards";
import RecentBanner from "@/components/dashboard/RecentBanner";
import TopPlayedTable from "@/components/dashboard/TopPlayedTable";
import RecentlyShared from "@/components/dashboard/RecentlyShared";
import UploadDialog from "@/components/dashboard/UploadDialog";
import UploadQueue from "@/components/dashboard/UploadQueue";
import CreateFolderDialog from "@/components/dashboard/CreateFolderDialog";
import AnalyticsView from "@/components/dashboard/AnalyticsView";
import BrandKitView from "@/components/dashboard/BrandKitView";
import AdminUsersView from "@/components/dashboard/AdminUsersView";
import MuxSettingsView from "@/components/dashboard/MuxSettingsView";
import type { MuxConnectionStatus } from "@/components/dashboard/MuxSettingsView";
import { useVideoStore } from "@/hooks/useVideoStore";
import { useUploadQueue } from "@/hooks/useUploadQueue";

const Dashboard = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [folderOpen, setFolderOpen] = useState(false);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [bannerVisible, setBannerVisible] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const { isAuthenticated, loading: authLoading, isAdmin, userEmail } = useAuth();
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState<"home" | "favorites" | "library" | "analytics" | "brandkit" | "users" | "mux">("home");
  const [muxConnectionStatus, setMuxConnectionStatus] = useState<MuxConnectionStatus>("unknown");
  const { videos, folders, loading: videosLoading, uploadVideo, deleteVideo, toggleFavorite, createFolder, deleteFolder, moveVideo, moveFolder } = useVideoStore();

  const {
    queue, minimized, setMinimized, addFiles, clearQueue,
    isActive, hasItems, doneCount, totalCount, overallProgress,
  } = useUploadQueue({ uploadVideo });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate("/auth", { replace: true });
  }, [isAuthenticated, authLoading, navigate]);

  // Default admin view to Mux settings
  useEffect(() => {
    if (!authLoading && isAdmin) setActiveView("mux");
  }, [authLoading, isAdmin]);

  const filteredVideos = useMemo(() => {
    let result = activeView === "favorites"
      ? videos.filter((v) => v.is_favorite)
      : activeView === "library" || activeView === "analytics"
        ? videos
        : currentFolderId
          ? videos.filter((v) => v.folder_id === currentFolderId)
          : videos;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (v) => v.title.toLowerCase().includes(q) || v.file_name.toLowerCase().includes(q)
      );
    }
    return result;
  }, [videos, activeView, currentFolderId, searchQuery]);

  const totalPlays = videos.reduce((sum, v) => sum + v.plays, 0);
  const lastVideo = videos.length > 0 ? videos[0] : null;

  const breadcrumbPath = useMemo(() => {
    if (!currentFolderId || activeView !== "home") return [];
    const path: { id: string; name: string }[] = [];
    let id: string | null = currentFolderId;
    while (id) {
      const folder = folders.find((f) => f.id === id);
      if (!folder) break;
      path.unshift({ id: folder.id, name: folder.name });
      id = folder.parent_id ?? null;
    }
    return path;
  }, [currentFolderId, folders, activeView]);

  const currentFolderName = currentFolderId ? folders.find((f) => f.id === currentFolderId)?.name : undefined;

  const handleFilesSelected = (files: File[]) => {
    addFiles(files, currentFolderId);
  };

  const handleCreateFolder = (name: string) => {
    createFolder(name, currentFolderId);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-background">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <DashboardSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        folders={folders}
        currentFolderId={currentFolderId}
        onFolderSelect={(id) => { setCurrentFolderId(id); setActiveView("home"); }}
        onDeleteFolder={deleteFolder}
        activeView={activeView}
        isAdmin={isAdmin}
        onViewChange={(view) => { setActiveView(view); if (view !== "home") setCurrentFolderId(null); }}
        onDropVideo={(videoId, folderId) => moveVideo(videoId, folderId)}
        onDropFolder={(folderId, targetParentId) => moveFolder(folderId, targetParentId)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b flex items-center justify-between px-4 md:px-6 bg-background sticky top-0 z-30">
          <div className="flex items-center gap-3 flex-1">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden text-foreground">
              <Menu className="h-5 w-5" />
            </button>
            <div className="relative max-w-sm w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Szukaj filmów..." className="pl-9 h-9" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
          </div>
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary text-primary-foreground text-xs">
              {userEmail ? userEmail.substring(0, 2).toUpperCase() : "?"}
            </AvatarFallback>
          </Avatar>
        </header>

        <main className="flex-1 p-4 md:p-6 space-y-6">
          {activeView !== "analytics" && activeView !== "brandkit" && activeView !== "mux" && (
            <ActionCards
              totalPlays={totalPlays}
              onUploadClick={() => setUploadOpen(true)}
              onFolderClick={() => setFolderOpen(true)}
            />
          )}

          {breadcrumbPath.length > 0 && activeView === "home" && (
            <nav className="flex items-center gap-1 text-sm text-muted-foreground">
              <button className="hover:text-foreground transition-colors" onClick={() => setCurrentFolderId(null)}>
                Wszystkie
              </button>
              {breadcrumbPath.map((item) => (
                <span key={item.id} className="flex items-center gap-1">
                  <ChevronRight className="h-3 w-3" />
                  <button
                    className={`hover:text-foreground transition-colors ${item.id === currentFolderId ? "text-foreground font-medium" : ""}`}
                    onClick={() => setCurrentFolderId(item.id)}
                  >
                    {item.name}
                  </button>
                </span>
              ))}
            </nav>
          )}

          {activeView !== "analytics" && activeView !== "brandkit" && activeView !== "mux" && bannerVisible && lastVideo && (
            <RecentBanner
              title={lastVideo.title}
              videoId={lastVideo.id}
              thumbnailUrl={lastVideo.thumbnail_url}
              lastEdited={new Date(lastVideo.created_at).toLocaleDateString("pl-PL")}
              onDismiss={() => setBannerVisible(false)}
            />
          )}

          {videosLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              Ładowanie...
            </div>
          ) : activeView === "analytics" ? (
            <AnalyticsView videos={videos} folders={folders} />
          ) : activeView === "brandkit" ? (
            <BrandKitView />
          ) : activeView === "users" && isAdmin ? (
            <AdminUsersView />
          ) : activeView === "mux" && isAdmin ? (
            <MuxSettingsView />
          ) : (
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <TopPlayedTable videos={filteredVideos} onDelete={deleteVideo} onToggleFavorite={toggleFavorite} />
              </div>
              <div>
                <RecentlyShared items={[]} />
              </div>
            </div>
          )}
        </main>
      </div>

      <UploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onFilesSelected={handleFilesSelected}
      />
      <CreateFolderDialog
        open={folderOpen}
        onOpenChange={setFolderOpen}
        existingNames={folders.map((f) => f.name)}
        onCreate={handleCreateFolder}
        parentFolderName={currentFolderName}
      />

      {hasItems && (
        <UploadQueue
          queue={queue}
          minimized={minimized}
          onToggleMinimize={() => setMinimized((m) => !m)}
          onClose={clearQueue}
          isActive={isActive}
          doneCount={doneCount}
          totalCount={totalCount}
          overallProgress={overallProgress}
        />
      )}
    </div>
  );
};

export default Dashboard;
