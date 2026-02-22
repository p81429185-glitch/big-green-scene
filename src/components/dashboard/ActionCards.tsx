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
