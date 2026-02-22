import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface BrandSettings {
  logo_url: string;
  player_color: string;
  icon_color: string;
  progress_color: string;
  play_bg_color: string;
  font_family: string;
}

const STORAGE_KEY = "brand_settings";

const DEFAULT_SETTINGS: BrandSettings = {
  logo_url: "",
  player_color: "#16a34a",
  icon_color: "#ffffff",
  progress_color: "#ffffff",
  play_bg_color: "rgba(22,163,74,0.8)",
  font_family: "Inter",
};

export function useBrandSettings() {
  const [settings, setSettings] = useState<BrandSettings>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });
  const [saving, setSaving] = useState(false);

  const saveSettings = useCallback((updated: BrandSettings) => {
    setSettings(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }, []);

  const updateSetting = useCallback(<K extends keyof BrandSettings>(key: K, value: BrandSettings[K]) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const uploadLogo = useCallback(async (file: File): Promise<string | null> => {
    const ext = file.name.split(".").pop() || "png";
    const path = `logos/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("brand-assets").upload(path, file, { upsert: true });
    if (error) {
      console.error("Logo upload error:", error);
      return null;
    }
    const { data } = supabase.storage.from("brand-assets").getPublicUrl(path);
    return data.publicUrl;
  }, []);

  const removeLogo = useCallback(() => {
    updateSetting("logo_url", "");
  }, [updateSetting]);

  return { settings, saveSettings, updateSetting, uploadLogo, removeLogo, saving };
}
