## Problem

Pliki >200MB psują się przy wysyłce. Po naszej analizie znaleźliśmy realną przyczynę.

## Root cause

W `src/hooks/useVideoStore.ts` (linia ~358) w funkcji `uploadVideo`, dla każdego pliku MP4/MOV bez „faststart" wywoływane jest:

```ts
const fullBuffer = await cleanFile.arrayBuffer();
// ... potem processFileInWorker(fullBuffer)
```

To **ładuje cały plik do RAM przeglądarki** (a worker dostaje go w transferze, więc kolejna kopia 1:1). Dla pliku 300 MB–1 GB:

- przeglądarka rzuca `RangeError: Array buffer allocation failed` lub OOM,
- worker pada, `catch` wpada w `toast.error("Błąd optymalizacji")`,
- dalej kod próbuje uploadować `cleanFile`, ale po wcześniejszym `stripVideoMetadata` referencje do oryginalnego File potrafią być niestabilne, a w wielu przypadkach przeglądarka zostaje już w stanie OOM i TUS nie kończy uploadu.
- W efekcie rekord w `videos` powstaje rzadko / albo z uszkodzonym plikiem → embed/odtwarzanie nie działa.

To jest klasyczny problem już znany na tym projekcie (mamy memory: „Client-side processing… Web Workers to bypass Edge memory limits"), ale pełny `arrayBuffer()` nadal omija to zabezpieczenie.

`stripVideoMetadata` ma już ścieżkę „large file" opartą o `Blob.slice()` i działa OK do dużych rozmiarów — problem to wyłącznie etap **faststart**.

Mux i tak transkoduje plik do HLS po stronie serwera, więc faststart na oryginalnym MP4 jest potrzebny **tylko do fallbacku**, zanim Mux skończy. Dla dużych plików rezygnacja z faststartu jest bezpieczna: HLS z Mux załatwia szybkie odtwarzanie.

## Fix (1 plik)

**`src/hooks/useVideoStore.ts`**, w `uploadVideo`:

1. Dodać próg `FASTSTART_MAX_SIZE = 250 * 1024 * 1024` (250 MB).
2. Jeśli `cleanFile.size > FASTSTART_MAX_SIZE` → pominąć faststart całkowicie (`isProcessed = false`, `fileToUpload = cleanFile`), pokazać delikatny `toast.info("Duży plik – optymalizacja zostanie wykonana po stronie serwera (Mux).")`.
3. Dla plików ≤250 MB: zachować obecną ścieżkę (worker), ale opakować `arrayBuffer()` w try/catch, żeby OOM nie blokował całego uploadu — w razie błędu lecimy z `cleanFile` dalej, a Mux dorobi resztę.
4. Upewnić się, że `processing_status: "pending"` + późniejszy webhook Mux ustawia `ready` (już działa).

Dzięki temu:
- TUS upload (3 MB chunki, już działa) jest jedyną operacją na dużych plikach,
- nie ma allokacji 300 MB+ w pamięci przeglądarki,
- plik trafia do storage poprawnie, Mux generuje HLS i `mp4_support: capped-1080p`,
- embed i player (HLS-first, MP4 fallback) działają normalnie.

## Walidacja po wdrożeniu

1. Wgrać plik ~500 MB MP4 → sprawdzić, że upload kończy się 100%, rekord w `videos` ma `mux_status: processing`, po chwili `ready`.
2. Otworzyć player + embed → HLS gra od razu.
3. Sprawdzić logi `submit-to-mux` i `mux-webhook` (powinny być 200, status `ready`).

## Czego NIE zmieniamy

- `stripVideoMetadata` (już chunked, OK).
- `submit-to-mux` (działa po ostatnim fixie `mp4_support`).
- TUS / `chunkSize` (3 MB jest OK dla Supabase Storage resumable).
- Konfiguracji bucketów / RLS.
