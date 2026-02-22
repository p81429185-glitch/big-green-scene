

## Zwiększenie limitu rozmiaru plików w storage

### Problem
Bucket `videos` ma domyślny limit rozmiaru pliku (~50MB). Chunked upload (tus) działa poprawnie, ale sam bucket odrzuca pliki większe niż limit -- stąd błąd 413 "Maximum size exceeded".

### Rozwiązanie
Jedna migracja SQL zwiększająca `file_size_limit` na buckecie `videos` do 5GB (5368709120 bajtów).

```sql
UPDATE storage.buckets
SET file_size_limit = 5368709120
WHERE id = 'videos';
```

### Szczegóły techniczne
- `file_size_limit` ustawiony na `5368709120` (5 * 1024 * 1024 * 1024 = 5GB)
- Chunk size w tus pozostaje 6MB -- to jest rozmiar pojedynczego kawałka, nie całego pliku
- Żadne zmiany w kodzie frontendu nie są potrzebne

### Modyfikowane pliki

| Plik | Zmiana |
|------|--------|
| Migracja SQL | `UPDATE storage.buckets SET file_size_limit = 5368709120 WHERE id = 'videos'` |

