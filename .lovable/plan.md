

## Podglad embed w oknie podgladu

### Obecny stan
Dialog embed ma maly statyczny podglad brandingu (miniaturka z nalozonymi kolorami), ale nie pokazuje jak embed bedzie wygladal na prawdziwej stronie -- z kontrolkami, volume sliderem, skip buttonami itp.

### Zmiana

Dodac przycisk "Podglad embed" obok "Pokaz kod embed" w dolnym pasku dialogu. Po kliknieciu, zamiast kodu zrodlowego, wyswietlic iframe z renderowanym kodem embed w symulowanym kontekscie strony.

#### Szczegoly implementacji

**Nowy stan**: `previewMode` (boolean) -- przelacza miedzy normalnym widokiem ustawien a podgladem.

**Rendering podgladu**:
- Uzyc `srcDoc` na elemencie `<iframe>` -- wstrzyknac wygenerowany `embedCode` opakowany w minimalne HTML z bialym tlem i centrowanym contentem
- iframe bedzie mial styl `width:100%; aspect-ratio:16/9; border:1px solid border`
- Nad iframe bedzie pasek symulujacy przegladarke (szare tlo + fake URL bar) dla realizmu

**Szablon HTML dla iframe srcDoc**:
```html
<!DOCTYPE html>
<html>
<head><style>body{margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f5f5f5;font-family:sans-serif;}</style></head>
<body>
  ${embedCode}
</body>
</html>
```

**Umiejscowienie**: Podglad zastapi zawartosc aktywnego taba (tak jak `showCode` zastepuje ustawienia kodem). Przyciski w dolnym pasku: "Podglad" | "Pokaz kod" | "Kopiuj kod".

#### Zmiany w pliku

| Plik | Akcja |
|------|-------|
| `src/components/dashboard/EmbedDialog.tsx` | Edycja -- dodac stan `previewMode`, przycisk w footer, renderowanie iframe z `srcDoc` |

#### Techniczne szczegoly

W `EmbedDialog.tsx`:

1. Nowy stan: `const [previewMode, setPreviewMode] = useState(false);`

2. Nowy JSX dla podgladu (wyswietlany gdy `previewMode === true`):
   - Symulowany pasek przegladarki (szary div z okraglymi "kropkami" i polem URL)
   - `<iframe sandbox="allow-scripts" srcDoc={...} />` z wygenerowanym embedCode
   - Iframe ma wylaczony allow-same-origin dla bezpieczenstwa

3. Logika przelaczania w TabsContent:
   - Jesli `previewMode` -> pokaz podglad iframe
   - Jesli `showCode` -> pokaz kod
   - W przeciwnym razie -> pokaz ustawienia

4. W dolnym pasku dodac przycisk "Podglad" z ikona `Monitor`:
   ```
   <Button onClick={() => { setPreviewMode(!previewMode); setShowCode(false); }}>
     <Monitor /> Podglad
   </Button>
   ```

5. Klikniecie "Pokaz kod" wylacza `previewMode` i odwrotnie -- wzajemne wylaczanie.

