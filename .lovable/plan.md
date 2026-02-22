

# Redesign dialogu "Osadz" -- styl Wistia

## Obecny stan
Prosty dialog z jednym blokiem kodu iframe i przyciskiem "Kopiuj kod". Brakuje zakladek, opcji rozmiaru, podgladu wideo i profesjonalnego layoutu.

## Docelowy wyglad (na wzor screenshotow Wistia)

Dialog z pelnym zestawem opcji osadzania:

### Struktura dialogu:

**Naglowek:**
- Tytul: "Osadz media" (bold, duzy)
- Podtytul: "Wybierz sposob osadzania."
- Zielony banner informacyjny z ikona: "Standardowe osadzanie inline jest najlepsze dla wiekszosci platform CMS."

**Zakladki glowne (5 zakladek):**
1. **Inline** (domyslna) -- osadzanie bezposrednie
2. **Popover** -- osadzanie jako popup
3. **LLM-Friendly** -- osadzanie przyjazne dla LLM
4. **Email** -- osadzanie w emailach
5. **Transkrypcja** -- osadzanie transkrypcji

### Zakladka "Inline":
- Podglad wideo (miniaturka/player w ramce)
- Opcje rozmiaru z radio buttons:
  - **Responsywny** (zalecany, domyslny) -- "Najlatwiejsza opcja. Player dostosuje sie do szerokosci kontenera."
  - **Staly rozmiar** -- pola input na szerokosc (640) i wysokosc (360)
- Rozwijana sekcja "Zaawansowane opcje":
  - Radio: **Standardowy** (zalecany JS embed) / **Fallback** (iframe)
  - Checkbox: "Uzyj starszego kodu embed"
  - Checkbox: "Uzyj oEmbed URL"
  - Checkbox: "Dodaj metadane SEO" (domyslnie wlaczony)

### Zakladka "Popover":
- Radio: **Wyswietl jako miniaturke** -- pola 150x84, checkbox "Responsywny"
- Radio: **Wyswietl jako link tekstowy** -- pole input z placeholderem

### Zakladka "LLM-Friendly":
- Podglad wideo
- Te same opcje rozmiaru co Inline (Responsywny / Staly rozmiar)

### Zakladka "Email":
- Placeholder: "Wkrotce dostepne" (funkcja wymaga generowania miniaturek z linkiem)

### Zakladka "Transkrypcja":
- Placeholder: "Wkrotce dostepne" (wymaga systemu transkrypcji)

### Stopka dialogu (stala na dole):
- Przycisk "Pokaz kod embed" (ikona oka) -- przelacza widok na surowy kod
- Przycisk "Kopiuj kod" (niebieski/primary, ikona `</>`) -- kopiuje wygenerowany kod do schowka

## Zmiany techniczne

### Plik: `src/pages/VideoPlayer.tsx`

1. **Nowy stan:**
   - `embedTab` -- aktywna zakladka ("inline" | "popover" | "llm" | "email" | "transcript")
   - `embedSizeMode` -- "responsive" | "fixed"
   - `embedWidth` / `embedHeight` -- wymiary dla fixed size (domyslnie 640x360)
   - `embedMethod` -- "standard" | "fallback"
   - `showEmbedCode` -- toggle do pokazywania surowego kodu
   - `injectSeo` -- checkbox SEO metadata
   - `popoverMode` -- "thumbnail" | "textlink"
   - `popoverWidth` / `popoverHeight` -- wymiary miniaturki popover
   - `popoverText` -- tekst linku

2. **Generowanie kodu embed** -- funkcja `generateEmbedCode()` ktora na podstawie wybranych opcji generuje odpowiedni kod:
   - Inline responsive: `<div style="position:relative;padding-bottom:56.25%;..."><iframe ...></div>`
   - Inline fixed: `<iframe width="640" height="360" ...>`
   - Popover thumbnail: `<a href="..." class="..."><img ...></a>`
   - Popover text link: `<a href="...">tekst</a>`

3. **Nowy komponent dialogu** -- znacznie rozbudowany `DialogContent` z:
   - Tabs z 5 zakladkami
   - Formularz opcji w kazdej zakladce
   - Podglad wideo (miniaturka lub player)
   - Sekcja "Zaawansowane opcje" z Collapsible
   - Stopka z dwoma przyciskami

4. **Nowe importy:**
   - `RadioGroup`, `RadioGroupItem` z UI
   - `Checkbox` z UI
   - `Input` z UI
   - `Label` z UI
   - `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent` z UI
   - `Eye`, `ChevronDown`, `ChevronUp`, `Info` z lucide-react

### Plik: Mozliwe wydzielenie do `src/components/dashboard/EmbedDialog.tsx`
Ze wzgledu na zlozonosc, dialog embed moze zostac wydzielony do osobnego komponentu, zeby VideoPlayer.tsx nie byl zbyt duzy.

