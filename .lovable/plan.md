

## 1. Drag and Drop dla folderow

Foldery w sidebarze beda mogly byc przeciagane i upuszczane na inne foldery (zeby zagniezdic) lub na "Home" (zeby przeniesc na glowny poziom).

### Zmiany:

**`src/hooks/useVideoStore.ts`**
- Nowa funkcja `moveFolder(folderId: string, targetParentId: string | null)` -- aktualizuje `parent_id` w bazie i stanie lokalnym
- Walidacja: folder nie moze byc przeniesiony do samego siebie ani do swojego potomka (zapobieganie petli)

**`src/components/dashboard/DashboardSidebar.tsx`**
- Kazdy `FolderTreeItem` dostaje atrybuty `draggable`, `onDragStart` (ustawia `application/folder-id` w dataTransfer)
- Handlery `onDrop` rozrozniaja czy upuszczono film (`text/plain`) czy folder (`application/folder-id`)
- Podswietlenie celu upuszczania dziala tak samo jak dla filmow
- "Home" rowniez obsluguje upuszczanie folderow (przenosi na `parent_id = null`)

**`src/pages/Dashboard.tsx`**
- Nowy props `onDropFolder` przekazywany do sidebara, wywolujacy `moveFolder`

---

## 2. Redesign wizualny -- nowoczesny, ciemny motyw

Calkowita zmiana kolorystyki i stylu na nowoczesny, ciemny design inspirowany aplikacjami jak Linear, Vercel, czy Raycast. Ciemne tla, subtelne gradienty, lepsze odstepy i typografia.

### Zmiany w `src/index.css`:

**Nowa paleta kolorow (dark-first)**:
- Background: bardzo ciemny granatowo-szary (np. `222 47% 5%`)
- Card: lekko jasniejszy od tla z subtelnymi bordurami
- Primary: jasny niebieski-fiolet (accent kolor, np. `217 91% 60%`) -- wyrazisty i nowoczesny
- Muted: przyciszony szary do tekstu wtornego
- Sidebar: ciemniejszy od tla z subtelnymi obramowaniami
- Usiniecie trybu jasnego (lub zachowanie jako fallback) -- domyslnie ciemny

### Zmiany w komponentach:

**`src/pages/Index.tsx` (landing page)**:
- Gradient tlo w sekcji hero (od ciemnego do lekko jasniejszego)
- Animowany badge "Platforma hostingu filmow" z subtelnymi gradientami
- Karty feature z efektem glassmorphism (bg-opacity + backdrop-blur)
- Wieksze odstepy i lepsza hierarchia typograficzna

**`src/pages/Auth.tsx`**:
- Ciemne tlo z subtylnym wzorem lub gradientem
- Karta logowania z efektem glow/shadow

**`src/pages/Dashboard.tsx`**:
- Czystszy layout z lepszymi odstepami

**`src/components/dashboard/ActionCards.tsx`**:
- Karty z subtelnymi gradientami zamiast plaskich kolorow
- Karta "Upload" z wyrazistym accent kolorem i hover glow effect
- Ikony w kolorowych kolkach

**`src/components/dashboard/RecentBanner.tsx`**:
- Gradient tlo (z lewej do prawej, primary -> accent)
- Wiekszy thumbnail z zaokraglonymi rogami

**`src/components/dashboard/TopPlayedTable.tsx`**:
- Subtelne hover efekty na wierszach
- Badge z liczba odtworzen zamiast zwyklego tekstu
- Lepsze rozmiary thumbnailów

**`src/components/dashboard/AnalyticsView.tsx`**:
- Karty statystyk z gradientowymi ikonami
- Wykres z gradientowymi slupkami i lepszymi tooltipami
- Lepsze kolory osi wykresu dla ciemnego tla

**`src/components/dashboard/DashboardSidebar.tsx`**:
- Subtelny gradient w tle sidebara
- Lepsza wizualna separacja aktywnego elementu (jasna linia po lewej stronie)
- Awatar uzytkownika z gradientowym tlem

**`src/components/dashboard/UploadDialog.tsx`**:
- Strefa drop z animowanym obramowaniem (animated border)
- Wiekszy i ladniejszy obszar przeciagania

**`src/components/dashboard/RecentlyShared.tsx`**:
- Lepsze karty z hover efektami

### Szczegoly techniczne

Zmiana kolorystyki odbywa sie glownie w `src/index.css` przez modyfikacje zmiennych CSS. Komponenty otrzymuja dodatkowe klasy Tailwind dla gradientow, cieni i efektow hover. Nie wymaga zadnych nowych bibliotek -- wszystko osiagalne z Tailwind CSS i CSS custom properties.

Tryb ciemny bedzie domyslny -- klasa `dark` dodana do `index.html` lub ustawiona programowo. Paleta jasna zostanie zachowana jako fallback ale ciemna bedzie priorytetem.

