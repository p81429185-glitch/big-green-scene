
# Prawdziwy upload plikow i foldery

## Co zrobimy
1. Usuwamy kafelki "Nagraj" i "Kanal" z paska akcji -- zostaja: statystyki, Upload, Folder
2. Upload bedzie dzialal naprawde -- pliki zapisywane w localStorage (jako metadata, bez duzych plikow na razie) i wyswietlane w tabeli
3. Foldery -- mozliwosc tworzenia folderow i przechodzenia do nich
4. Tabela filmow bedzie pokazywac prawdziwe uploadowane pliki zamiast mock data
5. Usuwamy "Kanaly" z sidebara

## Zmiany

### 1. Nowy stan aplikacji -- `src/hooks/useVideoStore.ts`
- Custom hook z localStorage do przechowywania listy plikow i folderow
- Struktura: `{ videos: [{id, title, fileName, size, createdAt, folderId, plays}], folders: [{id, name, createdAt}] }`
- Funkcje: `addVideo()`, `deleteVideo()`, `createFolder()`, `deleteFolder()`

### 2. `src/components/dashboard/ActionCards.tsx`
- Usuwamy "Nagraj" i "Kanal"
- Zostaja: statystyki odtworzen, Upload (highlight), Folder
- Dodajemy callback `onFolderClick`
- Grid zmienia sie na 3 kolumny

### 3. `src/components/dashboard/UploadDialog.tsx` -- prawdziwy upload
- Drag & drop + klikniecie do wyboru pliku
- Akceptacja plikow wideo (MP4, MOV, AVI, MKV, WEBM)
- Po wybraniu pliku: odczytanie nazwy, rozmiaru, zapisanie metadata do localStorage
- Progress bar (symulowany, bo nie ma backendu)
- Po ukonczeniu: zamkniecie dialogu, odswiezenie listy

### 4. `src/components/dashboard/CreateFolderDialog.tsx` -- nowy plik
- Prosty dialog z polem na nazwe folderu
- Walidacja (nie pusty, unikalna nazwa)
- Zapisanie do localStorage

### 5. `src/components/dashboard/TopPlayedTable.tsx`
- Wyswietla prawdziwe pliki z localStorage zamiast mock data
- Dodajemy przycisk usuwania przy kazdym filmie
- Pokazuje rozmiar pliku, date dodania
- Gdy brak filmow: placeholder "Brak filmow -- dodaj pierwszy!"

### 6. `src/components/dashboard/DashboardSidebar.tsx`
- Usuwamy "Kanaly" z nawigacji
- Dodajemy sekcje "Foldery" ponizej nawigacji z lista folderow

### 7. `src/pages/Dashboard.tsx`
- Usuwamy mock data
- Integracja z `useVideoStore`
- Dodajemy stan `createFolderOpen` i `currentFolder`
- Przekazujemy prawdziwe dane do komponentow

## Uwagi techniczne
- Pliki wideo nie beda faktycznie przechowywane (za duze na localStorage) -- zapisujemy tylko metadata (nazwa, rozmiar, typ, data)
- Do prawdziwego przechowywania plikow potrzebny bedzie Supabase Storage -- to nastepny krok
- Foldery dzialaja jako filtr na liscie filmow
