import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Film, Play, HardDrive, Heart } from "lucide-react";
import type { VideoItem, FolderItem } from "@/hooks/useVideoStore";

interface Props {
  videos: VideoItem[];
  folders: FolderItem[];
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(2)} GB`;
}

const AnalyticsView = ({ videos, folders }: Props) => {
  const totalPlays = videos.reduce((s, v) => s + v.plays, 0);
  const totalSize = videos.reduce((s, v) => s + v.size, 0);
  const totalFavorites = videos.filter((v) => v.is_favorite).length;

  const top5 = [...videos].sort((a, b) => b.plays - a.plays).slice(0, 5).map((v) => ({
    name: v.title.length > 20 ? v.title.slice(0, 20) + "…" : v.title,
    plays: v.plays,
  }));

  const folderStats = folders.map((f) => {
    const fVideos = videos.filter((v) => v.folder_id === f.id);
    return { name: f.name, videos: fVideos.length, plays: fVideos.reduce((s, v) => s + v.plays, 0) };
  });

  const unassigned = videos.filter((v) => !v.folder_id);
  if (unassigned.length > 0) {
    folderStats.push({ name: "Bez folderu", videos: unassigned.length, plays: unassigned.reduce((s, v) => s + v.plays, 0) });
  }

  const stats = [
    { icon: Film, label: "Filmy", value: videos.length, color: "from-primary/20 to-primary/5" },
    { icon: Play, label: "Odtworzenia", value: totalPlays, color: "from-accent/20 to-accent/5" },
    { icon: HardDrive, label: "Rozmiar", value: formatSize(totalSize), color: "from-primary/20 to-accent/5" },
    { icon: Heart, label: "Ulubione", value: totalFavorites, color: "from-red-500/20 to-red-500/5" },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-foreground">Analityka</h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-border/50 bg-card/80 backdrop-blur-sm p-4 flex flex-col items-center gap-2">
            <div className={`h-10 w-10 rounded-full bg-gradient-to-br ${s.color} flex items-center justify-center`}>
              <s.icon className="h-5 w-5 text-primary" />
            </div>
            <p className="text-2xl font-bold text-card-foreground">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {top5.length > 0 && (
        <div className="rounded-xl border border-border/50 bg-card/80 backdrop-blur-sm p-4">
          <h3 className="font-semibold text-card-foreground mb-4">Top 5 najczęściej odtwarzanych</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={top5}>
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={{ stroke: "hsl(var(--border))" }} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={{ stroke: "hsl(var(--border))" }} tickLine={false} />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", color: "hsl(var(--foreground))" }} />
              <Bar dataKey="plays" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {folderStats.length > 0 && (
        <div className="rounded-xl border border-border/50 bg-card/80 backdrop-blur-sm p-4">
          <h3 className="font-semibold text-card-foreground mb-3">Statystyki folderów</h3>
          <div className="space-y-2">
            {folderStats.map((f) => (
              <div key={f.name} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                <span className="text-sm text-card-foreground">{f.name}</span>
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <span>{f.videos} filmów</span>
                  <span>{f.plays} odtworzeń</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalyticsView;
