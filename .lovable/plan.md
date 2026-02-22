

## Upload napisow SRT + Player z brandingiem

### Problem 1: Brak mozliwosci wklejenia/uploadu pliku SRT
Obecnie napisy SRT mozna tylko generowac z AI. Uzytkownik chce moc wkleic wlasny plik SRT i wyswietlac napisy na playerze.

### Problem 2: Player nie uzywa ustawien brandingu
Na stronie VideoPlayer jest zwykly natywny `<video controls>` bez zadnego brandingu (logo, kolory). Player powinien wygladac jak ten z podgladu w EmbedDialog -- z wlasnym paskiem kontrolnym, logo, kolorami z Brand Kit.

---

### Zmiany:

**1. `src/components/video/TranscriptionTab.tsx` -- upload/wklejanie SRT**
- Dodanie przycisku "Wgraj plik SRT" z inputem `<input type="file" accept=".srt">`
- Po wybraniu pliku: odczyt zawartosc, zapisanie do bazy (`subtitles_srt` w tabeli `videos`) i aktualizacja stanu
- Mozliwosc wklejenia tekstu SRT recznie (textarea z przyciskiem "Zapisz napisy")
- Jesli napisy juz sa wgrane, pokazanie ich w ScrollArea z opcja edycji/podmiany

**2. `src/components/video/BrandedVideoPlayer.tsx` -- nowy komponent customowego playera**
- Wlasny player z kontrolkami (play/pause, pasek postepu, czas, glosnosc, fullscreen)
- Pobiera ustawienia brandingu z `useBrandSettings` (kolory paska, ikon, postepu, logo)
- Wyswietla logo w prawym gornym rogu
- Pasek kontrolny na dole z kolorami z Brand Kit
- Duzy przycisk play na srodku z kolorem brandu
- Obsluga napisow SRT: parsowanie SRT do tablicy segmentow z timestampami i wyswietlanie aktualnego napisu na video (overlay)
- Props: `src`, `poster`, `subtitlesSrt`, `onTimeUpdate`, `ref` do seekowania

**3. `src/pages/VideoPlayer.tsx` -- zamiana natywnego video na BrandedVideoPlayer**
- Import `BrandedVideoPlayer` zamiast natywnego `<video>`
- Przekazanie `subtitlesSrt` do playera
- Zachowanie ref do seekowania z rozdzialow

### Szczegoly techniczne:

**Parser SRT** (wbudowany w BrandedVideoPlayer):
- Parsuje format SRT na tablice `{ id, startTime, endTime, text }`
- W `timeupdate` event sprawdza ktory napis powinien byc widoczny
- Wyswietla napis jako overlay na dole video

**Custom kontrolki playera:**
- Hover na playerze pokazuje pasek kontrolny (jak w EmbedDialog preview)
- Click na video = play/pause
- Pasek postepu klikalny do seekowania
- Przycisk fullscreen
- Przycisk mute/unmute
- Czas aktualny / calkowity

**Upload SRT w TranscriptionTab:**
- `<input type="file" accept=".srt">` ukryty za przyciskiem
- FileReader do odczytu zawartosci
- Zapis do bazy: `supabase.from("videos").update({ subtitles_srt: srtContent }).eq("id", videoId)`
- Textarea do recznej edycji/wklejenia SRT

