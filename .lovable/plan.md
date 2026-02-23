

## Poprawa timeline i dodanie przyciskow skip/play

### Problem 1: Wolna i glitchowa linia czasu
Obecny progress bar reaguje tylko na `onClick`, co oznacza ze uzytkownik musi klikac w konkretne miejsce. Nie mozna "ciagnac" wskaznika -- brak obslugi `onMouseDown` + `onMouseMove` + `onMouseUp`. Kazde klikniecie powoduje skok, a brak throttlingu powoduje glitche.

### Problem 2: Brak przyciskow skip 15s i play/pause w widocznym miejscu
Uzytkownik chce przyciski: cofnij 15s, play/pause, przewin 15s do przodu -- w stylu YouTube/Netflix.

### Zmiany

**Plik: `src/components/video/BrandedVideoPlayer.tsx`**

1. **Plynna linia czasu (drag seeking)**
   - Zamiast `onClick` na progress bar, uzyc `onMouseDown` + globalny `onMouseMove` / `onMouseUp`
   - Dodac stan `isSeeking` -- podczas przeciagania aktualizowac pozycje wizualnie (bez ciaglego seekowania video, zeby nie lagowalo)
   - Na `mouseUp` ustawic `video.currentTime` na docelowa pozycje
   - Powiekszyc obszar klikalny progress bara (z h-1 na h-2, z wiekszym padding)
   - Dodac kolko (thumb) na aktualnej pozycji widoczne przy hover/drag

2. **Przyciski skip 15s wstecz / play / skip 15s do przodu**
   - Dodac 3 przyciski w control bar (przed czasem):
     - Cofnij 15s (ikona rotate-ccw)
     - Play/Pause (obecny przycisk)
     - Przewin 15s do przodu (ikona rotate-cw)
   - Funkcje `skip(-15)` i `skip(+15)` zmieniajace `video.currentTime`

### Szczegoly techniczne

Nowa logika drag seek:
```text
onMouseDown na progress bar:
  -> ustaw isSeeking = true
  -> oblicz pozycje i ustaw seekPosition
  
onMouseMove (globalny, tylko gdy isSeeking):
  -> przelicz pozycje na podstawie rect progress bara
  -> aktualizuj seekPosition (wizualnie)
  
onMouseUp (globalny):
  -> ustaw video.currentTime = seekPosition * duration
  -> ustaw isSeeking = false
```

Nowe stany:
- `isSeeking: boolean` -- czy uzytkownik przeciaga
- `seekPosition: number` -- pozycja 0-1 podczas przeciagania

Przyciski skip:
```text
[<<15] [Play/Pause] [15>>]  00:00 / 00:00  [===progress===]  vol  quality  fullscreen
```

Funkcja skip:
```typescript
const skip = useCallback((seconds: number) => {
  const v = videoRef.current;
  if (!v) return;
  v.currentTime = Math.max(0, Math.min(v.duration, v.currentTime + seconds));
}, []);
```

Progress bar z thumbem:
- Wysokosc zwiekszona do h-2 z py-2 padding dla latwiejszego klikania
- Kolko (thumb) 12x12px na aktualnej pozycji, widoczne na hover i podczas drag
- Podczas drag: progress bar pokazuje `seekPosition` zamiast `currentTime`
