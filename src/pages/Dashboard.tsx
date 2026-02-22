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

const mockVideos = [
  { id: 1, title: "Intro do projektu", created: "2026-02-18", plays: 142, engagement: 78 },
  { id: 2, title: "Tutorial – edycja wideo", created: "2026-02-15", plays: 89, engagement: 64 },
  { id: 3, title: "Spotkanie drużyny #12", created: "2026-02-10", plays: 34, engagement: 45 },
  { id: 4, title: "Demo produktu v2", created: "2026-02-08", plays: 256, engagement: 82 },
  { id: 5, title: "Prezentacja kwartalna", created: "2026-02-01", plays: 67, engagement: 55 },
  { id: 6, title: "Behind the scenes", created: "2026-01-28", plays: 198, engagement: 71 },
];

const mockShared = [
  { id: 1, title: "Demo produktu v2", sharedAt: "2 godz. temu", views: 48, link: "bighosting.app/s/demo-v2" },
  { id: 2, title: "Intro do projektu", sharedAt: "wczoraj", views: 22, link: "bighosting.app/s/intro" },
  { id: 3, title: "Behind the scenes", sharedAt: "3 dni temu", views: 15, link: "bighosting.app/s/bts" },
];

const totalPlays = mockVideos.reduce((sum, v) => sum + v.plays, 0);

const Dashboard = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [bannerVisible, setBannerVisible] = useState(true);
  const { isAuthenticated, userEmail } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated) navigate("/auth", { replace: true });
  }, [isAuthenticated, navigate]);

  return (
    <div className="min-h-screen flex bg-background">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <DashboardSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
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

        {/* Content */}
        <main className="flex-1 p-4 md:p-6 space-y-6">
          <ActionCards totalPlays={totalPlays} onUploadClick={() => setUploadOpen(true)} />

          {bannerVisible && (
            <RecentBanner
              title="Demo produktu v2"
              lastEdited="2 godz. temu"
              onResume={() => {}}
              onDismiss={() => setBannerVisible(false)}
            />
          )}

          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <TopPlayedTable videos={mockVideos} />
            </div>
            <div>
              <RecentlyShared items={mockShared} />
            </div>
          </div>
        </main>
      </div>

      <UploadDialog open={uploadOpen} onOpenChange={setUploadOpen} />
    </div>
  );
};

export default Dashboard;
