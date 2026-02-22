import { Play, Eye } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Video {
  id: number;
  title: string;
  created: string;
  plays: number;
  engagement: number;
}

interface Props {
  videos: Video[];
}

const TopPlayedTable = ({ videos }: Props) => {
  return (
    <div className="rounded-xl border bg-card">
      <div className="p-4 border-b">
        <h2 className="font-semibold text-card-foreground">Najczęściej odtwarzane filmy</h2>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12" />
            <TableHead>Tytuł</TableHead>
            <TableHead className="hidden sm:table-cell">Data</TableHead>
            <TableHead className="text-right">Odtworzenia</TableHead>
            <TableHead className="text-right hidden md:table-cell">Engagement</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {videos.map((video) => (
            <TableRow key={video.id} className="cursor-pointer">
              <TableCell>
                <div className="h-9 w-14 rounded bg-muted flex items-center justify-center">
                  <Play className="h-3 w-3 text-muted-foreground" />
                </div>
              </TableCell>
              <TableCell className="font-medium">{video.title}</TableCell>
              <TableCell className="hidden sm:table-cell text-muted-foreground text-xs">{video.created}</TableCell>
              <TableCell className="text-right">
                <span className="flex items-center justify-end gap-1 text-sm">
                  <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                  {video.plays}
                </span>
              </TableCell>
              <TableCell className="text-right hidden md:table-cell">
                <span className="text-sm text-muted-foreground">{video.engagement}%</span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default TopPlayedTable;
