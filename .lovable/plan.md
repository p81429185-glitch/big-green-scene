

# Kolejka uploadow z minimalizacja

## Opis
Zamiana obecnego dialogu uploadu na system kolejki w prawym dolnym rogu ekranu. Uzytkownik wybiera pliki (do 20 na raz), dialog sie zamyka, a w rogu pojawia sie miniaturowy panel z kolejka -- mozna go zminimalizowac/rozwinac. Pliki uploaduja sie po kolei, kazdy z wlasnym progress barem.

## Architektura

### 1. Nowy komponent `UploadQueue.tsx`
Staly komponent w prawym dolnym rogu (fixed, z-50), widoczny tylko gdy sa pliki w kolejce. Dwa stany:
- **Rozwiniety**: lista plikow z progress barami, nazwy, rozmiary, statusy (czeka/uploading/done/error)
- **Zminimalizowany**: maly pasek z ikona, liczba plikow i ogolny progress

Funkcje:
- Przycisk minimalizuj/rozwin (ChevronDown/ChevronUp)
- Przycisk X do zamkniecia po zakonczeniu wszystkich
- Automatyczne przewijanie listy (ScrollArea)
- Kazdy plik: nazwa (truncated), rozmiar, progress bar, status ikona

### 2. Zmiana `UploadDialog.tsx`
Dialog sluzy teraz TYLKO do wyboru plikow:
- Input z `multiple` -- mozna wybrac wiele plikow
- Drag & drop wielu plikow
- Limit 20 plikow (walidacja)
- Po wybraniu plikow: dialog sie zamyka, pliki trafiaja do kolejki

### 3. Logika kolejki w `useUploadQueue.ts` (nowy hook)
- State: tablica `QueueItem[]` z `{id, file, folderId, progress, status, error}`
- Pliki uploaduja sie **sekwencyjnie** (jeden po drugim) zeby nie przeciazac sieci
- Kazdy plik uzywa `uploadVideo` z `useVideoStore`
- Po ukonczeniu wszystkich -- kolejka zostaje widoczna az uzytkownik ja zamknie
- Funkcje: `addFiles(files, folderId)`, `clearCompleted()`, `isActive`

### 4. Zmiany w `Dashboard.tsx`
- Usunac state `uploadOpen` na rzecz nowego podejscia
- Dodac `UploadQueue` jako staly komponent
- Dialog dalej otwierany przyciskiem, ale zamyka sie po wybraniu plikow

## Zmiany techniczne

### Nowe pliki:
- `src/hooks/useUploadQueue.ts` -- hook z logika kolejki
- `src/components/dashboard/UploadQueue.tsx` -- UI kolejki w rogu

### Modyfikowane pliki:
- `src/components/dashboard/UploadDialog.tsx` -- uproszczenie do wyboru plikow, `multiple`, limit 20, callback `onFilesSelected(files: File[])`
- `src/pages/Dashboard.tsx` -- integracja kolejki, przekazanie `uploadVideo` do hooka

### Struktura QueueItem:
```text
QueueItem {
  id: string
  file: File
  fileName: string
  fileSize: number
  folderId: string | null
  progress: number        // 0-100
  status: 'waiting' | 'uploading' | 'done' | 'error'
  error?: string
}
```

### UI kolejki (rozwiniety):
```text
+----------------------------------+
| Przesylanie (3/7)    [_] [X]    |
+----------------------------------+
| [v] video1.mp4    120MB   Done  |
| [v] video2.mp4     45MB   Done  |
| [>] video3.mp4    890MB   67%   |
|     ====-------         progress |
| [ ] video4.mp4    234MB  Czeka  |
| [ ] video5.mp4    567MB  Czeka  |
+----------------------------------+
```

### UI kolejki (zminimalizowany):
```text
+----------------------------------+
| Przesylanie 3/7  67%   [^] [X]  |
| ==========---------              |
+----------------------------------+
```
