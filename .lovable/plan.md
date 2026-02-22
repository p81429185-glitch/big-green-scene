

# Redesign strony wideo -- 1:1 jak Wistia

## Co brakuje vs screenshot Wistia

Obecny layout ma tylko: breadcrumb, tytul, player, 3 karty statystyk. Na screenshocie Wistia widac duzo wiecej elementow:

1. **Header z przyciskami** -- po prawej stronie tytulu: przycisk "..." (menu), "Embed" (niebieski), "Share" (niebieski z dropdown)
2. **Rzad zakladek akcji** pod tytulem: Edit, Customize, Analytics, Social clips (z ikonami)
3. **Dwukolumnowy layout** -- player po lewej, panel boczny po prawej
4. **Prawy panel boczny** -- zakladki "Transcript" / "Comments", informacje o rozdziale, jezyk, tekst transkrypcji
5. **Brak kart statystyk** pod playerem -- te informacje ida do prawego panelu

## Plan zmian

### Plik: `src/pages/VideoPlayer.tsx` -- kompletny redesign

#### Struktura:

```text
+----------------------------------------------------------+
| Content Library  >  Folder Name                          |
+----------------------------------------------------------+
| export dzien 2                    [...] [Embed] [Share]  |
+----------------------------------------------------------+
| Edit | Customize | Analytics | Social clips             |
+----------------------------------------------------------+
|                              |                           |
|                              |  Szczegoly / Komentarze   |
|      VIDEO PLAYER 16:9      |                           |
|                              |  Rozmiar: 178 MB          |
|                              |  Data: 22.02.2026         |
|                              |  Odtworzenia: 15          |
|                              |  Plik: nazwa.mp4          |
+------------------------------+---------------------------+
```

#### Szczegoly:

1. **Breadcrumb** -- bez przycisku "Wstecz" (strzalki), sam breadcrumb z ikonami folderow jak na Wistia
2. **Header row** -- tytul po lewej, po prawej 3 przyciski:
   - `MoreHorizontal` (menu) -- na razie bez akcji
   - "Udostepnij" -- kopiuje link do wideo do schowka (toast z potwierdzeniem)
   - "Osadz" -- pokazuje dialog z kodem embed `<iframe>`
3. **Zakladki akcji** -- rzad ikon z etykietami (Edit, Dostosuj, Analityka, Klipy) -- na razie jako placeholder, klikniecie pokazuje toast "Wkrotce dostepne"
4. **Layout 2-kolumnowy** (`grid grid-cols-1 lg:grid-cols-3 gap-6`):
   - Lewa kolumna (`lg:col-span-2`): player wideo
   - Prawa kolumna (`lg:col-span-1`): panel z zakladkami
5. **Prawy panel** -- Card z zakladkami (Tabs):
   - "Szczegoly" -- rozmiar, data, odtworzenia, nazwa pliku
   - "Komentarze" -- placeholder "Brak komentarzy"
6. **Karty statystyk** usuwane -- info przeniesione do prawego panelu
7. **Responsywnosc** -- na mobile prawy panel pod playerem (single column)

### Nowe importy:
- `MoreHorizontal`, `Code`, `Share2`, `Scissors`, `Settings`, `BarChart3`, `Pencil` z lucide-react
- `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` z komponentow UI
- `toast` z sonner (do kopiowania linku)

### Logika bez zmian:
- Pobieranie wideo z bazy
- Pobieranie folderu
- Generowanie URL
- Inkrementacja plays

