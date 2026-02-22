
## Zmiana jakosci wideo + Import rozdzialow z tekstu

### 1. Wybor jakosci wideo w playerze

Dodanie przycisku zmiany jakosci (np. ikona zebatki obok mute/fullscreen) w `BrandedVideoPlayer.tsx`.

**Jak to dziala:**
- Po zaladowaniu video, player odczytuje natywna rozdzielczosc (np. 1920x1080 = 1080p, 3840x2160 = 4K)
- Na podstawie rozdzielczosci generuje liste dostepnych jakosci (np. film 4K oferuje: 4K, 1080p, 720p; film 1080p oferuje: 1080p, 720p)
- Przycisk otwiera maly popup z lista jakosci
- Zmiana jakosci = zmiana rozmiaru renderowania video przez CSS (skalowanie w dol) -- przeglądarka nie moze transkodowac wideo po stronie klienta, wiec to bedzie wizualne zmniejszenie rozdzielczosci wyswietlania
- **Uwaga**: prawdziwa zmiana jakosci (transkodowanie do roznych rozdzielczosci) wymaga backendu do przetwarzania wideo (np. FFmpeg). Na ten moment implementujemy selector ktory pokazuje natywna rozdzielczosc i pozwala na ograniczenie renderowania.

**Zmiany w plikach:**
- **`src/components/video/BrandedVideoPlayer.tsx`**:
  - Nowy state: `videoWidth`, `videoHeight`, `selectedQuality`, `showQualityMenu`
  - W `loadedmetadata` odczyt `videoWidth` i `videoHeight`
  - Funkcja generujaca dostepne jakosci (filtruje te nizsze niz natywna)
  - Popup z lista jakosci (nad paskiem kontrolnym)
  - Przycisk zebatki w control bar
  - Zastosowanie `style={{ maxWidth, maxHeight }}` na `<video>` w zaleznosci od wybranej jakosci

### 2. Import rozdzialow z wklejonego tekstu

Dodanie textarea w `ChaptersTab.tsx` do wklejania rozdzialow w formacie:
```
00:00 Wstep
03:20 Pierwsze informacje
15:45 Podsumowanie
```

**Parser rozpoznaje formaty:**
- `00:00 Tytul` (MM:SS spacja tytul)
- `0:00 Tytul` (M:SS spacja tytul)
- `00:00 - Tytul` (z myslnikiem)

**Zmiany w plikach:**
- **`src/components/video/ChaptersTab.tsx`**:
  - Nowy state: `bulkMode`, `bulkText`
  - Przycisk "Wklej rozdzialy" przelacza na textarea
  - Funkcja `parseBulkChapters(text)` -- parsuje kazda linie na `{ timestamp_seconds, title }`
  - Przycisk "Importuj" -- wstawia wszystkie sparsowane rozdzialy do bazy jednym `insert`
  - Podglad ile rozdzialow zostanie zaimportowanych
  - Parser obsluguje format `MM:SS Tytul` oraz `HH:MM:SS Tytul`

### Szczegoly techniczne

**Quality selector w BrandedVideoPlayer:**
```
Dostepne jakosci na podstawie rozdzielczosci:
- 3840px+ szerokosc = 4K, 1080p, 720p, 480p
- 1920px+ = 1080p, 720p, 480p
- 1280px+ = 720p, 480p
- ponizej = 480p (lub "Auto")
```

**Parser rozdzialow:**
```
Input:
"00:00 Wstep
03:20 Pierwsze informacje
15:45 Podsumowanie"

Output:
[
  { timestamp_seconds: 0, title: "Wstep" },
  { timestamp_seconds: 200, title: "Pierwsze informacje" },
  { timestamp_seconds: 945, title: "Podsumowanie" }
]
```

**Modyfikowane pliki:**
- `src/components/video/BrandedVideoPlayer.tsx` -- quality selector
- `src/components/video/ChaptersTab.tsx` -- bulk import rozdzialow
