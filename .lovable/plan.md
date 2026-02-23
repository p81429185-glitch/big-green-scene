

## Usuniecie skip/play z dolnego paska i poprawienie centralnych przyciskow

### Zmiany

**Plik: `src/components/video/BrandedVideoPlayer.tsx`**

1. **Usunac z dolnego control bar** przyciski skip 15s wstecz (linie 330-337), play/pause (linie 339-351), skip 15s do przodu (linie 353-360). Dolny pasek zaczyna sie od czasu, potem progress bar, volume, quality, fullscreen.

2. **Poprawic centralne przyciski overlay** (linie ~255-303) -- uladnic wizualnie:
   - Zwiekszyc gap miedzy przyciskami z `gap-8` na `gap-10`
   - Przyciski skip: zwiekszyc do `w-12 h-12`, tlo `rgba(0,0,0,0.45)` z `backdrop-blur-sm`, ikony 22x22
   - Przycisk play: dodac `backdrop-blur-sm` i lekki cien (`shadow-lg`)
   - Dodac plynna animacje hover na przyciskach (`transition-transform hover:scale-110`)

### Techniczne

Dolny control bar po zmianach:
```text
00:00 / 00:00  [===progress===]  [mute] [vol slider] [quality] [fullscreen]
```

Centralny overlay po zmianach -- wieksze, ladniejsze przyciski z efektem blur i hover scale.
