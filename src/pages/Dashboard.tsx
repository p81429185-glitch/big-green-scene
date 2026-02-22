import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Play,
  FolderOpen,
  Settings,
  Plus,
  LayoutGrid,
  List,
  Eye,
  Calendar,
  Film,
  Menu,
  X,
} from "lucide-react";

const mockVideos = [
  { id: 1, title: "Intro do projektu", views: 142, date: "2026-02-18", duration: "2:34" },
  { id: 2, title: "Tutorial – edycja wideo", views: 89, date: "2026-02-15", duration: "8:12" },
  { id: 3, title: "Spotkanie drużyny #12", views: 34, date: "2026-02-10", duration: "45:01" },
  { id: 4, title: "Demo produktu v2", views: 256, date: "2026-02-08", duration: "5:48" },
  { id: 5, title: "Prezentacja kwartalna", views: 67, date: "2026-02-01", duration: "22:15" },
  { id: 6, title: "Behind the scenes", views: 198, date: "2026-01-28", duration: "3:22" },
];

const navItems = [
  { icon: Film, label: "Filmy", active: true },
  { icon: FolderOpen, label: "Foldery", active: false },
  { icon: Settings, label: "Ustawienia", active: false },
];

const Dashboard = () => {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen flex bg-background">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed md:sticky top-0 left-0 z-50 md:z-auto h-screen w-60 border-r bg-sidebar flex flex-col transition-transform md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between h-16 px-4 border-b">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center">
              <Play className="h-3.5 w-3.5 text-primary-foreground fill-primary-foreground" />
            </div>
            <span className="font-bold text-sidebar-foreground">Big Hosting</span>
          </Link>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden text-sidebar-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.label}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                item.active
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/60"
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t">
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                JK
              </AvatarFallback>
            </Avatar>
            <div className="text-sm">
              <p className="font-medium text-sidebar-foreground">Jan Kowalski</p>
              <p className="text-xs text-muted-foreground">Admin</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-16 border-b flex items-center justify-between px-4 md:px-6 bg-background sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden text-foreground"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="text-lg font-semibold text-foreground">Moje filmy</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center border rounded-lg">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-2 ${viewMode === "grid" ? "bg-muted text-foreground" : "text-muted-foreground"}`}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-2 ${viewMode === "list" ? "bg-muted text-foreground" : "text-muted-foreground"}`}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Dodaj film</span>
            </Button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-4 md:p-6">
          {viewMode === "grid" ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {mockVideos.map((video) => (
                <div
                  key={video.id}
                  className="group rounded-xl border bg-card overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                >
                  {/* Thumbnail */}
                  <div className="aspect-video bg-muted relative flex items-center justify-center">
                    <div className="h-12 w-12 rounded-full bg-primary/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Play className="h-5 w-5 text-primary-foreground fill-primary-foreground ml-0.5" />
                    </div>
                    <span className="absolute bottom-2 right-2 text-xs bg-foreground/80 text-background px-1.5 py-0.5 rounded">
                      {video.duration}
                    </span>
                  </div>
                  {/* Info */}
                  <div className="p-4">
                    <h3 className="font-medium text-card-foreground mb-2 truncate">
                      {video.title}
                    </h3>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Eye className="h-3.5 w-3.5" />
                        {video.views}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {video.date}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="border rounded-xl overflow-hidden bg-card">
              {mockVideos.map((video, i) => (
                <div
                  key={video.id}
                  className={`flex items-center gap-4 p-4 hover:bg-muted/50 cursor-pointer transition-colors ${
                    i !== mockVideos.length - 1 ? "border-b" : ""
                  }`}
                >
                  <div className="h-16 w-28 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <Play className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-card-foreground truncate">{video.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{video.duration}</p>
                  </div>
                  <div className="hidden sm:flex items-center gap-6 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Eye className="h-3.5 w-3.5" />
                      {video.views}
                    </span>
                    <span>{video.date}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
