import { Upload } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const UploadDialog = ({ open, onOpenChange }: Props) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Dodaj film</DialogTitle>
          <DialogDescription>Przeciągnij plik lub kliknij, aby wybrać</DialogDescription>
        </DialogHeader>
        <div className="border-2 border-dashed border-border rounded-xl p-10 flex flex-col items-center gap-4 text-center">
          <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
            <Upload className="h-7 w-7 text-primary" />
          </div>
          <div>
            <p className="font-medium text-foreground">Przeciągnij plik tutaj</p>
            <p className="text-sm text-muted-foreground mt-1">MP4, MOV, AVI — maks. 2GB</p>
          </div>
          <Button variant="outline" size="sm">
            Wybierz plik
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UploadDialog;
