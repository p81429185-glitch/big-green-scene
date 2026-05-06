## Diagnoza (z trzeciej perspektywy)

Aktualny film, który oglądasz (`0beb09b0-727d-43fd-b51a-7bd677aa32f9`), ma w bazie status `uploading` i `mux_status=pending`, ale **w storage nie ma żadnego pliku**. Edge function `submit-to-mux` loguje `Object not found` co kilka sekund — bo `VideoPlayer` automatycznie wywołuje `submit-to-mux` za każdym razem, gdy widzi `mux_status=pending`.

Przyczyna źródłowa: w `useVideoStore.uploadVideo` rekord w `videos` jest tworzony **PRZED** rozpoczęciem uploadu (status `uploading`). Jeśli upload TUS się nie zakończy (zamknięcie karty, reload, błąd sieci po zerwaniu połączenia), rekord zostaje (cleanup leci tylko w bloku `catch`, który nie wykona się gdy karta zniknie). Efekt: „duch" w bazie + wieczne 500 z Mux + komunikat o błędzie odtwarzania.

Drugi problem: build się sypie na `useVideoCompression.ts:216` (TS2322 BlobPart vs Uint8Array) — to blokuje rebuild po naszych ostatnich zmianach.

## Plan naprawy

### 1. Zmiana cyklu życia rekordu video (`src/hooks/useVideoStore.ts`)
- **Nie tworzyć rekordu w bazie przed uploadem.** Najpierw TUS upload do storage → integrity check (size match) → dopiero wtedy `insert` z `processing_status='pending'`.
- Postęp uploadu trzymamy lokalnie w `useUploadQueue` (już tak działa) — nie potrzebujemy rekordu DB do pokazania paska.
- Jeśli upload się wywali / zostanie anulowany: usuwamy plik ze storage, **bez** śmieciowego rekordu w DB.
- To samo dla `uploadVideoWithSeparateAudio` (już prawie tak działa, drobne porządki).

### 2. Twardszy `submit-to-mux` (`supabase/functions/submit-to-mux/index.ts`)
- Jeśli `createSignedUrl` zwraca `Object not found`: oznaczyć rekord jako `processing_status='failed'`, `mux_status='error'` zamiast tylko zwracać 500.
- Dzięki temu jeden taki przypadek nie będzie ścigał logów co kilka sekund.

### 3. Bezpieczniejszy auto-submit w playerze (`src/pages/VideoPlayer.tsx:110-119`)
- Auto-wywołanie `submit-to-mux` tylko gdy `processing_status === 'pending'` (nie `'uploading'` i nie `'failed'`).
- Po pierwszej nieudanej próbie (response.error) nie ponawiać w tej samej sesji.
- Dla `processing_status='uploading'` lub `'failed'` bez `mux_playback_id` pokazać czytelny komunikat „Upload nie został zakończony — wgraj plik ponownie".

### 4. Fix błędu buildu (`src/hooks/useVideoCompression.ts:216`)
- `new Blob([data], ...)` — `data` z ffmpeg to `FileData` (`Uint8Array<SharedArrayBuffer>`). Zmiana na `new Blob([data as BlobPart], ...)` lub konwersja przez `new Uint8Array(data).buffer`.

### 5. Posprzątanie aktualnych „duchów" w bazie
- Usunąć/oznaczyć jako `failed` rekordy bez obiektu w storage:
  - `0beb09b0-727d-43fd-b51a-7bd677aa32f9` — aktualnie oglądany, status `uploading`, brak pliku.
  - `560c8ccc-578f-4221-88a9-92854e5a2c0a` — `failed`, brak pliku (do usunięcia).
  - `365c65d4-06a4-4414-a950-e691fdc61314` — `uploading`, brak pliku.
  - `e4de2112-0e88-4b5e-b75f-25bf27f0d620` — `ready` ale brak pliku i `mux_asset_id`, do usunięcia.

### 6. Weryfikacja po wdrożeniu
- Sprawdzenie logów `submit-to-mux` (powinny przestać spamować `Object not found`).
- Wgranie nowego pliku >300 MB i potwierdzenie, że rekord pojawia się dopiero po skutecznym uploadzie z poprawnym `stored_size === file.size`.
- Build przechodzi czysto.

## Pliki do zmiany
- `src/hooks/useVideoStore.ts` — przeniesienie `insert` po udanym uploadzie + integrity checku
- `src/hooks/useVideoCompression.ts` — fix typu Blob
- `src/pages/VideoPlayer.tsx` — gating auto-submit i komunikat dla `uploading`/`failed`
- `supabase/functions/submit-to-mux/index.ts` — oznaczanie failed gdy brak obiektu
- migracja DB — czyszczenie duchów

## Efekt
Po wdrożeniu: brak rekordów-duchów, brak nieskończonych 500, czytelny komunikat dla niedokończonych uploadów, build zielony.