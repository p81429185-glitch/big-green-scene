import { Play, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface Props {
  title: string;
  videoId: string;
  thumbnailUrl?: string | null;
  lastEdited: string;
  onDismiss: () => void;
}

const RecentBanner = ({ title, videoId, thumbnailUrl, lastEdited, onDismiss }: Props) => {
  const navigate = useNavigate();

  return (
    <div className="relative rounded-xl bg-gradient-to-r from-primary via-primary/90 to-accent p-5 text-primary-foreground flex items-center justify-between gap-4 shadow-lg shadow-primary/20 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-transparent to-accent/20" />
      <div className="flex items-center gap-4 min-w-0 relative z-10">
        <div className="h-16 w-28 rounded-lg bg-primary-foreground/10 flex items-center justify-center shrink-0 overflow-hidden backdrop-blur-sm">
          {thumbnailUrl ? (
            <img src={thumbnailUrl} alt={title} className="h-full w-full object-cover" />
          ) : (
            <Play className="h-6 w-6 fill-primary-foreground" />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider opacity-80">Ostatnio dodany</p>
          <h3 className="font-semibold text-lg truncate">{title}</h3>
          <p className="text-sm opacity-70">{lastEdited}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 relative z-10">
        <Button
          onClick={() => navigate(`/video/${videoId}`)}
          variant="secondary"
          size="sm"
          className="gap-2 bg-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/30 border-0 backdrop-blur-sm"
        >
          <Play className="h-3.5 w-3.5 fill-primary-foreground" />
          Oglądaj
        </Button>
        <button onClick={onDismiss} className="p-1.5 rounded-lg hover:bg-primary-foreground/10 transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default RecentBanner;
