import { Play, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  title: string;
  lastEdited: string;
  onResume: () => void;
  onDismiss: () => void;
}

const RecentBanner = ({ title, lastEdited, onResume, onDismiss }: Props) => {
  return (
    <div className="relative rounded-xl bg-primary p-5 text-primary-foreground flex items-center justify-between gap-4">
      <div className="flex items-center gap-4 min-w-0">
        <div className="h-16 w-28 rounded-lg bg-primary-foreground/10 flex items-center justify-center shrink-0">
          <Play className="h-6 w-6 fill-primary-foreground" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider opacity-80">Ostatnio oglądany</p>
          <h3 className="font-semibold text-lg truncate">{title}</h3>
          <p className="text-sm opacity-70">Edytowano {lastEdited}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button
          onClick={onResume}
          variant="secondary"
          size="sm"
          className="gap-2 bg-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/30 border-0"
        >
          <Play className="h-3.5 w-3.5 fill-primary-foreground" />
          Wznów
        </Button>
        <button onClick={onDismiss} className="p-1.5 rounded-lg hover:bg-primary-foreground/10 transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default RecentBanner;
