

## Chunked upload -- obsluga duzych plikow wideo

### Problem
Obecny upload wysyla caly plik jednym requestem HTTP. Backend ma domyslny limit ~50MB na plik, wiec wieksze filmy nie przechodza.

### Rozwiazanie
Implementacja uploadu w kawalkach (chunked upload) uzywajac protokolu **tus**, ktory jest natywnie wspierany przez storage backend. Pozwala to na:
- Upload plikow do ~5GB
- Wznawianie przerwanych uploadow
- Pokazywanie progresu

### Co sie zmieni

**1. Nowa biblioteka**
- Instalacja `tus-js-client` -- lekka biblioteka do chunked upload

**2. Modyfikacja `src/hooks/useVideoStore.ts`**
- Zamiana funkcji `uploadFileXHR` na nowa `uploadFileTus`
- Uzycie `tus-js-client` do uploadu w kawalkach po 6MB
- Zachowanie tego samego interfejsu (`onProgress` callback)
- Sciezka uploadu: `POST /storage/v1/upload/resumable` (endpoint tus w storage)

**3. Bez zmian w innych plikach**
- `useUploadQueue.ts` -- bez zmian (wywoluje `uploadVideo` ktore samo uzyje tus)
- `UploadQueue.tsx` -- bez zmian (progress nadal dziala)
- `UploadDialog.tsx` -- bez zmian

### Szczegoly techniczne

Nowa funkcja `uploadFileTus`:
```text
1. Pobierz token sesji uzytkownika
2. Utworz instancje tus.Upload z parametrami:
   - endpoint: {SUPABASE_URL}/storage/v1/upload/resumable
   - headers: Authorization + apikey
   - chunkSize: 6MB
   - metadata: bucketName=videos, objectName=storagePath, contentType
   - onProgress: callback z procentem
   - onSuccess: resolve promise
   - onError: reject promise
3. Wywolaj upload.start()
```

Rozmiar chunka 6MB zapewnia stabilnosc nawet na wolniejszych laczach. Tus automatycznie wznawia upload jesli cos sie przerwie.

### Modyfikowane pliki

| Plik | Zmiana |
|------|--------|
| `package.json` | Dodanie `tus-js-client` |
| `src/hooks/useVideoStore.ts` | Zamiana `uploadFileXHR` na `uploadFileTus` z protokolem tus |

