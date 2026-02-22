import { useState, useMemo } from "react";
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

interface EmbedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  videoUrl: string;
  thumbnailUrl: string | null;
  transcription?: string | null;
}

function generateCustomPlayerCode(
  videoUrl: string,
  brandColor: string,
  brandIconColor: string,
  brandProgressColor: string,
  brandLogoUrl: string,
  brandPlayBgColor: string,
  sizeMode: string,
  embedWidth: string,
  embedHeight: string,
) {
  const uid = "p" + Math.random().toString(36).slice(2, 10);
  const vid = "v" + uid;
  const prog = "bar" + uid;
  const fill = "fill" + uid;
  const timeEl = "time" + uid;
  const playBtn = "pbtn" + uid;

  const sizeStyle = sizeMode === "responsive"
    ? "width:100%;max-width:100%;"
    : `width:${embedWidth}px;`;

  const logoHtml = brandLogoUrl.trim()
    ? `<img src="${brandLogoUrl.trim()}" style="position:absolute;top:12px;right:12px;height:30px;z-index:10;pointer-events:none;" />`
    : "";

  return `<div style="position:relative;${sizeStyle}background:#000;border-radius:8px;overflow:hidden;font-family:sans-serif;" id="${uid}">
  ${logoHtml}
  <video src="${videoUrl}" style="width:100%;display:block;cursor:pointer;" id="${vid}"${sizeMode === "fixed" ? ` height="${embedHeight}"` : ""}></video>
  <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);pointer-events:none;opacity:1;transition:opacity .3s;" id="big${playBtn}">
    <div style="width:64px;height:64px;border-radius:50%;background:${brandPlayBgColor};display:flex;align-items:center;justify-content:center;">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="${brandIconColor}"><polygon points="5,3 19,12 5,21"/></svg>
    </div>
  </div>
  <div style="position:absolute;bottom:0;left:0;right:0;background:${brandColor};padding:6px 12px;display:flex;align-items:center;gap:8px;opacity:0;transition:opacity .3s;" id="ctrl${uid}">
    <button id="${playBtn}" style="background:none;border:none;color:${brandIconColor};cursor:pointer;display:flex;padding:4px;">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="${brandIconColor}" id="ico${playBtn}"><polygon points="5,3 19,12 5,21"/></svg>
    </button>
    <span style="color:${brandIconColor};font-size:12px;min-width:80px;" id="${timeEl}">0:00 / 0:00</span>
    <div style="flex:1;height:4px;background:rgba(255,255,255,0.3);border-radius:2px;cursor:pointer;position:relative;" id="${prog}">
      <div style="width:0%;height:100%;background:${brandProgressColor};border-radius:2px;" id="${fill}"></div>
    </div>
    <button style="background:none;border:none;color:${brandIconColor};cursor:pointer;display:flex;padding:4px;" onclick="(function(){var v=document.getElementById('${vid}');v.muted=!v.muted;})()">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${brandIconColor}" stroke-width="2"><polygon points="11,5 6,9 2,9 2,15 6,15 11,19"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
    </button>
    <button style="background:none;border:none;color:${brandIconColor};cursor:pointer;display:flex;padding:4px;" onclick="(function(){var w=document.getElementById('${uid}');if(w.requestFullscreen)w.requestFullscreen();else if(w.webkitRequestFullscreen)w.webkitRequestFullscreen();})()">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${brandIconColor}" stroke-width="2"><polyline points="15,3 21,3 21,9"/><polyline points="9,21 3,21 3,15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
    </button>
  </div>
  <script>
  (function(){
    var v=document.getElementById("${vid}"),c=document.getElementById("ctrl${uid}"),bb=document.getElementById("big${playBtn}"),pb=document.getElementById("${playBtn}"),ico=document.getElementById("ico${playBtn}"),bar=document.getElementById("${prog}"),fl=document.getElementById("${fill}"),tm=document.getElementById("${timeEl}"),w=document.getElementById("${uid}");
    function fmt(s){var m=Math.floor(s/60),sec=Math.floor(s%60);return m+":"+(sec<10?"0":"")+sec;}
    function toggle(){if(v.paused){v.play();bb.style.opacity="0";}else{v.pause();bb.style.opacity="1";}}
    v.addEventListener("click",toggle);pb.addEventListener("click",toggle);bb.parentElement.style.cursor="pointer";
    v.addEventListener("play",function(){ico.innerHTML='<rect x="6" y="4" width="4" height="16" fill="${brandIconColor}"/><rect x="14" y="4" width="4" height="16" fill="${brandIconColor}"/>';});
    v.addEventListener("pause",function(){ico.innerHTML='<polygon points="5,3 19,12 5,21" fill="${brandIconColor}"/>';});
    v.addEventListener("timeupdate",function(){if(v.duration){var p=(v.currentTime/v.duration)*100;fl.style.width=p+"%";tm.textContent=fmt(v.currentTime)+" / "+fmt(v.duration);}});
    bar.addEventListener("click",function(e){var r=bar.getBoundingClientRect();v.currentTime=(e.clientX-r.left)/r.width*v.duration;});
    w.addEventListener("mouseenter",function(){c.style.opacity="1";});
    w.addEventListener("mouseleave",function(){if(!v.paused)c.style.opacity="0";});
  })();
  </script>
</div>`;
}

