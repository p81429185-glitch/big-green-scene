

## Drag and Drop -- przenoszenie filmow miedzy folderami

### Jak to bedzie dzialac
- Kazdy wiersz w tabeli filmow bedzie mozna "chwycic" i przeciagnac (HTML5 Drag & Drop API, bez dodatkowej biblioteki)
- Foldery w sidebarze beda celami upuszczania (drop targets) -- podswietla sie folder gdy przeciagamy nad nim film
- Upuszczenie filmu na folder przeniesie go do tego folderu w bazie danych
- Upuszczenie na "Home" (lub specjalny obszar "Wszystkie") przeniesie film do glownego poziomu (folder_id = null)

### Zmiany w plikach

**`src/hooks/useVideoStore.ts`**
- Nowa funkcja `moveVideo(videoId: string, targetFolderId: string | null)` -- aktualizuje `folder_id` w bazie i stanie lokalnym

**`src/components/dashboard/TopPlayedTable.tsx`**
- Dodanie atrybutow `draggable`, `onDragStart` do kazdego wiersza `TableRow`
- W `onDragStart` ustawiamy `dataTransfer` z `videoId`
- Wizualne oznaczenie przeciaganego elementu (opacity)

**`src/components/dashboard/DashboardSidebar.tsx`**
- Dodanie nowego propsa `onDropVideo: (videoId: string, folderId: string | null) => void`
- Kazdy element folderu (`FolderTreeItem`) oraz przycisk "Home" otrzymuja handlery `onDragOver` i `onDrop`
- Podswietlenie folderu podczas przeciagania nad nim (zmiana tla)
- Obsluga upuszczenia -- wywolanie `onDropVideo(videoId, folderId)`

**`src/pages/Dashboard.tsx`**
- Nowa funkcja `handleMoveVideo` wywolujaca `moveVideo` z `useVideoStore`
- Przekazanie `onDropVideo` do `DashboardSidebar`

### Szczegoly techniczne

Uzycie natywnego HTML5 Drag & Drop API:
- `onDragStart`: `e.dataTransfer.setData("text/plain", videoId)`
- `onDragOver`: `e.preventDefault()` (zeby umozliwic drop)
- `onDrop`: `e.dataTransfer.getData("text/plain")` -> wywolanie `moveVideo`
- Stan `dragOver` w folderach do podswietlenia celu

Nie wymaga zadnych dodatkowych bibliotek -- natywne API przegladarki wystarczy.

