

## Branding w embed -- wlasne logo, kolory i customowy player

Dodanie sekcji "Branding" w EmbedDialog, ktora pozwoli uzytkownikowi dostosowac wyglad odtwarzacza w embedzie: wlasne logo, kolor paska kontrolnego, kolor przycisku play, kolor tla, kolor tekstu. Wygenerowany kod embed bedzie zawieral customowy odtwarzacz HTML/CSS/JS zamiast zwyklego tagu `<video controls>`.

### Nowe opcje w interfejsie EmbedDialog:

1. **Logo URL** -- pole tekstowe na adres URL logo (wyswietlane w rogu playera)
2. **Kolor paska kontrolnego** -- color picker (domyslnie zielony jak na screenshocie)
3. **Kolor przyciskow/ikon** -- color picker (domyslnie bialy)
4. **Kolor paska postepu** -- color picker (domyslnie bialy/jasny)
5. **Kolor tla przycisku play** -- color picker (domyslnie polprzezroczysty z kolorem paska)
6. **Podglad na zywo** -- miniatura playera w dialogu z zastosowanymi kolorami

### Zmiany w plikach:

**`src/components/dashboard/EmbedDialog.tsx`**
- Nowe stany: `brandColor` (hex, domyslnie `#16a34a` -- zielony), `brandIconColor` (hex, domyslnie `#ffffff`), `brandProgressColor` (hex, domyslnie `#ffffff`), `brandLogoUrl` (string, domyslnie pusty), `brandPlayBgColor` (hex)
- Nowa sekcja "Branding" widoczna w zakladce Inline (miedzy podgladem a rozmiarem) -- zawiera:
  - Input na URL logo
  - Rząd color pickerow (natywny `<input type="color">`) z labelkami
  - Podglad playera z zastosowanymi kolorami (statyczny HTML renderowany w komponencie)
- Zmiana generowania `embedCode` -- zamiast prostego `<iframe>` lub `<video controls>`, generuje samodzielny blok HTML z:
  - `<video>` bez natywnych kontrolek (`controls` usuniete)
  - Customowy pasek kontrolny zbudowany z div-ow i inline CSS:
    - Przycisk play/pause (SVG ikona)
    - Aktualny czas / calkowity czas
    - Pasek postepu (klikany, z wypelnieniem w wybranym kolorze)
    - Przycisk glosnosci
    - Przycisk fullscreen
    - Przycisk CC (napisy)
    - Przycisk ustawien
    - Logo w prawym gornym rogu playera (jesli podano URL)
  - Inline `<script>` obslugujacy play/pause, seekowanie, postep, fullscreen
  - Wszystkie kolory jako inline style (zadnych zewnetrznych CSS)

### Przyklad wygenerowanego kodu:

```text
<div style="position:relative;max-width:100%;background:#000;border-radius:8px;overflow:hidden;" id="player-xyz">
  <img src="https://logo.url/logo.png" style="position:absolute;top:12px;right:12px;height:30px;z-index:10;" />
  <video src="..." style="width:100%;display:block;" id="vid-xyz"></video>
  <div style="position:absolute;bottom:0;left:0;right:0;background:#16a34a;padding:8px 12px;display:flex;align-items:center;gap:8px;">
    <button onclick="..." style="background:none;border:none;color:#fff;cursor:pointer;">
      <!-- SVG play/pause -->
    </button>
    <span style="color:#fff;font-size:12px;">0:00 / 53:17</span>
    <div style="flex:1;height:4px;background:rgba(255,255,255,0.3);border-radius:2px;cursor:pointer;" onclick="...">
      <div style="width:0%;height:100%;background:#fff;border-radius:2px;"></div>
    </div>
    <!-- volume, CC, settings, fullscreen buttons -->
  </div>
  <script>/* player logic */</script>
</div>
```

### Podglad w dialogu:

Podglad wideo (`videoPreviewJsx`) zostanie rozszerzony o nakladke symulujaca wyglad paska kontrolnego z wybranymi kolorami -- uzytkownik widzi jak bedzie wygladal embed jeszcze przed skopiowaniem kodu.

### Szczegoly techniczne:

- Color pickery: natywny HTML `<input type="color">` -- dziala wszedzie, nie wymaga bibliotek
- Logo: prosty `<img>` z `position:absolute` w rogu playera; jesli URL pusty -- brak logo
- Customowy player JS w embedzie obsluguje: play/pause, seekowanie kliknieciem na pasek, aktualizacje czasu, fullscreen (Fullscreen API), toggle glosnosci
- Wszystko inline (zero zewnetrznych zaleznosci) -- embed dziala na kazdej stronie
- Kolory sa wstawiane jako wartosci hex bezposrednio w atrybutach `style`
- Podglad w dialogu uzywa tych samych kolorow renderowanych jako overlay na miniaturze

