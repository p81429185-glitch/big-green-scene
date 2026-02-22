import { Upload, FolderPlus, TrendingUp } from "lucide-react";

interface Props {
  totalPlays: number;
  onUploadClick: () => void;
  onFolderClick: () => void;
}

const ActionCards = ({ totalPlays, onUploadClick, onFolderClick }: Props) => {
  const actions = [
    { icon: TrendingUp, label: `${totalPlays} odtworzeń`, sublabel: "w tym tygodniu", onClick: undefined, highlight: false },
    { icon: Upload, label: "Upload", sublabel: "Dodaj film", onClick: onUploadClick, highlight: true },
    { icon: FolderPlus, label: "Folder", sublabel: "Nowy folder", onClick: onFolderClick, highlight: false },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {actions.map((action) => (
        <button
          key={action.label}
          onClick={action.onClick}
          className={`flex flex-col items-center gap-2 p-5 rounded-xl border transition-all duration-300 ${
            action.highlight
              ? "bg-gradient-to-br from-primary to-accent text-primary-foreground border-primary/30 hover:shadow-lg hover:shadow-primary/20 hover:scale-[1.02]"
              : "bg-card border-border/50 text-card-foreground hover:bg-card/80 hover:border-primary/20 hover:shadow-md"
          }`}
        >
          <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
            action.highlight ? "bg-primary-foreground/20" : "bg-primary/10"
          }`}>
            <action.icon className={`h-5 w-5 ${action.highlight ? "" : "text-primary"}`} />
          </div>
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
