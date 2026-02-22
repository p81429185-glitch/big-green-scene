import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Search, Menu } from "lucide-react";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import ActionCards from "@/components/dashboard/ActionCards";
import RecentBanner from "@/components/dashboard/RecentBanner";
import TopPlayedTable from "@/components/dashboard/TopPlayedTable";
import RecentlyShared from "@/components/dashboard/RecentlyShared";
import UploadDialog from "@/components/dashboard/UploadDialog";
import UploadQueue from "@/components/dashboard/UploadQueue";
import CreateFolderDialog from "@/components/dashboard/CreateFolderDialog";
import { useVideoStore } from "@/hooks/useVideoStore";
import { useUploadQueue } from "@/hooks/useUploadQueue";

const Dashboard = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [folderOpen, setFolderOpen] = useState(false);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [bannerVisible, setBannerVisible] = useState(true);
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState<"home" | "favorites" | "library">("home");
  const { videos, folders, loading, uploadVideo, deleteVideo, toggleFavorite, createFolder, deleteFolder } = useVideoStore();

  const {
    queue, minimized, setMinimized, addFiles, clearQueue,
    isActive, hasItems, doneCount, totalCount, overallProgress,
  } = useUploadQueue({ uploadVideo });

  useEffect(() => {
    if (!isAuthenticated) navigate("/auth", { replace: true });
  }, [isAuthenticated, navigate]);

  const filteredVideos = activeView === "favorites"
    ? videos.filter((v) => v.is_favorite)
    : activeView === "library"
      ? videos
      : currentFolderId
        ? videos.filter((v) => v.folder_id === currentFolderId)
        : videos;

  const totalPlays = videos.reduce((sum, v) => sum + v.plays, 0);
  const lastVideo = videos.length > 0 ? videos[0] : null;

  const handleFilesSelected = (files: File[]) => {
    addFiles(files, currentFolderId);
  };

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
        onViewChange={(view) => { setActiveView(view); if (view !== "home") setCurrentFolderId(null); }}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b flex items-center justify-between px-4 md:px-6 bg-background sticky top-0 z-30">
          <div className="flex items-center gap-3 flex-1">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden text-foreground">
              <Menu className="h-5 w-5" />
            </button>
            <div className="relative max-w-sm w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Szukaj filmów..." className="pl-9 h-9" />
            </div>
          </div>
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary text-primary-foreground text-xs">MR</AvatarFallback>
          </Avatar>
        </header>

        <main className="flex-1 p-4 md:p-6 space-y-6">
          <ActionCards
            totalPlays={totalPlays}
            onUploadClick={() => setUploadOpen(true)}
            onFolderClick={() => setFolderOpen(true)}
          />

          {bannerVisible && lastVideo && (
            <RecentBanner
              title={lastVideo.title}
              videoId={lastVideo.id}
              thumbnailUrl={lastVideo.thumbnail_url}
              lastEdited={new Date(lastVideo.created_at).toLocaleDateString("pl-PL")}
              onDismiss={() => setBannerVisible(false)}
            />
          )}

          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              Ładowanie...
            </div>
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
        onCreate={createFolder}
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
