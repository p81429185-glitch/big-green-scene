import { useRef, useState } from "react";
import { useBrandSettings } from "@/hooks/useBrandSettings";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";

const FONT_OPTIONS = ["Inter", "Roboto", "Open Sans", "Lato", "Montserrat", "Poppins"];

const COLOR_FIELDS = [
  { key: "player_color" as const, label: "Pasek kontrolny" },
  { key: "icon_color" as const, label: "Ikony" },
  { key: "progress_color" as const, label: "Postęp" },
  { key: "play_bg_color" as const, label: "Tło play" },
  { key: "skip_bg_color" as const, label: "Tło skip 15s" },
] as const;

const VideoCustomizeTab = () => {
  const { settings, updateSetting, uploadLogo, removeLogo } = useBrandSettings();
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const url = await uploadLogo(file);
    if (url) {
      updateSetting("logo_url", url);
      toast.success("Logo przesłane");
    } else {
      toast.error("Błąd przesyłania logo");
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const hexForColorInput = (val: string) => {
    if (val.startsWith("#") && (val.length === 7 || val.length === 4)) return val;
    if (val.startsWith("rgba")) {
      const m = val.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (m) return "#" + [m[1], m[2], m[3]].map((n) => parseInt(n).toString(16).padStart(2, "0")).join("");
    }
    return "#16a34a";
  };

  const handleColorChange = (key: typeof COLOR_FIELDS[number]["key"], value: string) => {
    if (key === "play_bg_color") {
      const r = parseInt(value.slice(1, 3), 16);
      const g = parseInt(value.slice(3, 5), 16);
      const b = parseInt(value.slice(5, 7), 16);
      updateSetting(key, `rgba(${r},${g},${b},0.8)`);
    } else if (key === "skip_bg_color") {
      const r = parseInt(value.slice(1, 3), 16);
      const g = parseInt(value.slice(3, 5), 16);
      const b = parseInt(value.slice(5, 7), 16);
      updateSetting(key, `rgba(${r},${g},${b},0.45)`);
    } else {
      updateSetting(key, value);
    }
  };

  return (
    <div className="space-y-6 py-4">
      {/* Logo */}
      <section className="space-y-2">
        <Label className="text-sm font-semibold">Logo</Label>
        <div className="flex items-center gap-3">
          {settings.logo_url ? (
            <div className="flex items-center gap-2">
              <img src={settings.logo_url} alt="Logo" className="h-8 max-w-[120px] object-contain rounded border border-border p-1" />
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => fileRef.current?.click()}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { removeLogo(); toast.success("Logo usunięte"); }}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
              <Upload className="h-4 w-4 mr-1.5" />
              {uploading ? "Przesyłanie..." : "Prześlij logo"}
            </Button>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
      </section>

      {/* Colors */}
      <section className="space-y-2">
        <Label className="text-sm font-semibold">Kolory</Label>
        <div className="grid grid-cols-2 gap-3">
          {COLOR_FIELDS.map((field) => (
            <div key={field.key} className="flex items-center gap-2">
              <label className="cursor-pointer">
                <input
                  type="color"
                  value={hexForColorInput(settings[field.key])}
                  onChange={(e) => handleColorChange(field.key, e.target.value)}
                  className="sr-only"
                />
                <div
                  className="w-8 h-8 rounded-md border border-border shrink-0"
                  style={{ background: settings[field.key] }}
                />
              </label>
              <span className="text-xs text-muted-foreground">{field.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Font */}
      <section className="space-y-2">
        <Label className="text-sm font-semibold">Czcionka</Label>
        <Select value={settings.font_family} onValueChange={(v) => updateSetting("font_family", v)}>
          <SelectTrigger className="h-9 w-full max-w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FONT_OPTIONS.map((f) => (
              <SelectItem key={f} value={f}>{f}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </section>
    </div>
  );
};

export default VideoCustomizeTab;
