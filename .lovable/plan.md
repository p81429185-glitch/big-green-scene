

## Naprawa bledu 413 "Maximum size exceeded" przy uploadzie wideo

### Problem
Bucket `videos` w storage ma domyslny limit wielkosci pliku (50MB). Przy wiekszych plikach wideo serwer zwraca blad 413.

### Rozwiazanie
Zwiekszyc limit wielkosci pliku w ustawieniach bucketa `videos` do **5GB** (5368709120 bajtow). Protokol tus juz obsluguje chunked upload z kawaikami po 6MB, wiec jedynym blokerem jest konfiguracja bucketa.

### Zmiany

**1. Migracja SQL** -- aktualizacja limitu bucketa `videos`

```sql
UPDATE storage.buckets
SET file_size_limit = 5368709120
WHERE id = 'videos';
```

To ustawia limit na 5GB, co pokrywa wiekszosc plikow wideo. Sam upload juz dziala przez tus z chunkami 6MB, wiec nie trzeba zmieniac kodu klienta.

### Pliki do edycji

| Plik | Akcja |
|------|-------|
| Migracja SQL | Nowa migracja -- `UPDATE storage.buckets SET file_size_limit` |

Zadne pliki kodu nie wymagaja zmian -- problem jest wylacznie w konfiguracji bucketa.
