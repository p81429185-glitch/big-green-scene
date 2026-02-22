import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Home,
  Heart,
  Library,
  BarChart3,
  Play,
  LogOut,
  X,
  Folder,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { FolderItem } from "@/hooks/useVideoStore";

const navItems = [
  { icon: Home, label: "Home" },
  { icon: Heart, label: "Ulubione" },
  { icon: Library, label: "Biblioteka" },
  { icon: BarChart3, label: "Analityka" },
];

interface Props {
  open: boolean;
  onClose: () => void;
  folders: FolderItem[];
  currentFolderId: string | null;
  onFolderSelect: (id: string | null) => void;
  onDeleteFolder: (id: string) => void;
}

const DashboardSidebar = ({ open, onClose, folders, currentFolderId, onFolderSelect, onDeleteFolder }: Props) => {
  const { userEmail, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <aside
      className={`fixed md:sticky top-0 left-0 z-50 md:z-auto h-screen w-60 border-r bg-sidebar flex flex-col transition-transform md:translate-x-0 ${
        open ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div className="flex items-center justify-between h-16 px-4 border-b">
        <Link to="/" className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center">
            <Play className="h-3.5 w-3.5 text-primary-foreground fill-primary-foreground" />
          </div>
          <span className="font-bold text-sidebar-foreground">Big Hosting</span>
        </Link>
        <button onClick={onClose} className="md:hidden text-sidebar-foreground">
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <button
            key={item.label}
            onClick={() => { if (item.label === "Home") onFolderSelect(null); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              item.label === "Home" && currentFolderId === null
                ? "bg-sidebar-accent text-sidebar-primary"
                : "text-sidebar-foreground hover:bg-sidebar-accent/60"
            }`}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </button>
        ))}

        {folders.length > 0 && (
          <div className="pt-4">
            <p className="px-3 pb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Foldery</p>
            {folders.map((folder) => (
              <div
                key={folder.id}
                className={`group flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors ${
                  currentFolderId === folder.id
                    ? "bg-sidebar-accent text-sidebar-primary font-medium"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/60"
                }`}
                onClick={() => onFolderSelect(folder.id)}
              >
                <Folder className="h-4 w-4 shrink-0" />
                <span className="truncate flex-1">{folder.name}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                  onClick={(e) => { e.stopPropagation(); onDeleteFolder(folder.id); }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </nav>

      <div className="p-4 border-t space-y-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary text-primary-foreground text-xs">
              MR
            </AvatarFallback>
          </Avatar>
          <div className="text-sm min-w-0">
            <p className="font-medium text-sidebar-foreground truncate">{userEmail}</p>
            <p className="text-xs text-muted-foreground">Admin</p>
          </div>
        </div>
        <button
          onClick={() => { logout(); navigate("/auth"); }}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-sidebar-accent/60 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Wyloguj się
        </button>
      </div>
    </aside>
  );
};

export default DashboardSidebar;
