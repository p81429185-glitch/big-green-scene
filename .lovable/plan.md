

# Redesign strony odtwarzacza wideo -- styl Wistia

## Obecny stan
Strona `/video/:id` to pelnoekranowy czarny odtwarzacz z malym headerem -- wyglada jak surowy player, nie jak profesjonalna strona do udostepniania wideo.

## Docelowy wyglad (na wzor Wistia)
Biala/jasna strona z normalnym layoutem:
- **Gora**: przycisk "Wstecz" + breadcrumb (sciezka folderu)
- **Tytul wideo**: duzy, wyrazny, pod breadcrumbem
- **Odtwarzacz**: w srodku strony, z proporcjami 16:9, zaokraglone rogi, nie na calym ekranie
- **Pod odtwarzaczem**: sekcja z informacjami -- rozmiar, data, liczba odtworzen
- **Prawy panel (opcjonalnie na duzych ekranach)**: dodatkowe info

## Zmiany techniczne

### Plik: `src/pages/VideoPlayer.tsx`
Kompletny redesign layoutu:

- **Tlo**: `bg-background` (jasne) zamiast `bg-black`
- **Kontener**: max-width (np. `max-w-5xl mx-auto`) z paddingiem, nie fullscreen
- **Breadcrumb**: gora strony -- "Dashboard > Nazwa folderu > Nazwa wideo" z linkami
- **Tytul**: duzy heading (`text-2xl font-bold`) pod breadcrumbem
- **Odtwarzacz**: `aspect-video` (16:9), `rounded-lg overflow-hidden`, cien (`shadow-lg`), tlo czarne tylko wewnatrz odtwarzacza
- **Sekcja info pod odtwaczem**: karty/statystyki w wierszu:
  - Rozmiar pliku
  - Data dodania
  - Liczba odtworzen
- **Responsywnosc**: na mobile odtwarzacz na cala szerokosc, na desktopie wycentrowany z max-width

### Struktura layoutu:
```text
+------------------------------------------+
| <- Wstecz    Dashboard > Folder > Video  |
+------------------------------------------+
| Tytul wideo                              |
| tekst-xs: nazwa_pliku.mp4               |
+------------------------------------------+
|                                          |
|   +----------------------------------+   |
|   |                                  |   |
|   |        VIDEO PLAYER 16:9        |   |
|   |                                  |   |
|   +----------------------------------+   |
|                                          |
+------------------------------------------+
| Rozmiar     |  Data      | Odtworzenia  |
| 178.0 MB    | 22.02.2026 | 2            |
+------------------------------------------+
```

### Szczegoly implementacji:
- Uzycie istniejacych komponentow UI: `Card`, `Button`, `Separator`
- Breadcrumb z `react-router-dom` Link
- Statystyki w gridzie 3-kolumnowym
- Zachowanie logiki pobierania wideo i incrementowania plays bez zmian
