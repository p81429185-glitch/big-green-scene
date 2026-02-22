

## Ulubione i Biblioteka w Dashboard

### 1. Zmiana w bazie danych
Dodanie kolumny `is_favorite` (boolean, domyslnie `false`) do tabeli `videos`.

### 2. Widok aktywny w sidebarze
Obecnie sidebar ma przyciski "Home", "Ulubione", "Biblioteka", "Analityka", ale tylko "Home" dziala. Dodany zostanie stan `activeView` w `Dashboard.tsx` przekazywany do sidebara, ktory okresli co wyswietlamy:
- **Home** -- wszystkie filmy (lub filtrowane po folderze)
- **Ulubione** -- tylko filmy z `is_favorite = true`
- **Biblioteka** -- wszystkie filmy bez filtrowania po folderze (pelna lista)

### 3. Przycisk ulubione w tabeli filmow
W `TopPlayedTable.tsx` dodana zostanie ikona serduszka (Heart) przy kazdym filmie. Klikniecie toggleuje `is_favorite` w bazie i lokalnym stanie.

### Szczegoly techniczne

**Migracja SQL:**
```sql
ALTER TABLE videos ADD COLUMN is_favorite boolean NOT NULL DEFAULT false;
```

**Plik: `src/hooks/useVideoStore.ts`**
- Dodanie `is_favorite: boolean` do interfejsu `VideoItem`
- Nowa funkcja `toggleFavorite(id: string)` -- aktualizuje kolumne `is_favorite` w bazie i stanie lokalnym

**Plik: `src/pages/Dashboard.tsx`**
- Nowy stan `activeView: "home" | "favorites" | "library"` (domyslnie `"home"`)
- Filtrowanie filmow:
  - `home`: filtrowanie po `currentFolderId` (jak dotychczas)
  - `favorites`: `videos.filter(v => v.is_favorite)`
  - `library`: wszystkie filmy bez filtra
- Przekazanie `activeView` i `onViewChange` do `DashboardSidebar`

**Plik: `src/components/dashboard/DashboardSidebar.tsx`**
- Nowe propsy: `activeView` i `onViewChange`
- Klikniecie "Home" ustawia widok na `home`
- Klikniecie "Ulubione" ustawia widok na `favorites`
- Klikniecie "Biblioteka" ustawia widok na `library`
- Podswietlanie aktywnego elementu na podstawie `activeView`

**Plik: `src/components/dashboard/TopPlayedTable.tsx`**
- Nowy props: `onToggleFavorite(id: string)`
- Kolumna z ikona Heart (wypelniona dla ulubionych, pusta dla reszty)
- Klikniecie serduszka wywoluje `onToggleFavorite`
