import { Play, Link2, Eye, Clock } from "lucide-react";

interface SharedItem {
  id: number;
  title: string;
  sharedAt: string;
  views: number;
  link: string;
}

interface Props {
  items: SharedItem[];
}

const RecentlyShared = ({ items }: Props) => {
  return (
    <div className="rounded-xl border bg-card">
      <div className="p-4 border-b">
        <h2 className="font-semibold text-card-foreground">Ostatnio udostępnione</h2>
      </div>
      <div className="divide-y">
        {items.map((item) => (
          <div key={item.id} className="p-4 hover:bg-muted/30 transition-colors cursor-pointer">
            <div className="flex gap-3">
              <div className="h-12 w-20 rounded bg-muted flex items-center justify-center shrink-0">
                <Play className="h-3 w-3 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-medium truncate">{item.title}</h4>
                <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                  <Link2 className="h-3 w-3" />
                  <span className="truncate">{item.link}</span>
                </div>
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Eye className="h-3 w-3" />
                    {item.views}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {item.sharedAt}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RecentlyShared;
