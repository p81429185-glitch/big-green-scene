

## Zapisywanie brandingu do bazy + rozdzialy i napisy przy filmiku

Dwie funkcjonalnosci w jednym podejsciu:

### Czesc 1: Zapis ustawien brandingu do bazy danych

Obecnie `useBrandSettings` zapisuje dane do `localStorage`. Tabela `brand_settings` juz istnieje w bazie, ale aplikacja uzywa wlasnego systemu auth (nie Supabase Auth), wiec polityki RLS oparte na `auth.uid()` nie zadziaja.

**Rozwiazanie**: Zmiana polityk RLS na `true` (jak w tabelach `videos` i `folders`) oraz zapis/odczyt z tabeli `brand_settings` bez `user_id`.

**Zmiany w plikach:**

- **Migracja SQL**: Zmiana RLS na permisywne (USING true / WITH CHECK true) -- analogicznie do tabel `videos` i `folders`. Ustawienie `user_id` jako nullable z domyslna wartoscia.
- **`src/hooks/useBrandSettings.ts`**: Przepisanie hooka zeby:
  - Przy ladowaniu pobierac ustawienia z tabeli `brand_settings` (pierwszy wiersz)
  - Przy zmianie dowolnego ustawienia automatycznie zapisywac do bazy (upsert)
  - Fallback na localStorage gdy brak polaczenia z baza
  - Upload logo do Supabase Storage jak dotychczas

### Czesc 2: Rozdzialy (chapters) i napisy (subtitles) przy filmiku

Nowa tabela `video_chapters` i rozszerzenie strony VideoPlayer o zakladke "Rozdzialy" oraz mozliwosc generowania napisow z transkrypcji.

**Nowa tabela: `video_chapters`**
- `id` (uuid, PK)
- `video_id` (uuid, FK do videos)
- `title` (text) -- nazwa rozdzialu
- `timestamp_seconds` (integer) -- czas w sekundach
- `created_at` (timestamptz)
- RLS: USING true / WITH CHECK true (jak inne tabele)

**Zmiany w `src/pages/VideoPlayer.tsx`:**
- Nowa zakladka "Rozdzialy" w panelu bocznym obok "Szczegoly", "Transkrypcja", "Komentarze"
- W zakladce Rozdzialy:
  - Lista rozdzialow (posortowana po timestamp_seconds)
  - Kazdy rozdzial pokazuje czas (MM:SS) i tytul
  - Klikniecie na rozdzial przesuwa video do tego momentu
  - Formularz dodawania nowego rozdzialu: pole na tytul + pole na czas (MM:SS)
  - Przycisk usuwania rozdzialu
- W zakladce Transkrypcja:
  - Nowy przycisk "Generuj napisy (SRT)" -- konwertuje transkrypcje na format SRT
  - Przycisk "Pobierz SRT" -- pobiera plik .srt
  - Napisy generowane przez edge function ktora dzieli transkrypcje na segmenty z timestampami

**Nowa edge function: `generate-subtitles`**
- Przyjmuje `videoId` jako parametr
- Pobiera transkrypcje z bazy
- Wysyla do Lovable AI (gemini-2.5-flash) z promptem: "Podziel te transkrypcje na napisy w formacie SRT z timestampami co 3-5 sekund"
- Zwraca tekst SRT
- Zapisuje SRT do kolumny `subtitles_srt` w tabeli `videos`

**Nowa kolumna w tabeli `videos`:**
- `subtitles_srt` (text, nullable) -- przechowuje wygenerowane napisy w formacie SRT

### Szczegoly techniczne:

**Migracja SQL:**
1. Zmiana RLS na `brand_settings` (USING true)
2. Utworzenie tabeli `video_chapters`
3. Dodanie kolumny `subtitles_srt` do `videos`

**Nowe pliki:**
- `supabase/functions/generate-subtitles/index.ts` -- edge function generujaca SRT z transkrypcji

**Zmodyfikowane pliki:**
- `src/hooks/useBrandSettings.ts` -- zapis/odczyt z bazy zamiast localStorage
- `src/pages/VideoPlayer.tsx` -- zakladka Rozdzialy + przycisk generowania napisow SRT
- `supabase/config.toml` -- konfiguracja nowej edge function (verify_jwt = false)

**Przepyw uzytkownika (rozdzialy):**
1. Otwiera filmik w VideoPlayer
2. Klika zakladke "Rozdzialy"
3. Wpisuje tytul rozdzialu i czas (np. "Wprowadzenie" o 0:00)
4. Dodaje kolejne rozdzialy
5. Klika na rozdzial -- video przeskakuje do tego momentu

**Przepyw uzytkownika (napisy):**
1. Otwiera filmik, przechodzi do zakladki "Transkrypcja"
2. Jesli transkrypcja istnieje, widzi przycisk "Generuj napisy SRT"
3. Klika -- AI generuje plik SRT z timestampami
4. Moze pobrac plik .srt lub skopiowac tekst

