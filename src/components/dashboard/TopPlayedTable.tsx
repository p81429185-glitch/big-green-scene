import { Play, Trash2, FileVideo } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import type { VideoItem } from "@/hooks/useVideoStore";

interface Props {
  videos: VideoItem[];
  onDelete: (id: string) => void;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(2)} GB`;
}

const TopPlayedTable = ({ videos, onDelete }: Props) => {
  if (videos.length === 0) {
    return (
      <div className="rounded-xl border bg-card flex flex-col items-center justify-center py-16 gap-4">
        <FileVideo className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground font-medium">Brak filmów — dodaj pierwszy!</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card">
      <div className="p-4 border-b">
        <h2 className="font-semibold text-card-foreground">Twoje filmy</h2>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12" />
            <TableHead>Tytuł</TableHead>
            <TableHead className="hidden sm:table-cell">Rozmiar</TableHead>
            <TableHead className="hidden sm:table-cell">Data</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {videos.map((video) => (
            <TableRow key={video.id}>
              <TableCell>
                <div className="h-9 w-14 rounded bg-muted flex items-center justify-center">
                  <Play className="h-3 w-3 text-muted-foreground" />
                </div>
              </TableCell>
              <TableCell>
                <p className="font-medium">{video.title}</p>
                <p className="text-xs text-muted-foreground">{video.fileName}</p>
              </TableCell>
              <TableCell className="hidden sm:table-cell text-muted-foreground text-xs">
                {formatSize(video.size)}
              </TableCell>
              <TableCell className="hidden sm:table-cell text-muted-foreground text-xs">
                {new Date(video.createdAt).toLocaleDateString("pl-PL")}
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => onDelete(video.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default TopPlayedTable;
