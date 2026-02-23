

## Naprawa uploadu duzych plikow (>1GB)

### Problem
Funkcja `stripVideoMetadata()` laduje caly plik do pamieci RAM przegladarki (`file.arrayBuffer()`). Przy pliku 1.89 GB przeglazarka zamraza sie lub crashuje -- upload nigdy sie nie rozpoczyna.

### Rozwiazanie
Pominac strip metadata dla plikow wiekszych niz 500 MB. Dla tak duzych plikow ryzyko wycieku metadanych (GPS, info o urzadzeniu) jest minimalne w porownaniu z brakiem mozliwosci uploadu.

### Zmiany

**Plik: `src/lib/stripVideoMetadata.ts`**
- Na poczatku funkcji `stripVideoMetadata()` dodac warunek:
  ```
  if (file.size > 500 * 1024 * 1024) return file; // >500MB - skip to avoid OOM
  ```
- Jesli plik jest mniejszy niz 500 MB, dzialanie pozostaje bez zmian

### Wplysk
- Pliki do 500 MB -- metadata jest usuwana jak dotychczas
- Pliki powyzej 500 MB -- uploadowane bez strippingu, co pozwala na poprawny upload duzych plikow przez TUS protocol
- Zadnych zmian w UI ani w pozostalych plikach

