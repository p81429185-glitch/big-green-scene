

## 1. Analityka -- widok statystyk

Przycisk "Analityka" w sidebarze bedzie przelaczal na widok z podsumowaniem statystyk filmow.

### Co bedzie widoczne w widoku Analityka:
- Laczna liczba filmow
- Laczna liczba odtworzen
- Laczny rozmiar plikow
- Liczba ulubionych
- Wykres slupkowy top 5 najczesciej odtwarzanych filmow (z uzyciem recharts, juz zainstalowany)
- Tabela ze statystykami per folder (ile filmow, ile odtworzen)

### Zmiany:
- Nowy komponent `src/components/dashboard/AnalyticsView.tsx` -- renderuje karty ze statystykami i wykres
- `src/pages/Dashboard.tsx` -- rozszerzenie `activeView` o wartosc `"analytics"`, warunkowe renderowanie `AnalyticsView` zamiast tabeli filmow
- `src/components/dashboard/DashboardSidebar.tsx` -- klikniecie "Analityka" ustawia widok na `"analytics"`

---

## 2. Foldery zagniezdzone (folder w folderze)

Obecnie foldery sa plaskie (bez hierarchii). Dodanie kolumny `parent_id` do tabeli `folders` umozliwi tworzenie podfolderow.

### Zmiana w bazie danych:
```sql
ALTER TABLE folders ADD COLUMN parent_id uuid REFERENCES folders(id) ON DELETE CASCADE DEFAULT NULL;
```

### Zmiany w kodzie:

**`src/hooks/useVideoStore.ts`**
- Dodanie `parent_id: string | null` do interfejsu `FolderItem`
- Zmiana `createFolder(name, parentId?)` -- przekazywanie `parent_id` przy insercie

**`src/components/dashboard/DashboardSidebar.tsx`**
- Renderowanie folderow jako drzewa (foldery z `parent_id = null` na gorze, ich dzieci zagniezdzone pod nimi)
- Ikona strzalki do rozwijania/zwijania podfolderow (Collapsible)
- Klikniecie w folder ustawia `currentFolderId` i pokazuje filmy z tego folderu

**`src/components/dashboard/CreateFolderDialog.tsx`**
- Nowy opcjonalny props `parentFolderId` -- tworzenie podfolderu
- Wyswietlanie informacji "Tworzysz podfolder w: [nazwa]"

**`src/pages/Dashboard.tsx`**
- Przycisk "Nowy podfolder" dostepny gdy jestesmy wewnatrz folderu (currentFolderId nie jest null)
- Breadcrumb nawigacja pokazujaca sciezke folderow (np. "Home > Tutoriale > React")

**`src/components/dashboard/ActionCards.tsx`**
- Gdy uzytkownik jest w folderze, przycisk "Folder" tworzy podfolder w aktualnym folderze

### Szczegoly techniczne

**Drzewo folderow w sidebarze** -- foldery beda grupowane rekurencyjnie. Kazdy folder z dzieci bedzie mial przycisk rozwijania (ChevronRight/ChevronDown). Uzyty zostanie komponent Collapsible z Radix UI (juz zainstalowany).

**Breadcrumb** -- nad tabela filmow pojawi sie sciezka nawigacji z klikalnych elementow, np. "Wszystkie > Marketing > Kampania Q1". Klikniecie w element przenosi do tego folderu.

**Filtrowanie filmow** -- widok "home" z wybranym folderem pokaze tylko filmy przypisane bezposrednio do tego folderu (nie rekurencyjnie z podfolderow).

