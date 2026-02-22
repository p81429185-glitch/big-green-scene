import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingNames: string[];
  onCreate: (name: string) => void;
  parentFolderName?: string;
}

const CreateFolderDialog = ({ open, onOpenChange, existingNames, onCreate, parentFolderName }: Props) => {
  const [name, setName] = useState("");
  const trimmed = name.trim();
  const duplicate = existingNames.some((n) => n.toLowerCase() === trimmed.toLowerCase());

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trimmed || duplicate) return;
    onCreate(trimmed);
    setName("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{parentFolderName ? "Nowy podfolder" : "Nowy folder"}</DialogTitle>
          <DialogDescription>
            {parentFolderName ? `Tworzysz podfolder w: ${parentFolderName}` : "Podaj nazwę folderu"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="folder-name">Nazwa</Label>
            <Input
              id="folder-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="np. Tutoriale"
              autoFocus
            />
            {duplicate && (
              <p className="text-xs text-destructive">Folder o tej nazwie już istnieje</p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Anuluj
            </Button>
            <Button type="submit" disabled={!trimmed || duplicate}>
              Utwórz
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateFolderDialog;
