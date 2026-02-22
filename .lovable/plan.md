

# Usuwanie metadanych z plikow wideo przed uploadem

## Problem
Pliki wideo nagrane telefonem lub kamera zawieraja ukryte metadane: lokalizacja GPS, model urzadzenia, data/czas, nazwa uzytkownika, oprogramowanie. Ktos kto pobierze udostepniony filmik moze odczytac te dane i zidentyfikowac osobe ktora go nagrala.

## Rozwiazanie: Usuwanie metadanych po stronie przegladarki (client-side)

Pliki MP4/MOV skladaja sie z "atomow" (blokow danych). Metadane sa w atomach `udta` (user data -- GPS, urzadzenie) i `meta` (metadata) wewnatrz glownego atomu `moov`. Mozna je usunac bez re-enkodowania wideo -- jakos pozostaje 100% nienaruszona, zmienia sie tylko kontener.

Podejscie client-side jest najlepsze bo:
- Zero dodatkowego transferu (nie trzeba sciagac pliku z serwera i ponownie uploadowac)
- Dzialanie jest natychmiastowe (parsowanie binarnych atomow jest szybkie)
- Nie obciaza serwera
- Dziala dla dowolnie duzych plikow

## Zmiany techniczne

### 1. Nowy plik `src/lib/stripVideoMetadata.ts`
Parser atomow MP4/MOV ktory:
- Czyta plik jako ArrayBuffer
- Przechodzi przez atomy pliku (ftyp, moov, mdat, itp.)
- Wewnatrz atomu `moov` rekurencyjnie przechodzi przez sub-atomy
- Usuwa atomy `udta` (user data -- zawiera GPS, info o urzadzeniu) i `meta` (dodatkowe metadane)
- Sklada nowy plik z pozostalych atomow
- Zwraca oczyszczony Blob o tym samym typie MIME
- Dla plikow nie-MP4 (np. AVI, MKV) -- zwraca oryginalny plik bez zmian (te formaty sa rzadko uzywane na telefonach)

### 2. Zmiana w `src/hooks/useVideoStore.ts`
- Import funkcji `stripVideoMetadata`
- W `uploadVideo`, przed wywolaniem `uploadFileXHR`, przepuszczenie pliku przez stripper:
  ```
  const cleanFile = await stripVideoMetadata(file);
  await uploadFileXHR(cleanFile, storagePath, onProgress);
  ```
- Miniaturka generowana z oryginalnego pliku (nie z oczyszczonego) -- to nie ma znaczenia bo miniaturka to tylko obraz

### 3. Zmiana w `src/hooks/useUploadQueue.ts`
- Dodanie nowego statusu `"cleaning"` wyswietlanego przed uploadem
- Gdy plik jest czyszczony z metadanych, status zmienia sie na "cleaning"

### 4. Zmiana w `src/components/dashboard/UploadQueue.tsx`
- UI dla statusu "cleaning": ikona tarczy/zamka + tekst "Usuwanie metadanych..."

### Jakie metadane sa usuwane:
- Lokalizacja GPS (szerokosc/dlugosc geograficzna)
- Model urzadzenia (np. "iPhone 15 Pro")
- Wersja oprogramowania
- Data i czas nagrania (w metadanych -- w samym wideo czas pozostaje)
- Nazwa uzytkownika/artysty
- Komentarze i opisy
- Informacje o oprogramowaniu do edycji

### Czego NIE usuwamy (zeby wideo dzialalo):
- Kodeki audio/video (trak atomy)
- Informacje o rozdzielczosci i frame rate
- Dane samego wideo i audio (mdat atom)

