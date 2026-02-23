

## Redesign dialogu Embed -- wiekszy, czystszy, wygodniejszy

### Problem
Dialog embed jest za maly (`max-w-2xl` = 672px), wszystko jest scisnete w jednej kolumnie, podglad jest malutki, i calosc wyglada na zatloczona. Uzytkownik nie widzi wszystkiego wygodnie.

### Rozwiazanie

Przeprojektowac dialog na **layout dwukolumnowy w pelnym ekranie**:
- Lewa kolumna: ustawienia (rozmiar, branding, zaawansowane opcje)
- Prawa kolumna: duzy podglad na zywo (browser mockup z iframe) -- **zawsze widoczny**, nie trzeba klikac przycisku

### Zmiany w `EmbedDialog.tsx`

1. **Wiekszy dialog**: `max-w-6xl` zamiast `max-w-2xl`, `h-[90vh]`

2. **Layout dwukolumnowy**:
   - Lewa strona (~40%): ustawienia w ScrollArea -- taby (Inline/Popover/LLM/Email/Transkrypcja), rozmiar, branding, zaawansowane opcje
   - Prawa strona (~60%): duzy podglad embed w browser mockup z iframe `srcDoc` -- aktualizuje sie na zywo przy kazdej zmianie ustawien

3. **Podglad zawsze widoczny**: Usunac osobny przycisk "Podglad" i stan `previewMode` -- podglad jest po prostu zawsze po prawej stronie. Przycisk "Pokaz kod" przelacza prawa strone miedzy podgladem a kodem.

4. **Czystszy footer**: Tylko "Pokaz kod" i "Kopiuj kod" -- bez "Podglad" (bo juz widoczny)

5. **Browser mockup w prawej kolumnie**:
   - Symulowany pasek przegladarki (kropki + URL bar)
   - iframe z `srcDoc` renderujacy `embedCode` na zywo
   - Duzy, czytelny podglad zajmujacy cala prawda strone

### Schemat layoutu

```text
+------------------------------------------------------------------+
| Osadz media                                                   [X]|
| Info banner                                                      |
+------------------------------------------------------------------+
| Taby: Inline | Popover | LLM | Email | Transkrypcja             |
+-------------------------------+----------------------------------+
|  USTAWIENIA (scroll)          |  PODGLAD NA ZYWO                 |
|                               |  [o o o] https://your-site.com   |
|  [Miniaturka]                 |  +------------------------------+ |
|  [Branding v]                 |  |                              | |
|  [Rozmiar]                    |  |   iframe z embedCode         | |
|  [Zaawansowane v]             |  |                              | |
|                               |  +------------------------------+ |
+-------------------------------+----------------------------------+
| [Pokaz kod]                              [Kopiuj kod]            |
+------------------------------------------------------------------+
```

### Plik do edycji

| Plik | Akcja |
|------|-------|
| `src/components/dashboard/EmbedDialog.tsx` | Edycja -- nowy layout dwukolumnowy, wiekszy dialog, podglad zawsze widoczny |

### Szczegoly techniczne

- Dialog: `max-w-6xl h-[90vh]` z `flex flex-col`
- Srodkowa czesc: `grid grid-cols-5 gap-0 flex-1 min-h-0` (2 kolumny na ustawienia, 3 na podglad)
- Lewa kolumna: `col-span-2 border-r overflow-y-auto p-4` z ustawieniami
- Prawa kolumna: `col-span-3 p-4 flex flex-col` z browser mockup i iframe
- Usunac stan `previewMode` -- podglad jest domyslny w prawej kolumnie
- Gdy `showCode=true`, prawa kolumna pokazuje kod zamiast iframe
- iframe: `sandbox="allow-scripts"` z `srcDoc` renderujacym embedCode, `flex-1` zeby zajmowal cala dostepna przestrzen

