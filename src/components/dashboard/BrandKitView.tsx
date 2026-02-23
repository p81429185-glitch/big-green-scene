import { useState, useRef } from "react";
import { useBrandSettings } from "@/hooks/useBrandSettings";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Trash2, Pencil, Plus, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

const FONT_OPTIONS = ["Inter", "Roboto", "Open Sans", "Lato", "Montserrat", "Poppins"];

const COLOR_FIELDS = [
  { key: "player_color" as const, label: "Player Color", desc: "Kolor paska kontrolnego" },
  { key: "icon_color" as const, label: "Icon Color", desc: "Kolor ikon i przycisków" },
  { key: "progress_color" as const, label: "Progress Color", desc: "Kolor paska postępu" },
  { key: "play_bg_color" as const, label: "Play BG Color", desc: "Tło przycisku play" },
  { key: "skip_bg_color" as const, label: "Skip BG Color", desc: "Tło przycisków skip 15s" },
];

const BrandKitView = () => {
  const { settings, updateSetting, uploadLogo, removeLogo } = useBrandSettings();
  const [uploading, setUploading] = useState(false);
  const [editingColor, setEditingColor] = useState<string | null>(null);
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
      if (m) {
        const hex = "#" + [m[1], m[2], m[3]].map((n) => parseInt(n).toString(16).padStart(2, "0")).join("");
        return hex;
      }
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
    <div className="space-y-8 max-w-4xl">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Brand Kit</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Skonfiguruj globalny branding dla wszystkich embedów. Ustawienia zostaną automatycznie zastosowane.
        </p>
      </div>

      {/* LOGOS */}
      <section className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">Logos</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {settings.logo_url ? (
            <Card className="relative group flex items-center justify-center p-6 bg-muted/30">
              <img src={settings.logo_url} alt="Logo" className="max-h-20 max-w-full object-contain" />
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => fileRef.current?.click()}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { removeLogo(); toast.success("Logo usunięte"); }}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </Card>
          ) : null}

          <Card
            className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-border hover:border-primary/50 cursor-pointer transition-colors min-h-[120px]"
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? (
              <p className="text-sm text-muted-foreground">Przesyłanie...</p>
            ) : (
              <>
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mb-2">
                  <Upload className="h-5 w-5 text-muted-foreground" />
                </div>
                <span className="text-sm font-medium text-foreground">Upload</span>
                <span className="text-xs text-muted-foreground mt-0.5">SVG, PNG, JPG</span>
              </>
            )}
          </Card>
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
      </section>

      {/* COLORS */}
      <section className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">Colors</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {COLOR_FIELDS.map((field) => {
            const colorVal = settings[field.key];
            const hexVal = hexForColorInput(colorVal);
            return (
              <Card key={field.key} className="relative group p-0 overflow-hidden">
                <div className="h-20 w-full" style={{ background: colorVal }} />
                <div className="p-3 space-y-1">
                  <p className="text-sm font-medium text-foreground">{field.label}</p>
                  <p className="text-xs text-muted-foreground font-mono">{colorVal}</p>
                </div>
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <label className="cursor-pointer">
                    <input
                      type="color"
                      value={hexVal}
                      onChange={(e) => handleColorChange(field.key, e.target.value)}
                      className="sr-only"
                    />
                    <div className="h-7 w-7 rounded-md bg-background/80 backdrop-blur flex items-center justify-center hover:bg-background">
                      <Pencil className="h-3.5 w-3.5" />
                    </div>
                  </label>
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      {/* FONTS */}
      <section className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">Fonts</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Card className="p-4 space-y-2">
            <p className="text-sm font-medium text-foreground">Czcionka playera</p>
            <Select value={settings.font_family} onValueChange={(v) => updateSetting("font_family", v)}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FONT_OPTIONS.map((f) => (
                  <SelectItem key={f} value={f}>{f}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-2xl mt-2" style={{ fontFamily: settings.font_family }}>
              Aa Bb Cc 123
            </p>
          </Card>
        </div>
      </section>

      {/* LIVE PREVIEW */}
      <section className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">Podgląd playera</h3>
        <div className="rounded-lg overflow-hidden bg-black aspect-video border border-border relative max-w-lg">
          <div className="w-full h-full bg-neutral-900 flex items-center justify-center">
            <ImageIcon className="h-12 w-12 text-neutral-700" />
          </div>
          {settings.logo_url && (
            <img src={settings.logo_url} alt="Logo" className="absolute top-3 right-3 h-6 z-10" />
          )}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: settings.play_bg_color }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill={settings.icon_color}>
                <polygon points="5,3 19,12 5,21" />
              </svg>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 flex items-center gap-2 px-3 py-2" style={{ background: settings.player_color, fontFamily: settings.font_family }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill={settings.icon_color}>
              <polygon points="5,3 19,12 5,21" />
            </svg>
            <span className="text-xs" style={{ color: settings.icon_color }}>0:00 / 3:45</span>
            <div className="flex-1 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.3)" }}>
              <div className="h-full rounded-full w-1/3" style={{ background: settings.progress_color }} />
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={settings.icon_color} strokeWidth="2">
              <polygon points="11,5 6,9 2,9 2,15 6,15 11,19" />
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            </svg>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={settings.icon_color} strokeWidth="2">
              <polyline points="15,3 21,3 21,9" />
              <polyline points="9,21 3,21 3,15" />
              <line x1="21" y1="3" x2="14" y2="10" />
              <line x1="3" y1="21" x2="10" y2="14" />
            </svg>
          </div>
        </div>
      </section>
    </div>
  );
};

export default BrandKitView;
