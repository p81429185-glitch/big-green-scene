import { Upload, Video, FolderPlus, Radio, TrendingUp } from "lucide-react";

interface Props {
  totalPlays: number;
  onUploadClick: () => void;
}

const ActionCards = ({ totalPlays, onUploadClick }: Props) => {
  const actions = [
    { icon: TrendingUp, label: `${totalPlays} odtworzeń`, sublabel: "w tym tygodniu", onClick: undefined, highlight: false },
    { icon: Upload, label: "Upload", sublabel: "Dodaj film", onClick: onUploadClick, highlight: true },
    { icon: Video, label: "Nagraj", sublabel: "Nowe nagranie", onClick: undefined, highlight: false },
    { icon: FolderPlus, label: "Folder", sublabel: "Nowy folder", onClick: undefined, highlight: false },
    { icon: Radio, label: "Kanał", sublabel: "Nowy kanał", onClick: undefined, highlight: false },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {actions.map((action) => (
        <button
          key={action.label}
          onClick={action.onClick}
          className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all hover:shadow-md ${
            action.highlight
              ? "bg-primary text-primary-foreground border-primary hover:bg-primary/90"
              : "bg-card text-card-foreground hover:bg-muted/50"
          }`}
        >
          <action.icon className="h-6 w-6" />
          <div className="text-center">
            <p className="text-sm font-semibold">{action.label}</p>
            <p className={`text-xs ${action.highlight ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
              {action.sublabel}
            </p>
          </div>
        </button>
      ))}
    </div>
  );
};

export default ActionCards;
