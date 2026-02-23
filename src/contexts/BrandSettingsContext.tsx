import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface BrandSettings {
  logo_url: string;
  player_color: string;
  icon_color: string;
  progress_color: string;
  play_bg_color: string;
  skip_bg_color: string;
  font_family: string;
}

const STORAGE_KEY = "brand_settings";

const DEFAULT_SETTINGS: BrandSettings = {
  logo_url: "",
  player_color: "#16a34a",
  icon_color: "#ffffff",
  progress_color: "#ffffff",
  play_bg_color: "rgba(22,163,74,0.8)",
  skip_bg_color: "rgba(0,0,0,0.45)",
  font_family: "Inter",
};

interface BrandSettingsContextValue {
  settings: BrandSettings;
  saveSettings: (updated: BrandSettings) => void;
  updateSetting: <K extends keyof BrandSettings>(key: K, value: BrandSettings[K]) => void;
  uploadLogo: (file: File) => Promise<string | null>;
  removeLogo: () => void;
  saving: boolean;
  loaded: boolean;
}

const BrandSettingsContext = createContext<BrandSettingsContextValue | null>(null);

export function BrandSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<BrandSettings>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const dbRowId = useRef<string | null>(null);

  useEffect(() => {
    const loadFromDb = async () => {
      try {
        const { data, error } = await supabase
          .from("brand_settings")
          .select("*")
          .limit(1)
          .maybeSingle();

        if (!error && data) {
          dbRowId.current = data.id;
          const dbSettings: BrandSettings = {
            logo_url: data.logo_url ?? "",
            player_color: data.player_color,
            icon_color: data.icon_color,
            progress_color: data.progress_color,
            play_bg_color: data.play_bg_color,
            skip_bg_color: (data as any).skip_bg_color ?? DEFAULT_SETTINGS.skip_bg_color,
            font_family: data.font_family,
          };
          setSettings(dbSettings);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(dbSettings));
        }
      } catch {
        // fallback to localStorage
      } finally {
        setLoaded(true);
      }
    };
    loadFromDb();
  }, []);

  const persistToDb = useCallback(async (updated: BrandSettings) => {
    setSaving(true);
    try {
      const payload = {
        logo_url: updated.logo_url || null,
        player_color: updated.player_color,
        icon_color: updated.icon_color,
        progress_color: updated.progress_color,
        play_bg_color: updated.play_bg_color,
        skip_bg_color: updated.skip_bg_color,
        font_family: updated.font_family,
      };
      if (dbRowId.current) {
        await supabase.from("brand_settings").update(payload).eq("id", dbRowId.current);
      } else {
        const { data } = await supabase
          .from("brand_settings")
          .insert({ ...payload, user_id: null as any })
          .select("id")
          .single();
        if (data) dbRowId.current = data.id;
      }
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  }, []);

  const saveSettings = useCallback((updated: BrandSettings) => {
    setSettings(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    persistToDb(updated);
  }, [persistToDb]);

  const updateSetting = useCallback(<K extends keyof BrandSettings>(key: K, value: BrandSettings[K]) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      persistToDb(next);
      return next;
    });
  }, [persistToDb]);

  const uploadLogo = useCallback(async (file: File): Promise<string | null> => {
    const ext = file.name.split(".").pop() || "png";
    const path = `logos/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("brand-assets").upload(path, file, { upsert: true });
    if (error) return null;
    const { data } = supabase.storage.from("brand-assets").getPublicUrl(path);
    return data.publicUrl;
  }, []);

  const removeLogo = useCallback(() => {
    updateSetting("logo_url", "");
  }, [updateSetting]);

  return (
    <BrandSettingsContext.Provider value={{ settings, saveSettings, updateSetting, uploadLogo, removeLogo, saving, loaded }}>
      {children}
    </BrandSettingsContext.Provider>
  );
}

export function useBrandSettings() {
  const ctx = useContext(BrandSettingsContext);
  if (!ctx) throw new Error("useBrandSettings must be used within BrandSettingsProvider");
  return ctx;
}
