import { useState, useMemo, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import {
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  Info,
  Code,
  Mail,
  FileText,
  Monitor,
  MessageSquareText,
  Layers,
  Palette,
} from "lucide-react";
import { toast } from "sonner";
import { useBrandSettings } from "@/hooks/useBrandSettings";
import { supabase } from "@/integrations/supabase/client";

interface EmbedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  videoUrl: string;
  videoId?: string;
  thumbnailUrl: string | null;
  transcription?: string | null;
  storage_path?: string;
}

function generateCustomPlayerCode(
  brandColor: string,
  brandIconColor: string,
  brandProgressColor: string,
  brandLogoUrl: string,
  brandPlayBgColor: string,
  brandSkipBgColor: string,
  sizeMode: string,
  embedWidth: string,
  embedHeight: string,
  videoId: string,
  supabaseUrl: string,
  anonKey: string,
  thumbnailUrl: string | null,
  skipDomainCheck: boolean,
  storagePath: string,
) {
  const uid = "p" + Math.random().toString(36).slice(2, 10);
  const vid = "v" + uid;
  const prog = "bar" + uid;
  const fill = "fill" + uid;
  const timeEl = "time" + uid;
  const playBtn = "pbtn" + uid;
  const volSlider = "vol" + uid;
  const qualMenu = "qual" + uid;
  const loadingOverlay = "load" + uid;

  const sizeStyle = sizeMode === "responsive"
    ? "width:100%;max-width:100%;"
    : `width:${embedWidth}px;`;

  const logoHtml = brandLogoUrl.trim()
    ? `<img src="${brandLogoUrl.trim()}" style="position:absolute;top:12px;right:12px;height:30px;z-index:10;pointer-events:none;" />`
    : "";

  const posterAttr = thumbnailUrl ? ` poster="${thumbnailUrl}"` : "";
  const videoSrc = "";
  
  // Loading overlay HTML
  const loadingOverlayHtml = `
  <div id="${loadingOverlay}" style="position:absolute;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:15;${thumbnailUrl ? `background-image:url('${thumbnailUrl}');background-size:cover;background-position:center;` : ""}">
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;width:100%;height:100%;${thumbnailUrl ? "background:rgba(0,0,0,0.6);" : ""}">
      <svg width="40" height="40" viewBox="0 0 24 24" style="animation:spin${uid} 1s linear infinite;"><circle cx="12" cy="12" r="10" stroke="${brandIconColor}" stroke-width="2" fill="none" stroke-dasharray="31.4 31.4" stroke-linecap="round"/></svg>
      <p style="color:${brandIconColor};font-size:13px;margin-top:12px;font-family:sans-serif;">Ładowanie...</p>
    </div>
  </div>
  <style>@keyframes spin${uid}{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}</style>`;

  // Secure fetch script with localStorage caching (50-minute TTL)
  const secureFetchScript = `
    (function(){
      var cacheKey = "embed_url_${videoId}";
      var cached = null;
      try { cached = JSON.parse(localStorage.getItem(cacheKey)); } catch(e){}
      
      function setVideoSrc(url) {
        var v = document.getElementById("${vid}");
        if(v) v.src = url;
      }
      
      function fetchAndCache() {
        fetch("${supabaseUrl}/functions/v1/get-embed-url", {
          method: "POST",
          headers: {"Content-Type":"application/json","apikey":"${anonKey}"},
          body: JSON.stringify({video_id:"${videoId}"${skipDomainCheck ? ',skip_domain_check:true' : ''}})
        })
        .then(function(r){ return r.json(); })
        .then(function(d){
          if(d.url){
            try {
              localStorage.setItem(cacheKey, JSON.stringify({url: d.url, ts: Date.now()}));
            } catch(e){}
            setVideoSrc(d.url);
          } else {
            document.getElementById("${uid}").innerHTML = '<p style="color:#999;text-align:center;padding:40px;font-family:sans-serif;">Ten film nie jest dostępny na tej stronie.</p>';
          }
        })
        .catch(function(){
          document.getElementById("${uid}").innerHTML = '<p style="color:#999;text-align:center;padding:40px;font-family:sans-serif;">Nie udało się załadować filmu.</p>';
        });
      }
      
      // Check cache validity (50 minutes = 3000000ms)
      if(cached && cached.url && cached.ts && (Date.now() - cached.ts) < 3000000) {
        setVideoSrc(cached.url);
      } else {
        fetchAndCache();
      }
    })();`;

  return `<div style="position:relative;${sizeStyle}background:#000;border-radius:8px;overflow:hidden;font-family:sans-serif;" id="${uid}">
  ${logoHtml}
  ${loadingOverlayHtml}
  <video preload="metadata"${posterAttr} style="width:100%;display:block;cursor:pointer;" id="${vid}"${sizeMode === "fixed" ? ` height="${embedHeight}"` : ""}></video>
  <!-- Skip buttons overlay -->
  <div style="position:absolute;top:50%;left:15%;transform:translateY(-50%);pointer-events:auto;opacity:0;transition:opacity .3s;z-index:5;" id="skip-back-${uid}">
    <button style="width:44px;height:44px;border-radius:50%;background:${brandSkipBgColor};border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;" onclick="(function(){var v=document.getElementById('${vid}');v.currentTime=Math.max(0,v.currentTime-15);})()">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${brandIconColor}" stroke-width="2"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/><text x="12" y="16" text-anchor="middle" fill="${brandIconColor}" stroke="none" font-size="8" font-family="sans-serif">15</text></svg>
    </button>
  </div>
  <div style="position:absolute;top:50%;right:15%;transform:translateY(-50%);pointer-events:auto;opacity:0;transition:opacity .3s;z-index:5;" id="skip-fwd-${uid}">
    <button style="width:44px;height:44px;border-radius:50%;background:${brandSkipBgColor};border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;" onclick="(function(){var v=document.getElementById('${vid}');v.currentTime=Math.min(v.duration||0,v.currentTime+15);})()">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${brandIconColor}" stroke-width="2"><path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.13-9.36L23 10"/><text x="12" y="16" text-anchor="middle" fill="${brandIconColor}" stroke="none" font-size="8" font-family="sans-serif">15</text></svg>
    </button>
  </div>
  <!-- Big play button -->
  <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);pointer-events:none;opacity:1;transition:opacity .3s;z-index:6;" id="big${playBtn}">
    <div style="width:64px;height:64px;border-radius:50%;background:${brandPlayBgColor};display:flex;align-items:center;justify-content:center;">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="${brandIconColor}"><polygon points="5,3 19,12 5,21"/></svg>
    </div>
  </div>
  <!-- Control bar -->
  <div style="position:absolute;bottom:0;left:0;right:0;background:${brandColor};padding:6px 12px;display:flex;align-items:center;gap:8px;opacity:0;transition:opacity .3s;" id="ctrl${uid}">
    <button id="${playBtn}" style="background:none;border:none;color:${brandIconColor};cursor:pointer;display:flex;padding:4px;">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="${brandIconColor}" id="ico${playBtn}"><polygon points="5,3 19,12 5,21"/></svg>
    </button>
    <span style="color:${brandIconColor};font-size:12px;min-width:80px;" id="${timeEl}">0:00 / 0:00</span>
    <div style="flex:1;height:4px;background:rgba(255,255,255,0.3);border-radius:2px;cursor:pointer;position:relative;" id="${prog}">
      <div style="width:0%;height:100%;background:${brandProgressColor};border-radius:2px;" id="${fill}"></div>
    </div>
    <!-- Volume -->
    <button style="background:none;border:none;color:${brandIconColor};cursor:pointer;display:flex;padding:4px;" id="mute${uid}" onclick="(function(){var v=document.getElementById('${vid}');var s=document.getElementById('${volSlider}');v.muted=!v.muted;s.value=v.muted?0:v.volume;})()">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${brandIconColor}" stroke-width="2"><polygon points="11,5 6,9 2,9 2,15 6,15 11,19"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
    </button>
    <input type="range" min="0" max="1" step="0.05" value="1" id="${volSlider}" style="width:60px;height:4px;cursor:pointer;accent-color:${brandProgressColor};" oninput="(function(el){var v=document.getElementById('${vid}');v.volume=parseFloat(el.value);v.muted=parseFloat(el.value)===0;})(this)" />
    <!-- Quality -->
    <div style="position:relative;">
      <button style="background:none;border:none;color:${brandIconColor};cursor:pointer;display:flex;padding:4px;font-size:11px;font-family:sans-serif;" id="qbtn${uid}" onclick="(function(){var m=document.getElementById('${qualMenu}');m.style.display=m.style.display==='none'?'block':'none';})()">HD</button>
      <div id="${qualMenu}" style="display:none;position:absolute;bottom:30px;right:0;background:rgba(0,0,0,0.9);border-radius:4px;padding:4px 0;min-width:80px;z-index:20;">
        <div style="padding:4px 12px;color:#fff;font-size:11px;cursor:pointer;font-family:sans-serif;" onmouseover="this.style.background='rgba(255,255,255,0.15)'" onmouseout="this.style.background='transparent'" onclick="(function(){var v=document.getElementById('${vid}');v.style.maxHeight='none';document.getElementById('qbtn${uid}').textContent='HD';document.getElementById('${qualMenu}').style.display='none';})()">Oryginalna</div>
        <div style="padding:4px 12px;color:#fff;font-size:11px;cursor:pointer;font-family:sans-serif;" onmouseover="this.style.background='rgba(255,255,255,0.15)'" onmouseout="this.style.background='transparent'" onclick="(function(){var v=document.getElementById('${vid}');v.style.maxHeight='720px';document.getElementById('qbtn${uid}').textContent='720p';document.getElementById('${qualMenu}').style.display='none';})()">720p</div>
        <div style="padding:4px 12px;color:#fff;font-size:11px;cursor:pointer;font-family:sans-serif;" onmouseover="this.style.background='rgba(255,255,255,0.15)'" onmouseout="this.style.background='transparent'" onclick="(function(){var v=document.getElementById('${vid}');v.style.maxHeight='480px';document.getElementById('qbtn${uid}').textContent='480p';document.getElementById('${qualMenu}').style.display='none';})()">480p</div>
      </div>
    </div>
    <!-- Fullscreen -->
    <button style="background:none;border:none;color:${brandIconColor};cursor:pointer;display:flex;padding:4px;" onclick="(function(){var w=document.getElementById('${uid}');if(w.requestFullscreen)w.requestFullscreen();else if(w.webkitRequestFullscreen)w.webkitRequestFullscreen();})()">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${brandIconColor}" stroke-width="2"><polyline points="15,3 21,3 21,9"/><polyline points="9,21 3,21 3,15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
    </button>
  </div>
  <script>
  (function(){
    var v=document.getElementById("${vid}"),c=document.getElementById("ctrl${uid}"),bb=document.getElementById("big${playBtn}"),pb=document.getElementById("${playBtn}"),ico=document.getElementById("ico${playBtn}"),bar=document.getElementById("${prog}"),fl=document.getElementById("${fill}"),tm=document.getElementById("${timeEl}"),w=document.getElementById("${uid}"),sb=document.getElementById("skip-back-${uid}"),sf=document.getElementById("skip-fwd-${uid}"),lo=document.getElementById("${loadingOverlay}");
    function fmt(s){var m=Math.floor(s/60),sec=Math.floor(s%60);return m+":"+(sec<10?"0":"")+sec;}
    function hideLoading(){if(lo)lo.style.display="none";}
    function toggle(){if(v.paused){v.play();bb.style.opacity="0";}else{v.pause();bb.style.opacity="1";}}
    v.addEventListener("canplay",hideLoading);
    v.addEventListener("click",toggle);pb.addEventListener("click",toggle);bb.parentElement.style.cursor="pointer";
    v.addEventListener("play",function(){ico.innerHTML='<rect x="6" y="4" width="4" height="16" fill="${brandIconColor}"/><rect x="14" y="4" width="4" height="16" fill="${brandIconColor}"/>';});
    v.addEventListener("pause",function(){ico.innerHTML='<polygon points="5,3 19,12 5,21" fill="${brandIconColor}"/>';});
    v.addEventListener("timeupdate",function(){if(v.duration){var p=(v.currentTime/v.duration)*100;fl.style.width=p+"%";tm.textContent=fmt(v.currentTime)+" / "+fmt(v.duration);}});
    bar.addEventListener("click",function(e){var r=bar.getBoundingClientRect();v.currentTime=(e.clientX-r.left)/r.width*v.duration;});
    w.addEventListener("mouseenter",function(){c.style.opacity="1";if(sb)sb.style.opacity="1";if(sf)sf.style.opacity="1";});
    w.addEventListener("mouseleave",function(){if(!v.paused){c.style.opacity="0";}if(sb)sb.style.opacity="0";if(sf)sf.style.opacity="0";});
  })();${secureFetchScript}
  </script>
</div>`;
}

