

## Naprawa fullscreen i dodanie kontroli glosnosci

### Problem 1: Fullscreen nie wypelnia ekranu
Styl `videoStyle` ustawia `maxWidth` i `maxHeight` na podstawie wybranej jakosci (np. 854x480 dla 480p). W trybie pelnoekranowym te limity nadal dzialaja, wiec wideo jest male na srodku czarnego ekranu.

### Problem 2: Brak suwaka glosnosci
Aktualnie jest tylko przycisk mute/unmute (wlacz/wylacz dzwiek). Nie mozna ustawic glosnosci np. na 50%.

### Zmiany

**Plik: `src/components/video/BrandedVideoPlayer.tsx`**

1. **Fullscreen fix** -- dodac stan `isFullscreen` i sluchac zdarzenia `fullscreenchange`. W trybie fullscreen nie stosowac `videoStyle` (usunac ograniczenia maxWidth/maxHeight):
   - Dodac `const [isFullscreen, setIsFullscreen] = useState(false);`
   - Dodac `useEffect` nasluchujacy `fullscreenchange` na `containerRef`
   - Zmienic styl video: `style={isFullscreen ? {} : videoStyle}`
   - Dodac klase `object-contain` do video, zeby proporcje sie zachowaly

2. **Suwak glosnosci** -- dodac stan `volume` (0-1) i suwak obok przycisku mute:
   - Dodac `const [volume, setVolume] = useState(1);`
   - Synchronizowac `videoRef.current.volume` ze stanem
   - Dodac element `<input type="range">` miedzy przyciskiem mute a jakoscia
   - Styl suwaka dopasowany do paska kontrolnego (maly, kolorystyka brand kit)
   - Klikniecie ikony mute wycisza/przywraca poprzednia gloscnosc

### Szczegoly techniczne

Fullscreen -- nowy useEffect:
```typescript
useEffect(() => {
  const onFsChange = () => {
    setIsFullscreen(!!document.fullscreenElement);
  };
  document.addEventListener("fullscreenchange", onFsChange);
  return () => document.removeEventListener("fullscreenchange", onFsChange);
}, []);
```

Suwak glosnosci -- nowy element w control bar (miedzy przyciskiem mute a quality):
```typescript
<input
  type="range"
  min="0"
  max="1"
  step="0.05"
  value={muted ? 0 : volume}
  onChange={(e) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    setMuted(val === 0);
    if (videoRef.current) videoRef.current.volume = val;
  }}
  className="w-16 h-1 accent-current cursor-pointer"
  style={{ accentColor: settings.progress_color }}
/>
```

Synchronizacja volume z video:
```typescript
useEffect(() => {
  if (videoRef.current) {
    videoRef.current.volume = muted ? 0 : volume;
  }
}, [volume, muted]);
```
