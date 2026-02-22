

# Przyspieszenie uploadu wideo

## Problem
Po uploadzie pliku XHR-em, funkcja `uploadVideo` **czeka** na generowanie miniaturki (`generateThumbnail`), ktora:
1. Pobiera caly plik wideo PONOWNIE z serwera (po publicznym URL)
2. Laduje go do tagu `<video>`, czeka na `loadeddata` + `seeked`
3. Dopiero potem robi screenshot i uploaduje miniaturke

To podwaja czas -- plik jest wysylany, a potem sciagany z powrotem. Przy duzych plikach to moze trwac bardzo dlugo.

## Rozwiazanie

### 1. Miniaturka z lokalnego pliku zamiast ponownego pobierania
Zamiast pobierac wideo z serwera, uzyj `URL.createObjectURL(file)` -- plik juz jest w pamieci przegladarki. Zero dodatkowego transferu.

### 2. Generowanie miniaturki w tle (nie blokuje uploadu)
Nie czekamy na miniaturke -- upload konczy sie na 95% (po zapisie metadanych), dialog zamyka sie od razu. Miniaturka generuje sie asynchronicznie w tle.

## Zmiany techniczne

### `src/hooks/useVideoStore.ts`
- Zmiana `generateThumbnail` -- przyjmuje `File` zamiast URL, uzywa `URL.createObjectURL(file)` + `URL.revokeObjectURL()` po zakonczeniu
- W `uploadVideo`: miniaturka generowana w tle (bez `await`), upload konczy sie po zapisie metadanych
- `onProgress(100)` zaraz po insercie metadanych, bez czekania na miniaturke
- Miniaturka aktualizuje state videos po wygenerowaniu w tle

To sprawi ze upload bedzie trwal tyle ile faktyczne przeslanie pliku + 1 sekunde na zapis metadanych. Miniaturka pojawi sie po chwili automatycznie.