const EmbedDialog = ({
  open,
  onOpenChange,
  videoUrl,
  videoId,
  thumbnailUrl,
  transcription,
}: EmbedDialogProps) => {
  const [embedTab, setEmbedTab] = useState("inline");
  const [sizeMode, setSizeMode] = useState("responsive");
  const [embedWidth, setEmbedWidth] = useState("640");
  const [embedHeight, setEmbedHeight] = useState("360");
  const [embedMethod, setEmbedMethod] = useState("standard");
  const [useLegacy, setUseLegacy] = useState(false);
  const [useOembed, setUseOembed] = useState(false);
  const [injectSeo, setInjectSeo] = useState(true);
  const [showCode, setShowCode] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [allowedDomain, setAllowedDomain] = useState("");
  const [domainRestricted, setDomainRestricted] = useState(false);

  const [popoverMode, setPopoverMode] = useState("thumbnail");
  const [popoverWidth, setPopoverWidth] = useState("150");
  const [popoverHeight, setPopoverHeight] = useState("84");
  const [popoverResponsive, setPopoverResponsive] = useState(false);
  const [popoverText, setPopoverText] = useState("Kliknij, aby obejrzeć wideo");

  const { settings: brandSettings } = useBrandSettings();
  const [brandColor, setBrandColor] = useState("#16a34a");
  const [brandIconColor, setBrandIconColor] = useState("#ffffff");
  const [brandProgressColor, setBrandProgressColor] = useState("#ffffff");
  const [brandLogoUrl, setBrandLogoUrl] = useState("");
  const [brandPlayBgColor, setBrandPlayBgColor] = useState("rgba(22,163,74,0.8)");
  const [brandSkipBgColor, setBrandSkipBgColor] = useState("rgba(0,0,0,0.45)");
  const [brandingOpen, setBrandingOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setBrandColor(brandSettings.player_color);
      setBrandIconColor(brandSettings.icon_color);
      setBrandProgressColor(brandSettings.progress_color);
      setBrandLogoUrl(brandSettings.logo_url);
      setBrandPlayBgColor(brandSettings.play_bg_color);
      setBrandSkipBgColor(brandSettings.skip_bg_color);
    }
  }, [open, brandSettings]);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  const embedCode = useMemo(() => {
    let rawCode = "";
    if (embedTab === "inline" || embedTab === "llm") {
      rawCode = generateCustomPlayerCode(
        brandColor, brandIconColor, brandProgressColor,
        brandLogoUrl, brandPlayBgColor, brandSkipBgColor,
        sizeMode, embedWidth, embedHeight,
        videoId || "", supabaseUrl, anonKey, thumbnailUrl,
        !(domainRestricted && !!allowedDomain.trim()),
      );
    } else if (embedTab === "popover") {
      if (popoverMode === "thumbnail") {
        const thumb = thumbnailUrl || videoUrl;
        if (popoverResponsive) {
          rawCode = `<a href="${videoUrl}" target="_blank" rel="noopener">\n  <img src="${thumb}" style="width:100%;max-width:${popoverWidth}px;" alt="Wideo" />\n</a>`;
        } else {
          rawCode = `<a href="${videoUrl}" target="_blank" rel="noopener">\n  <img src="${thumb}" width="${popoverWidth}" height="${popoverHeight}" alt="Wideo" />\n</a>`;
        }
      } else {
        rawCode = `<a href="${videoUrl}" target="_blank" rel="noopener">${popoverText}</a>`;
      }
    }
    return rawCode;
  }, [
    embedTab, sizeMode, embedWidth, embedHeight, videoUrl, thumbnailUrl, videoId,
    popoverMode, popoverWidth, popoverHeight, popoverResponsive, popoverText,
    domainRestricted, allowedDomain,
    brandColor, brandIconColor, brandProgressColor, brandLogoUrl, brandPlayBgColor, brandSkipBgColor,
    supabaseUrl, anonKey,
  ]);

  const handleCopy = async () => {
    if (domainRestricted && allowedDomain.trim() && videoId) {
      try {
        const { data: existing } = await supabase
          .from("video_embed_settings" as any)
          .select("id")
          .eq("video_id", videoId)
          .maybeSingle();
        const payload = {
          video_id: videoId,
          restrict_domain: true,
          allowed_domains: [allowedDomain.trim()],
        };
        if (existing) {
          await supabase
            .from("video_embed_settings" as any)
            .update({ restrict_domain: true, allowed_domains: [allowedDomain.trim()] })
            .eq("video_id", videoId);
        } else {
          await supabase.from("video_embed_settings" as any).insert(payload);
        }
      } catch (e) {
        console.error("Failed to save embed settings", e);
      }
    } else if (!domainRestricted && videoId) {
      try {
        await supabase
          .from("video_embed_settings" as any)
          .update({ restrict_domain: false })
          .eq("video_id", videoId);
      } catch {}
    }
    navigator.clipboard.writeText(embedCode);
    toast.success("Kod skopiowany do schowka");
  };

  const handleBrandColorChange = (color: string) => {
    setBrandColor(color);
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    setBrandPlayBgColor(`rgba(${r},${g},${b},0.8)`);
  };

  const brandingJsx = (
    <Collapsible open={brandingOpen} onOpenChange={setBrandingOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors w-full py-2">
        {brandingOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        <Palette className="h-4 w-4" />
        Branding
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 pt-2">
        <div className="space-y-1.5">
          <Label className="text-xs">URL logo</Label>
          <Input value={brandLogoUrl} onChange={(e) => setBrandLogoUrl(e.target.value)} placeholder="https://example.com/logo.png" className="h-8 text-xs" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Pasek kontrolny</Label>
            <div className="flex items-center gap-1.5">
              <input type="color" value={brandColor} onChange={(e) => handleBrandColorChange(e.target.value)} className="w-7 h-7 rounded cursor-pointer border border-border" />
              <span className="text-[10px] text-muted-foreground font-mono">{brandColor}</span>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Ikony</Label>
            <div className="flex items-center gap-1.5">
              <input type="color" value={brandIconColor} onChange={(e) => setBrandIconColor(e.target.value)} className="w-7 h-7 rounded cursor-pointer border border-border" />
              <span className="text-[10px] text-muted-foreground font-mono">{brandIconColor}</span>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Postęp</Label>
            <div className="flex items-center gap-1.5">
              <input type="color" value={brandProgressColor} onChange={(e) => setBrandProgressColor(e.target.value)} className="w-7 h-7 rounded cursor-pointer border border-border" />
              <span className="text-[10px] text-muted-foreground font-mono">{brandProgressColor}</span>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Tło play</Label>
            <div className="flex items-center gap-1.5">
              <input type="color" value={brandColor} onChange={(e) => { const c = e.target.value; const r = parseInt(c.slice(1,3),16); const g = parseInt(c.slice(3,5),16); const b = parseInt(c.slice(5,7),16); setBrandPlayBgColor(`rgba(${r},${g},${b},0.8)`); }} className="w-7 h-7 rounded cursor-pointer border border-border" />
              <span className="text-[10px] text-muted-foreground font-mono truncate">{brandPlayBgColor}</span>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Tło skip</Label>
            <div className="flex items-center gap-1.5">
              <input type="color" value={brandSkipBgColor.startsWith("rgba") ? "#000000" : brandSkipBgColor} onChange={(e) => { const c = e.target.value; const r = parseInt(c.slice(1,3),16); const g = parseInt(c.slice(3,5),16); const b = parseInt(c.slice(5,7),16); setBrandSkipBgColor(`rgba(${r},${g},${b},0.45)`); }} className="w-7 h-7 rounded cursor-pointer border border-border" />
              <span className="text-[10px] text-muted-foreground font-mono truncate">{brandSkipBgColor}</span>
            </div>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );

  const sizeOptionsJsx = (
    <div className="space-y-2">
      <Label className="text-sm font-medium">Rozmiar</Label>
      <RadioGroup value={sizeMode} onValueChange={setSizeMode} className="space-y-2">
        <div className="flex items-start gap-2">
          <RadioGroupItem value="responsive" id="size-responsive" className="mt-0.5" />
          <div>
            <Label htmlFor="size-responsive" className="font-medium cursor-pointer text-sm">
              Responsywny
              <span className="ml-1.5 text-[10px] text-emerald-600 bg-emerald-50 px-1 py-0.5 rounded">Zalecany</span>
            </Label>
            <p className="text-xs text-muted-foreground">Dostosuje się do kontenera.</p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <RadioGroupItem value="fixed" id="size-fixed" className="mt-0.5" />
          <div>
            <Label htmlFor="size-fixed" className="font-medium cursor-pointer text-sm">Stały rozmiar</Label>
            {sizeMode === "fixed" && (
              <div className="flex items-center gap-1.5 mt-1.5">
                <Input type="number" value={embedWidth} onChange={(e) => setEmbedWidth(e.target.value)} className="w-16 h-7 text-xs" />
                <span className="text-xs text-muted-foreground">×</span>
                <Input type="number" value={embedHeight} onChange={(e) => setEmbedHeight(e.target.value)} className="w-16 h-7 text-xs" />
                <span className="text-xs text-muted-foreground">px</span>
              </div>
            )}
          </div>
        </div>
      </RadioGroup>
    </div>
  );

  const advancedOptionsJsx = (
    <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors w-full py-2">
        {advancedOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        Zaawansowane
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 pt-2">
        <div>
          <Label className="text-sm font-medium mb-1.5 block">Metoda osadzania</Label>
          <RadioGroup value={embedMethod} onValueChange={setEmbedMethod} className="space-y-1.5">
            <div className="flex items-start gap-2">
              <RadioGroupItem value="standard" id="method-standard" className="mt-0.5" />
              <Label htmlFor="method-standard" className="font-medium cursor-pointer text-sm">
                Standardowy
                <span className="ml-1.5 text-[10px] text-emerald-600 bg-emerald-50 px-1 py-0.5 rounded">Zalecany</span>
              </Label>
            </div>
            <div className="flex items-start gap-2">
              <RadioGroupItem value="fallback" id="method-fallback" className="mt-0.5" />
              <Label htmlFor="method-fallback" className="font-medium cursor-pointer text-sm">Fallback (iframe)</Label>
            </div>
          </RadioGroup>
        </div>
        <Separator />
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Checkbox id="legacy" checked={useLegacy} onCheckedChange={(v) => setUseLegacy(v === true)} />
            <Label htmlFor="legacy" className="text-xs cursor-pointer">Starszy kod embed</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="oembed" checked={useOembed} onCheckedChange={(v) => setUseOembed(v === true)} />
            <Label htmlFor="oembed" className="text-xs cursor-pointer">oEmbed URL</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="seo" checked={injectSeo} onCheckedChange={(v) => setInjectSeo(v === true)} />
            <Label htmlFor="seo" className="text-xs cursor-pointer">Metadane SEO</Label>
          </div>
        </div>
        <Separator />
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Checkbox id="domain-restrict" checked={domainRestricted} onCheckedChange={(v) => setDomainRestricted(v === true)} />
            <Label htmlFor="domain-restrict" className="text-xs cursor-pointer">Ogranicz do domeny</Label>
          </div>
          {domainRestricted && (
            <Input value={allowedDomain} onChange={(e) => setAllowedDomain(e.target.value)} placeholder="np. mojastrona.pl" className="h-7 text-xs" />
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );

  const placeholderJsx = (label: string) => (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
      <Mail className="h-8 w-8" />
      <p className="text-sm font-medium">{label}</p>
      <p className="text-xs">Wkrótce dostępne</p>
    </div>
  );

  const leftColumnContent = () => {
    if (embedTab === "inline") {
      return (
        <div className="space-y-3">
          {brandingJsx}
          <Separator />
          {sizeOptionsJsx}
          <Separator />
          {advancedOptionsJsx}
        </div>
      );
    }
    if (embedTab === "popover") {
      return (
        <RadioGroup value={popoverMode} onValueChange={setPopoverMode} className="space-y-3">
          <div className="flex items-start gap-2">
            <RadioGroupItem value="thumbnail" id="pop-thumb" className="mt-0.5" />
            <div className="space-y-2">
              <Label htmlFor="pop-thumb" className="font-medium cursor-pointer text-sm">Miniaturka</Label>
              {popoverMode === "thumbnail" && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Input type="number" value={popoverWidth} onChange={(e) => setPopoverWidth(e.target.value)} className="w-16 h-7 text-xs" />
                    <span className="text-xs text-muted-foreground">×</span>
                    <Input type="number" value={popoverHeight} onChange={(e) => setPopoverHeight(e.target.value)} className="w-16 h-7 text-xs" />
                    <span className="text-xs text-muted-foreground">px</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox id="pop-responsive" checked={popoverResponsive} onCheckedChange={(v) => setPopoverResponsive(v === true)} />
                    <Label htmlFor="pop-responsive" className="text-xs cursor-pointer">Responsywny</Label>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-start gap-2">
            <RadioGroupItem value="textlink" id="pop-text" className="mt-0.5" />
            <div className="space-y-2">
              <Label htmlFor="pop-text" className="font-medium cursor-pointer text-sm">Link tekstowy</Label>
              {popoverMode === "textlink" && (
                <Input value={popoverText} onChange={(e) => setPopoverText(e.target.value)} className="h-7 text-xs" placeholder="Tekst linku..." />
              )}
            </div>
          </div>
        </RadioGroup>
      );
    }
    if (embedTab === "llm") {
      return (
        <div className="space-y-3">
          {sizeOptionsJsx}
        </div>
      );
    }
    if (embedTab === "email") {
      return placeholderJsx("Osadzanie w emailach");
    }
    if (embedTab === "transcript") {
      return transcription ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Skopiuj transkrypcję do osadzenia na stronie:</p>
          <div className="bg-muted rounded-md p-3 max-h-[300px] overflow-y-auto">
            <pre className="text-xs whitespace-pre-wrap select-all">{transcription}</pre>
          </div>
          <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(transcription); toast.success("Transkrypcja skopiowana"); }}>
            Kopiuj transkrypcję
          </Button>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
          <FileText className="h-8 w-8" />
          <p className="text-sm font-medium">Brak transkrypcji</p>
          <p className="text-xs">Najpierw wykonaj transkrypcję na stronie wideo</p>
        </div>
      );
    }
    return null;
  };

  const previewSrcDoc = useMemo(() => {
    return `<!DOCTYPE html><html><head><style>body{margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f5f5f5;font-family:sans-serif;padding:20px;box-sizing:border-box;}body>div{width:100%;max-width:800px;}</style></head><body>${embedCode}</body></html>`;
  }, [embedCode]);

  const rightColumnContent = () => {
    if (showCode) {
      return (
        <div className="flex-1 min-h-0 overflow-auto">
          <div className="bg-muted rounded-md p-4 h-full">
            <code className="text-xs break-all whitespace-pre-wrap select-all">{embedCode}</code>
          </div>
        </div>
      );
    }

    return (
      <div className="flex-1 min-h-0 flex flex-col">
        {/* Browser mockup */}
        <div className="rounded-lg overflow-hidden border border-border flex flex-col flex-1 min-h-0">
          <div className="bg-muted/60 px-3 py-2 flex items-center gap-2 border-b border-border shrink-0">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
            </div>
            <div className="bg-background px-3 py-1 rounded text-[11px] text-muted-foreground flex-1 truncate">
              https://your-site.com/page
            </div>
          </div>
          <iframe
            sandbox="allow-scripts allow-same-origin"
            srcDoc={previewSrcDoc}
            className="w-full flex-1 border-none bg-neutral-100"
            style={{ minHeight: "200px" }}
            title="Podgląd embed"
          />
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[90vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <div className="px-6 pt-5 pb-3 space-y-2 shrink-0">
          <DialogHeader>
            <DialogTitle className="text-xl">Osadź media</DialogTitle>
            <DialogDescription>Wybierz sposób osadzania i dostosuj wygląd.</DialogDescription>
          </DialogHeader>
          <div className="flex items-start gap-2 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 rounded-md px-3 py-2 text-xs">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <span>Standardowe osadzanie inline jest najlepsze dla większości platform CMS.</span>
          </div>
        </div>

        {/* Tabs header */}
        <Tabs value={embedTab} onValueChange={setEmbedTab} className="flex-1 flex flex-col min-h-0">
          <div className="px-6 shrink-0">
            <TabsList className="w-full bg-transparent border-b border-border rounded-none h-auto p-0 gap-0">
              <TabsTrigger value="inline" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2 text-sm">
                <Monitor className="h-4 w-4 mr-1.5" />Inline
              </TabsTrigger>
              <TabsTrigger value="popover" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2 text-sm">
                <Layers className="h-4 w-4 mr-1.5" />Popover
              </TabsTrigger>
              <TabsTrigger value="llm" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2 text-sm">
                <MessageSquareText className="h-4 w-4 mr-1.5" />LLM
              </TabsTrigger>
              <TabsTrigger value="email" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2 text-sm">
                <Mail className="h-4 w-4 mr-1.5" />Email
              </TabsTrigger>
              <TabsTrigger value="transcript" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2 text-sm">
                <FileText className="h-4 w-4 mr-1.5" />Transkrypcja
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Two-column body */}
          <div className="flex-1 min-h-0 grid grid-cols-5 gap-0">
            {/* Left: settings */}
            <div className="col-span-2 border-r border-border overflow-y-auto p-4">
              {leftColumnContent()}
            </div>

            {/* Right: live preview / code */}
            <div className="col-span-3 p-4 flex flex-col min-h-0">
              {rightColumnContent()}
            </div>
          </div>
        </Tabs>

        {/* Footer */}
        <div className="border-t border-border px-6 py-3 flex items-center justify-between shrink-0">
          <Button
            variant={showCode ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setShowCode(!showCode)}
            className="text-muted-foreground"
          >
            {showCode ? <EyeOff className="h-4 w-4 mr-1.5" /> : <Eye className="h-4 w-4 mr-1.5" />}
            {showCode ? "Podgląd" : "Pokaż kod"}
          </Button>
          <Button size="sm" onClick={handleCopy}>
            <Code className="h-4 w-4 mr-1.5" />
            Kopiuj kod
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EmbedDialog;
