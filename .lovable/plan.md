

## Aktywne zakladki "Dostosuj" i "Analityka" na stronie odtwarzacza

### Obecny stan
Zakladki "Dostosuj" i "Analityka" na stronie VideoPlayer sa nieaktywne -- klikniecie pokazuje tylko toast "Wkrotce dostepne". Trzeba je uczynic funkcjonalnymi.

### Zmiany

#### 1. Stan aktywnej zakladki
Dodac stan `activeActionTab` w `VideoPlayer.tsx` zamiast obecnego `toast.info()`. Domyslnie zadna zakladka nie jest aktywna (lub "edytuj"). Klikniecie zakladki przelacza widok ponizej odtwarzacza.

#### 2. Zakladka "Dostosuj" -- panel brandingu
Wyswietlic uproszczony panel brandingu pod odtwarzaczem (ponizej action tabs), analogiczny do istniejacego `BrandKitView`:
- Zmiana kolorow playera (player_color, icon_color, progress_color, play_bg_color)
- Zmiana czcionki
- Upload/zmiana logo
- Podglad na zywo -- sam odtwarzacz powyzej reaguje na zmiany

Wykorzystac istniejacy hook `useBrandSettings` -- ten sam co w dashboardowym Brand Kit.

Nowy komponent: `src/components/video/VideoCustomizeTab.tsx`
- Kompaktowa wersja BrandKitView (bez sekcji "Podglad playera" bo odtwarzacz jest tuz obok)
- Sekcje: Logo, Kolory (4 color pickery), Czcionka (select)

#### 3. Zakladka "Analityka" -- statystyki video
Wyswietlic panel analityki pod odtwarzaczem z danymi dla tego konkretnego wideo.

Nowy komponent: `src/components/video/VideoAnalyticsTab.tsx`

Dane dostepne z istniejacych tabel (bez nowej migracji):
- Liczba odtworzen (`video.plays`)
- Data dodania
- Rozmiar pliku

Dane wymagajace nowej tabeli `video_views`:
- Unikalni widzowie (po session/IP)
- Engagement (sredni czas ogladania vs dlugosc filmu)
- Wykres odtworzen w czasie

**Nowa migracja** -- tabela `video_views`:
```
video_views:
  id: uuid PK
  video_id: uuid FK -> videos.id
  viewer_session: text (losowy identyfikator sesji z localStorage)
  watch_duration_seconds: integer (ile sekund obejrzano)
  video_duration_seconds: integer (calkowita dlugosc)
  created_at: timestamptz
```

RLS: SELECT dla authenticated users, INSERT dla anon i authenticated (zeby embed tez mogl zapisywac).

#### 4. Zbieranie danych analitycznych
W `BrandedVideoPlayer.tsx` dodac raportowanie ogladania:
- Przy zaladowaniu wideo wygenerowac `viewer_session` (z `localStorage` lub losowy)
- Co 30 sekund (lub przy pauzie/zakonczeniu) zapisywac `watch_duration_seconds` do `video_views`
- Uzyc `onTimeUpdate` do sledzenia czasu

#### 5. Modyfikacje w VideoPlayer.tsx
- Zamiast tablicy `actionTabs` z `toast.info`, uzyc `activeActionTab` state
- Pod action tabs wyswietlic odpowiedni komponent:
  - "Dostosuj" -> `<VideoCustomizeTab />`
  - "Analityka" -> `<VideoAnalyticsTab videoId={id} video={video} />`
  - "Edytuj" / "Klipy" -> nadal toast "Wkrotce"
- Aktywna zakladka ma podkreslenie (border-bottom primary)

### Podsumowanie plikow

| Plik | Akcja |
|------|-------|
| `src/components/video/VideoCustomizeTab.tsx` | Nowy -- panel brandingu kompaktowy |
| `src/components/video/VideoAnalyticsTab.tsx` | Nowy -- statystyki wideo |
| `src/pages/VideoPlayer.tsx` | Edycja -- obsluga aktywnych zakladek |
| `src/components/video/BrandedVideoPlayer.tsx` | Edycja -- raportowanie watch time |
| Migracja SQL | Nowa tabela `video_views` z RLS |

### Szczegoly techniczne

**VideoCustomizeTab** -- reuse `useBrandSettings()`:
- 3 sekcje w kompaktowym ukladzie: Logo (upload/usun), Kolory (4x color input inline), Czcionka (select)
- Zmiany sa natychmiastowe (ten sam hook co dashboard Brand Kit)

**VideoAnalyticsTab** -- dane z bazy:
- Karty: Odtworzenia, Unikalni widzowie, Sredni engagement %
- Tabela ostatnich sesji ogladania
- Query: `SELECT count(*), count(distinct viewer_session), avg(watch_duration_seconds) FROM video_views WHERE video_id = ?`

**Raportowanie w BrandedVideoPlayer**:
- Props: `videoId?: string` (opcjonalny, zeby embed tez mogl raportowac)
- Effect z interwałem 30s zapisujacy progress do `video_views`
- Upsert na `viewer_session + video_id` zeby aktualizowac czas a nie tworzyc nowe rekordy
