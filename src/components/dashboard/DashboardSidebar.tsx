import { useState } from "react";
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
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import type { FolderItem } from "@/hooks/useVideoStore";

type ViewType = "home" | "favorites" | "library" | "analytics";

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
  activeView: ViewType;
  onViewChange: (view: ViewType) => void;
  onDropVideo?: (videoId: string, folderId: string | null) => void;
  onDropFolder?: (folderId: string, targetParentId: string | null) => void;
}

const viewMap: Record<string, ViewType> = {
  Home: "home",
  Ulubione: "favorites",
  Biblioteka: "library",
  Analityka: "analytics",
};

const handleDragData = (e: React.DragEvent) => {
  const videoId = e.dataTransfer.getData("text/plain");
  const folderId = e.dataTransfer.getData("application/folder-id");
  return { videoId, folderId };
};

const DashboardSidebar = ({ open, onClose, folders = [], currentFolderId, onFolderSelect, onDeleteFolder, activeView, onViewChange, onDropVideo, onDropFolder }: Props) => {
  const { userEmail, logout } = useAuth();
  const navigate = useNavigate();

  const handleHomeDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.remove("ring-2", "ring-primary/40", "bg-primary/10");
    const { videoId, folderId } = handleDragData(e);
    if (folderId && onDropFolder) onDropFolder(folderId, null);
    else if (videoId && onDropVideo) onDropVideo(videoId, null);
  };

  return (
    <aside
      className={`fixed md:sticky top-0 left-0 z-50 md:z-auto h-screen w-60 border-r border-sidebar-border bg-sidebar flex flex-col transition-transform md:translate-x-0 ${
        open ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div className="flex items-center justify-between h-16 px-4 border-b border-sidebar-border">
        <Link to="/" className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Play className="h-3.5 w-3.5 text-primary-foreground fill-primary-foreground" />
          </div>
          <span className="font-bold text-foreground tracking-tight">Big Hosting</span>
        </Link>
        <button onClick={onClose} className="md:hidden text-sidebar-foreground">
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const view = viewMap[item.label];
          const isActive = view ? activeView === view && currentFolderId === null : false;
          const isHome = item.label === "Home";
          return (
            <button
              key={item.label}
              onClick={() => { if (view) onViewChange(view); }}
              onDragOver={isHome ? (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; e.currentTarget.classList.add("ring-2", "ring-primary/40", "bg-primary/10"); } : undefined}
              onDragLeave={isHome ? (e) => { e.currentTarget.classList.remove("ring-2", "ring-primary/40", "bg-primary/10"); } : undefined}
              onDrop={isHome ? handleHomeDrop : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? "bg-primary/10 text-primary border-l-2 border-primary"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </button>
          );
        })}

        {folders.length > 0 && (
          <div className="pt-4">
            <p className="px-3 pb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Foldery</p>
            <FolderTree
              folders={folders}
              parentId={null}
              depth={0}
              currentFolderId={currentFolderId}
              onFolderSelect={onFolderSelect}
              onDeleteFolder={onDeleteFolder}
              onDropVideo={onDropVideo}
              onDropFolder={onDropFolder}
            />
          </div>
        )}
      </nav>

      <div className="p-4 border-t border-sidebar-border space-y-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground text-xs font-bold">
              MR
            </AvatarFallback>
          </Avatar>
          <div className="text-sm min-w-0">
            <p className="font-medium text-foreground truncate">{userEmail}</p>
            <p className="text-xs text-muted-foreground">Admin</p>
          </div>
        </div>
        <button
          onClick={() => { logout(); navigate("/auth"); }}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Wyloguj się
        </button>
      </div>
    </aside>
  );
};

// Recursive folder tree component
const FolderTree = ({
  folders,
  parentId,
  depth,
  currentFolderId,
  onFolderSelect,
  onDeleteFolder,
  onDropVideo,
  onDropFolder,
}: {
  folders: FolderItem[];
  parentId: string | null;
  depth: number;
  currentFolderId: string | null;
  onFolderSelect: (id: string | null) => void;
  onDeleteFolder: (id: string) => void;
  onDropVideo?: (videoId: string, folderId: string | null) => void;
  onDropFolder?: (folderId: string, targetParentId: string | null) => void;
}) => {
  const children = folders.filter((f) => (f.parent_id ?? null) === parentId);
  if (children.length === 0) return null;

  return (
    <>
      {children.map((folder) => {
        const hasChildren = folders.some((f) => f.parent_id === folder.id);
        return (
          <FolderTreeItem
            key={folder.id}
            folder={folder}
            folders={folders}
            depth={depth}
            hasChildren={hasChildren}
            currentFolderId={currentFolderId}
            onFolderSelect={onFolderSelect}
            onDeleteFolder={onDeleteFolder}
            onDropVideo={onDropVideo}
            onDropFolder={onDropFolder}
          />
        );
      })}
    </>
  );
};

const FolderTreeItem = ({
  folder,
  folders,
  depth,
  hasChildren,
  currentFolderId,
  onFolderSelect,
  onDeleteFolder,
  onDropVideo,
  onDropFolder,
}: {
  folder: FolderItem;
  folders: FolderItem[];
  depth: number;
  hasChildren: boolean;
  currentFolderId: string | null;
  onFolderSelect: (id: string | null) => void;
  onDeleteFolder: (id: string) => void;
  onDropVideo?: (videoId: string, folderId: string | null) => void;
  onDropFolder?: (folderId: string, targetParentId: string | null) => void;
}) => {
  const [expanded, setExpanded] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const isActive = currentFolderId === folder.id;

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("application/folder-id", folder.id);
    e.dataTransfer.effectAllowed = "move";
    (e.currentTarget as HTMLElement).style.opacity = "0.5";
  };

  const handleDragEnd = (e: React.DragEvent) => {
    (e.currentTarget as HTMLElement).style.opacity = "1";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOver(true);
  };
  const handleDragLeave = () => setDragOver(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const droppedFolderId = e.dataTransfer.getData("application/folder-id");
    const videoId = e.dataTransfer.getData("text/plain");
    if (droppedFolderId && onDropFolder) {
      onDropFolder(droppedFolderId, folder.id);
    } else if (videoId && onDropVideo) {
      onDropVideo(videoId, folder.id);
    }
  };

  const itemClasses = `group flex items-center gap-2 py-2 rounded-lg text-sm cursor-pointer transition-all ${
    dragOver ? "bg-primary/15 ring-2 ring-primary/40" : isActive ? "bg-primary/10 text-primary font-medium border-l-2 border-primary" : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
  }`;

  if (!hasChildren) {
    return (
      <div
        className={itemClasses}
        style={{ paddingLeft: `${12 + depth * 16}px`, paddingRight: 12 }}
        onClick={() => onFolderSelect(folder.id)}
        draggable
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <Folder className="h-4 w-4 shrink-0" />
        <span className="truncate flex-1">{folder.name}</span>
        <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
          onClick={(e) => { e.stopPropagation(); onDeleteFolder(folder.id); }}>
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <div
        className={`group flex items-center gap-1 py-2 rounded-lg text-sm cursor-pointer transition-all ${
          dragOver ? "bg-primary/15 ring-2 ring-primary/40" : isActive ? "bg-primary/10 text-primary font-medium border-l-2 border-primary" : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
        }`}
        style={{ paddingLeft: `${12 + depth * 16}px`, paddingRight: 12 }}
        draggable
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <CollapsibleTrigger asChild>
          <button className="shrink-0 p-0.5" onClick={(e) => e.stopPropagation()}>
            {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
        </CollapsibleTrigger>
        <div className="flex items-center gap-2 flex-1 min-w-0" onClick={() => onFolderSelect(folder.id)}>
          <Folder className="h-4 w-4 shrink-0" />
          <span className="truncate flex-1">{folder.name}</span>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
          onClick={(e) => { e.stopPropagation(); onDeleteFolder(folder.id); }}>
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
      <CollapsibleContent>
          <FolderTree
          folders={folders}
          parentId={folder.id}
          depth={depth + 1}
          currentFolderId={currentFolderId}
          onFolderSelect={onFolderSelect}
          onDeleteFolder={onDeleteFolder}
          onDropVideo={onDropVideo}
          onDropFolder={onDropFolder}
        />
      </CollapsibleContent>
    </Collapsible>
  );
};

export default DashboardSidebar;
