
## Naprawa embeda: branding, kontrolki i zabezpieczenie domeny

### Problem 1: Branding nie dziala w embedzie
Wygenerowany kod embed (`generateCustomPlayerCode`) ma hardcoded kolory i nie pobiera ustawien z bazy. Embed jest statycznym HTML -- nie ma dostepu do React Context.

**Rozwiazanie**: Zmodyfikowac `generateCustomPlayerCode` tak aby uzywalo aktualnych wartosci z brand settings (juz przekazywanych jako parametry). Problem polega na tym ze branding w dialogu embedu uzywa lokalnych stanow (`brandColor`, `brandIconColor` itd.) -- te sa juz synchronizowane z global settings. Trzeba upewnic sie ze skip_bg_color tez jest przekazywany do generatora kodu embed.

### Problem 2: Brak kontroli glosnosci i jakosci w embedzie
Wygenerowany embed ma tylko przycisk mute (on/off) bez suwaka glosnosci i nie ma selektora jakosci.

**Rozwiazanie**: Dodac do generowanego kodu embed:
- Suwak glosnosci (`<input type="range">`) obok przycisku mute
- Selector jakosci -- menu z opcjami (480p, 720p, 1080p) ktore zmienia rozmiar renderowania wideo (analogicznie do playera React)

### Problem 3: Zabezpieczenie domeny nie dziala
Obecne sprawdzenie `window.location.hostname` jest czysto klienckie -- latwo je obejsc. Glowny problem: sprawdzenie dziala poprawnie technicznie, ale video URL jest publiczny i mozna go otworzyc bezposrednio.

**Rozwiazanie**: Zabezpieczenie po stronie serwera -- dodac edge function ktora generuje tymczasowe signed URL zamiast uzywac publicznego URL. Embed nie bedzie zawieral bezposredniego linka do pliku.

Kroki:
1. Dodac tabele `video_embed_settings` z kolumnami: `video_id`, `allowed_domains` (text[]), `restrict_domain` (boolean)
2. Utworzyc edge function `get-embed-url` ktora:
   - Sprawdza referer/origin headera
   - Jesli domena nie jest dozwolona, zwraca 403
   - Jesli OK, generuje signed URL (wazny np. 1h) i zwraca go
3. Embed zamiast bezposredniego `<video src="...">` uzywa fetch do edge function zeby pobrac tymczasowy URL
4. Zapisywac ustawienia domeny w bazie przy generowaniu embeda

### Zmiany w plikach

| Plik | Akcja |
|------|-------|
| `src/components/dashboard/EmbedDialog.tsx` | Edycja -- dodac skip_bg_color do generatora, dodac volume slider i quality selector do kodu embed, zapisywac allowed_domains do bazy |
| `supabase/functions/get-embed-url/index.ts` | Nowy -- edge function weryfikujaca domene i generujaca signed URL |
| Migracja SQL | Nowa tabela `video_embed_settings` |

### Szczegoly techniczne

**Zmieniony embed code** bedzie zawieral:
- Volume slider: `<input type="range" min="0" max="1" step="0.05">` z event listenerem zmieniajacym `video.volume`
- Quality selector: przycisk z menu dropdown (generowany czysto w JS/HTML), opcje wyznaczone na podstawie `videoWidth/videoHeight` wideo
- Skip buttons z kolorem `skip_bg_color` (przekazanym jako parametr)

**Edge function `get-embed-url`**:
```
POST /get-embed-url
Body: { video_id: string }
Headers: Referer / Origin

1. Pobierz video_embed_settings dla video_id
2. Jesli restrict_domain=true, sprawdz Origin/Referer vs allowed_domains
3. Jesli nie pasuje -> 403
4. Wygeneruj signed URL z storage (1h TTL)
5. Zwroc { url: signed_url }
```

**Embed code z zabezpieczeniem** -- zamiast statycznego `<video src="URL">`:
```html
<script>
fetch("EDGE_FN_URL/get-embed-url", {
  method: "POST",
  headers: {"Content-Type":"application/json", "apikey":"ANON_KEY"},
  body: JSON.stringify({video_id: "ID"})
})
.then(r => r.json())
.then(d => { document.getElementById("vid").src = d.url; })
.catch(() => { /* show error */ });
</script>
```

**Tabela `video_embed_settings`**:
```sql
CREATE TABLE video_embed_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid REFERENCES videos(id) ON DELETE CASCADE UNIQUE,
  restrict_domain boolean DEFAULT false,
  allowed_domains text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```
RLS: SELECT/INSERT/UPDATE dla authenticated users (wlasciciel wideo).

**Zapis ustawien domeny**: Przy kliknieciu "Kopiuj kod" w EmbedDialog, jesli `domainRestricted=true`, zapisac `allowed_domains` do tabeli `video_embed_settings` i wygenerowac embed code uzywajacy edge function zamiast bezposredniego URL.