const EmbedDialog = ({
  open,
  onOpenChange,
  videoUrl,
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

  // Branding states
  const [brandColor, setBrandColor] = useState("#16a34a");
  const [brandIconColor, setBrandIconColor] = useState("#ffffff");
  const [brandProgressColor, setBrandProgressColor] = useState("#ffffff");
  const [brandLogoUrl, setBrandLogoUrl] = useState("");
  const [brandPlayBgColor, setBrandPlayBgColor] = useState("rgba(22,163,74,0.8)");
  const [brandingOpen, setBrandingOpen] = useState(false);

  const embedCode = useMemo(() => {
    let rawCode = "";
    if (embedTab === "inline" || embedTab === "llm") {
      rawCode = generateCustomPlayerCode(
        videoUrl,
        brandColor,
        brandIconColor,
        brandProgressColor,
        brandLogoUrl,
        brandPlayBgColor,
        sizeMode,
        embedWidth,
        embedHeight,
      );
    } else if (embedTab === "popover") {
      if (popoverMode === "thumbnail") {
        const thumb = thumbnailUrl || videoUrl;
        if (popoverResponsive) {
          rawCode = `<a href="${videoUrl}" target="_blank" rel="noopener">
  <img src="${thumb}" style="width:100%;max-width:${popoverWidth}px;" alt="Wideo" />
</a>`;
        } else {
          rawCode = `<a href="${videoUrl}" target="_blank" rel="noopener">
  <img src="${thumb}" width="${popoverWidth}" height="${popoverHeight}" alt="Wideo" />
</a>`;
        }
      } else {
        rawCode = `<a href="${videoUrl}" target="_blank" rel="noopener">${popoverText}</a>`;
      }
    }

    if (domainRestricted && allowedDomain.trim() && rawCode) {
      const uid = "embed-" + Math.random().toString(36).slice(2, 10);
      const escaped = rawCode.replace(/'/g, "\\'").replace(/\n/g, "\\n");
      return `<div id="${uid}">
  <script>
    (function(){
      var allowed = "${allowedDomain.trim()}";
      if (window.location.hostname === allowed || window.location.hostname.endsWith("." + allowed)) {
        document.getElementById("${uid}").innerHTML = '${escaped}';
      } else {
        document.getElementById("${uid}").innerHTML = '<p style="color:#666;font-size:14px;">Ten film nie jest dostępny na tej stronie.</p>';
      }
    })();
  </script>
</div>`;
    }

    return rawCode;
  }, [
    embedTab, sizeMode, embedWidth, embedHeight, videoUrl, thumbnailUrl,
    popoverMode, popoverWidth, popoverHeight, popoverResponsive, popoverText,
    domainRestricted, allowedDomain,
    brandColor, brandIconColor, brandProgressColor, brandLogoUrl, brandPlayBgColor,
  ]);

  const handleCopy = () => {
    navigator.clipboard.writeText(embedCode);
    toast.success("Kod skopiowany do schowka");
  };

  // Compute play button bg from brand color when brand color changes
  const handleBrandColorChange = (color: string) => {
    setBrandColor(color);
    // Convert hex to rgba with 0.8 opacity for play button bg
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
      <CollapsibleContent className="space-y-4 pt-2">
        {/* Logo URL */}
        <div className="space-y-1.5">
          <Label className="text-sm">URL logo</Label>
          <Input
            value={brandLogoUrl}
            onChange={(e) => setBrandLogoUrl(e.target.value)}
            placeholder="https://example.com/logo.png"
            className="h-8 text-sm"
          />
          <p className="text-xs text-muted-foreground">Logo pojawi się w prawym górnym rogu playera</p>
        </div>

        {/* Color pickers */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Pasek kontrolny</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={brandColor}
                onChange={(e) => handleBrandColorChange(e.target.value)}
                className="w-8 h-8 rounded cursor-pointer border border-border"
              />
              <span className="text-xs text-muted-foreground font-mono">{brandColor}</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Ikony / przyciski</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={brandIconColor}
                onChange={(e) => setBrandIconColor(e.target.value)}
                className="w-8 h-8 rounded cursor-pointer border border-border"
              />
              <span className="text-xs text-muted-foreground font-mono">{brandIconColor}</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Pasek postępu</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={brandProgressColor}
                onChange={(e) => setBrandProgressColor(e.target.value)}
                className="w-8 h-8 rounded cursor-pointer border border-border"
              />
              <span className="text-xs text-muted-foreground font-mono">{brandProgressColor}</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Tło przycisku play</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={brandColor}
                onChange={(e) => {
                  const c = e.target.value;
                  const r = parseInt(c.slice(1, 3), 16);
                  const g = parseInt(c.slice(3, 5), 16);
                  const b = parseInt(c.slice(5, 7), 16);
                  setBrandPlayBgColor(`rgba(${r},${g},${b},0.8)`);
                }}
                className="w-8 h-8 rounded cursor-pointer border border-border"
              />
              <span className="text-xs text-muted-foreground font-mono">{brandPlayBgColor}</span>
            </div>
          </div>
        </div>

        {/* Live preview */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Podgląd</Label>
          <div className="rounded-lg overflow-hidden bg-black aspect-video border border-border relative">
            {thumbnailUrl ? (
              <img src={thumbnailUrl} alt="Podgląd" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-neutral-900" />
            )}
            {/* Logo overlay */}
            {brandLogoUrl.trim() && (
              <img
                src={brandLogoUrl.trim()}
                alt="Logo"
                className="absolute top-2 right-2 h-5 z-10"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            )}
            {/* Big play button overlay */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{ background: brandPlayBgColor }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill={brandIconColor}>
                  <polygon points="5,3 19,12 5,21" />
                </svg>
              </div>
            </div>
            {/* Control bar overlay */}
            <div
              className="absolute bottom-0 left-0 right-0 flex items-center gap-1.5 px-2 py-1.5"
              style={{ background: brandColor }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill={brandIconColor}>
                <polygon points="5,3 19,12 5,21" />
              </svg>
              <span className="text-[10px]" style={{ color: brandIconColor }}>0:00 / 3:45</span>
              <div className="flex-1 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.3)" }}>
                <div className="h-full rounded-full w-1/3" style={{ background: brandProgressColor }} />
              </div>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={brandIconColor} strokeWidth="2">
                <polygon points="11,5 6,9 2,9 2,15 6,15 11,19" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              </svg>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={brandIconColor} strokeWidth="2">
                <polyline points="15,3 21,3 21,9" />
                <polyline points="9,21 3,21 3,15" />
                <line x1="21" y1="3" x2="14" y2="10" />
                <line x1="3" y1="21" x2="10" y2="14" />
              </svg>
            </div>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );

  const sizeOptionsJsx = (
    <div className="space-y-3">
      <Label className="text-sm font-medium">Rozmiar</Label>
      <RadioGroup value={sizeMode} onValueChange={setSizeMode} className="space-y-3">
        <div className="flex items-start gap-3">
          <RadioGroupItem value="responsive" id="size-responsive" className="mt-0.5" />
          <div>
            <Label htmlFor="size-responsive" className="font-medium cursor-pointer">
              Responsywny
              <span className="ml-2 text-xs text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                Zalecany
              </span>
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Najłatwiejsza opcja. Player dostosuje się do szerokości kontenera.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <RadioGroupItem value="fixed" id="size-fixed" className="mt-0.5" />
          <div>
            <Label htmlFor="size-fixed" className="font-medium cursor-pointer">
              Stały rozmiar
            </Label>
            {sizeMode === "fixed" && (
              <div className="flex items-center gap-2 mt-2">
                <Input
                  type="number"
                  value={embedWidth}
                  onChange={(e) => setEmbedWidth(e.target.value)}
                  className="w-20 h-8 text-sm"
                />
                <span className="text-xs text-muted-foreground">×</span>
                <Input
                  type="number"
                  value={embedHeight}
                  onChange={(e) => setEmbedHeight(e.target.value)}
                  className="w-20 h-8 text-sm"
                />
                <span className="text-xs text-muted-foreground">px</span>
              </div>
            )}
          </div>
        </div>
      </RadioGroup>
    </div>
  );

  const videoPreviewJsx = (
    <div className="rounded-lg overflow-hidden bg-black aspect-video border border-border">
      {thumbnailUrl ? (
        <img
          src={thumbnailUrl}
          alt="Podgląd wideo"
          className="w-full h-full object-cover"
        />
      ) : (
        <video
          src={videoUrl}
          className="w-full h-full"
          muted
          playsInline
        />
      )}
    </div>
  );

  const advancedOptionsJsx = (
    <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors w-full py-2">
        {advancedOpen ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
        Zaawansowane opcje
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-4 pt-2">
        <div>
          <Label className="text-sm font-medium mb-2 block">Metoda osadzania</Label>
          <RadioGroup value={embedMethod} onValueChange={setEmbedMethod} className="space-y-2">
            <div className="flex items-start gap-3">
              <RadioGroupItem value="standard" id="method-standard" className="mt-0.5" />
              <div>
                <Label htmlFor="method-standard" className="font-medium cursor-pointer">
                  Standardowy
                  <span className="ml-2 text-xs text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                    Zalecany
                  </span>
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Osadzanie JavaScript — lepsze śledzenie i personalizacja.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <RadioGroupItem value="fallback" id="method-fallback" className="mt-0.5" />
              <div>
                <Label htmlFor="method-fallback" className="font-medium cursor-pointer">
                  Fallback (iframe)
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Prosty iframe — kompatybilny z większością platform.
                </p>
              </div>
            </div>
          </RadioGroup>
        </div>
        <Separator />
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Checkbox
              id="legacy"
              checked={useLegacy}
              onCheckedChange={(v) => setUseLegacy(v === true)}
            />
            <Label htmlFor="legacy" className="text-sm cursor-pointer">
              Użyj starszego kodu embed
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="oembed"
              checked={useOembed}
              onCheckedChange={(v) => setUseOembed(v === true)}
            />
            <Label htmlFor="oembed" className="text-sm cursor-pointer">
              Użyj oEmbed URL
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="seo"
              checked={injectSeo}
              onCheckedChange={(v) => setInjectSeo(v === true)}
            />
            <Label htmlFor="seo" className="text-sm cursor-pointer">
              Dodaj metadane SEO
            </Label>
          </div>
        </div>
        <Separator />
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Checkbox
              id="domain-restrict"
              checked={domainRestricted}
              onCheckedChange={(v) => setDomainRestricted(v === true)}
            />
            <Label htmlFor="domain-restrict" className="text-sm cursor-pointer">
              Ogranicz do domeny
            </Label>
          </div>
          {domainRestricted && (
            <Input
              value={allowedDomain}
              onChange={(e) => setAllowedDomain(e.target.value)}
              placeholder="np. mojastrona.pl"
              className="h-8 text-sm"
            />
          )}
          <p className="text-xs text-muted-foreground">
            Embed będzie działał tylko na podanej domenie (i jej subdomenach).
          </p>
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0">
        <div className="p-6 pb-4 space-y-3">
          <DialogHeader>
            <DialogTitle className="text-xl">Osadź media</DialogTitle>
            <DialogDescription>Wybierz sposób osadzania.</DialogDescription>
          </DialogHeader>
          <div className="flex items-start gap-2 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 rounded-md px-3 py-2.5 text-xs">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              Standardowe osadzanie inline jest najlepsze dla większości platform CMS.
            </span>
          </div>
        </div>

        <Tabs
          value={embedTab}
          onValueChange={setEmbedTab}
          className="flex-1 flex flex-col min-h-0"
        >
          <div className="px-6">
            <TabsList className="w-full bg-transparent border-b border-border rounded-none h-auto p-0 gap-0">
              <TabsTrigger
                value="inline"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5 text-sm"
              >
                <Monitor className="h-4 w-4 mr-1.5" />
                Inline
              </TabsTrigger>
              <TabsTrigger
                value="popover"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5 text-sm"
              >
                <Layers className="h-4 w-4 mr-1.5" />
                Popover
              </TabsTrigger>
              <TabsTrigger
                value="llm"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5 text-sm"
              >
                <MessageSquareText className="h-4 w-4 mr-1.5" />
                LLM-Friendly
              </TabsTrigger>
              <TabsTrigger
                value="email"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5 text-sm"
              >
                <Mail className="h-4 w-4 mr-1.5" />
                Email
              </TabsTrigger>
              <TabsTrigger
                value="transcript"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5 text-sm"
              >
                <FileText className="h-4 w-4 mr-1.5" />
                Transkrypcja
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            <TabsContent value="inline" className="mt-0 space-y-4">
              {showCode ? (
                <div className="bg-muted rounded-md p-3">
                  <code className="text-xs break-all whitespace-pre-wrap select-all">
                    {embedCode}
                  </code>
                </div>
              ) : (
                <>
                  {videoPreviewJsx}
                  {brandingJsx}
                  <Separator />
                  {sizeOptionsJsx}
                  <Separator />
                  {advancedOptionsJsx}
                </>
              )}
            </TabsContent>

            <TabsContent value="popover" className="mt-0 space-y-4">
              {showCode ? (
                <div className="bg-muted rounded-md p-3">
                  <code className="text-xs break-all whitespace-pre-wrap select-all">
                    {embedCode}
                  </code>
                </div>
              ) : (
                <RadioGroup
                  value={popoverMode}
                  onValueChange={setPopoverMode}
                  className="space-y-4"
                >
                  <div className="flex items-start gap-3">
                    <RadioGroupItem value="thumbnail" id="pop-thumb" className="mt-0.5" />
                    <div className="space-y-2">
                      <Label htmlFor="pop-thumb" className="font-medium cursor-pointer">
                        Wyświetl jako miniaturkę
                      </Label>
                      {popoverMode === "thumbnail" && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              value={popoverWidth}
                              onChange={(e) => setPopoverWidth(e.target.value)}
                              className="w-20 h-8 text-sm"
                            />
                            <span className="text-xs text-muted-foreground">×</span>
                            <Input
                              type="number"
                              value={popoverHeight}
                              onChange={(e) => setPopoverHeight(e.target.value)}
                              className="w-20 h-8 text-sm"
                            />
                            <span className="text-xs text-muted-foreground">px</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id="pop-responsive"
                              checked={popoverResponsive}
                              onCheckedChange={(v) => setPopoverResponsive(v === true)}
                            />
                            <Label htmlFor="pop-responsive" className="text-sm cursor-pointer">
                              Responsywny
                            </Label>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <RadioGroupItem value="textlink" id="pop-text" className="mt-0.5" />
                    <div className="space-y-2">
                      <Label htmlFor="pop-text" className="font-medium cursor-pointer">
                        Wyświetl jako link tekstowy
                      </Label>
                      {popoverMode === "textlink" && (
                        <Input
                          value={popoverText}
                          onChange={(e) => setPopoverText(e.target.value)}
                          className="h-8 text-sm"
                          placeholder="Tekst linku..."
                        />
                      )}
                    </div>
                  </div>
                </RadioGroup>
              )}
            </TabsContent>

            <TabsContent value="llm" className="mt-0 space-y-4">
              {showCode ? (
                <div className="bg-muted rounded-md p-3">
                  <code className="text-xs break-all whitespace-pre-wrap select-all">
                    {embedCode}
                  </code>
                </div>
              ) : (
                <>
                  {videoPreviewJsx}
                  {sizeOptionsJsx}
                </>
              )}
            </TabsContent>

            <TabsContent value="email" className="mt-0">
              {placeholderJsx("Osadzanie w emailach")}
            </TabsContent>

            <TabsContent value="transcript" className="mt-0">
              {transcription ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Skopiuj transkrypcję do osadzenia na stronie:
                  </p>
                  <div className="bg-muted rounded-md p-3 max-h-[300px] overflow-y-auto">
                    <pre className="text-xs whitespace-pre-wrap select-all">{transcription}</pre>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(transcription);
                      toast.success("Transkrypcja skopiowana");
                    }}
                  >
                    Kopiuj transkrypcję
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                  <FileText className="h-8 w-8" />
                  <p className="text-sm font-medium">Brak transkrypcji</p>
                  <p className="text-xs">Najpierw wykonaj transkrypcję na stronie wideo</p>
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>

        <div className="border-t border-border px-6 py-3 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowCode((prev) => !prev)}
            className="text-muted-foreground"
          >
            {showCode ? (
              <EyeOff className="h-4 w-4 mr-1.5" />
            ) : (
              <Eye className="h-4 w-4 mr-1.5" />
            )}
            {showCode ? "Ukryj kod embed" : "Pokaż kod embed"}
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
