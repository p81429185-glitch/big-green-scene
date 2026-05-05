Zrobiłem analizę „z trzeciej perspektywy” po kodzie, bazie i logach. To nie jest już tylko problem webhooka.

Co widzę teraz:
- Najnowszy film „wszystko o bonusach...” ma dwa wpisy:
  - jeden wpis ma `mux_asset_id = null`, ale obiektu w storage w ogóle nie ma. `submit-to-mux` loguje: `Signed URL error ... Object not found`.
  - drugi wpis ma obiekt w storage i `mux_asset_id`, ale po ręcznym sync Mux zwrócił status `errored`, więc Mux nie był w stanie przetworzyć tego pliku.
- Dla błędnych dużych plików obiekt w storage jest dokładnie o 58 bajtów mniejszy niż oryginalny plik. To mocno wskazuje, że nasz client-side metadata stripping wycina atom MP4 z początku pliku i psuje offsety wideo.
- Kod uploadu ma też drugi błąd: TUS resume używa domyślnego fingerprintu zależnego od nazwy/rozmiaru/pliku, ale nie od `storagePath`. Przy ponownym wrzuceniu tego samego pliku może wznowić stary upload do starej ścieżki, a potem baza tworzy nowy wpis z nową ścieżką, gdzie obiektu nie ma. Stąd wpisy `pending`, których nie da się wysłać do Mux, bo plik fizycznie nie istnieje.

Plan naprawy:

1. Wyłączyć ryzykowne modyfikowanie dużych MP4 przed uploadem
- W `src/hooks/useVideoStore.ts` dla plików powyżej bezpiecznego progu nie będziemy uruchamiać `stripVideoMetadata` ani FastStart.
- Duże pliki pójdą do storage bajt-w-bajt takie, jakie wybrał użytkownik.
- Mux dostanie oryginalny plik i sam zrobi HLS/transkodowanie.

2. Naprawić `stripVideoMetadata`, żeby nie korumpował MP4
- W `src/lib/stripVideoMetadata.ts` zmienię logikę tak, aby nie usuwała atomów `meta/udta` z `moov`, jeśli `moov` jest przed `mdat`.
- To jest dokładnie przypadek, w którym usunięcie nawet 58 bajtów przesuwa dane medialne, a offsety w `stco/co64` zostają stare, przez co Mux widzi uszkodzone media.
- Dla małych plików też dodam tę ochronę, żeby problem nie wrócił w innym rozmiarze.

3. Naprawić TUS resume, żeby nie tworzył pustych/nieistniejących wpisów
- W `uploadFileTus` dodam własny `fingerprint`, który zawiera `bucket` i `storagePath`.
- Dzięki temu upload może się wznawiać tylko dla tego samego docelowego obiektu, a nie dla „tego samego pliku” wrzucanego drugi raz do innej ścieżki.
- To zatrzyma przypadek: upload wznowiony do starego obiektu, ale nowy wpis w bazie wskazuje na nieistniejącą ścieżkę.

4. Zmienić moment dodawania wpisu do bazy, żeby uniknąć martwych rekordów
- Po TUS uploadzie dodam weryfikację, że obiekt faktycznie istnieje w bucketcie `videos`, zanim utworzymy rekord `videos` i wyślemy go do Mux.
- Jeśli obiekt nie istnieje, upload zakończy się czytelnym błędem zamiast tworzyć film, który później pokazuje „Błąd odtwarzania”.

5. Poprawić sync i komunikat błędu Mux
- `sync-mux-status` zostawi status `error` dla assetów, które Mux faktycznie oznaczył jako `errored`, zamiast pozwalać playerowi kręcić się w nieskończoność.
- W playerze dodam osobny stan dla `mux_status = error`: informacja, że plik został odrzucony przez przetwarzanie, a nie zwykły „sprawdź połączenie”.
- Dla `pending` bez obiektu pokażemy informację o niepełnym uploadzie, zamiast próbować odtwarzać pustą ścieżkę.

6. Posprzątać aktualne uszkodzone wpisy
- Po zmianach uruchomię sync/diagnostykę dla ostatnich filmów.
- Wpis bez obiektu (`Object not found`) oznaczę jako failed albo usunę z widoku, żeby nie pojawiał się jako działający film.
- Wpisy już odrzucone przez Mux są najprawdopodobniej nie do odzyskania bez oryginalnego pliku, bo storage zawiera już zmodyfikowany/uszkodzony MP4. Po naprawie trzeba wrzucić oryginalny plik jeszcze raz — tym razem bez modyfikacji bajtów po stronie przeglądarki.

Pliki do zmiany:
- `src/hooks/useVideoStore.ts` — bezpieczny upload dużych plików, TUS fingerprint z `storagePath`, weryfikacja obiektu po uploadzie.
- `src/lib/stripVideoMetadata.ts` — zabezpieczenie przed psuciem MP4, gdy `moov` jest przed `mdat`.
- `src/pages/VideoPlayer.tsx` — czytelny stan dla `mux_status=error` i `pending` bez realnego pliku.
- `supabase/functions/sync-mux-status/index.ts` — dopisanie lepszej informacji diagnostycznej z Mux, jeśli asset jest `errored`.

Efekt po wdrożeniu:
- Nowe uploady >200 MB nie będą już korumpowane przez usuwanie metadanych.
- Ponowne wrzucenie tego samego pliku nie będzie tworzyć martwych rekordów ze ścieżką, której nie ma w storage.
- Player nie będzie pokazywał mylącego „Błąd odtwarzania” dla assetów odrzuconych przez Mux.
- Aktualny zepsuty upload zostanie jasno oznaczony; działająca wersja będzie wymagała ponownego uploadu oryginału po poprawce, bo Mux już dostał uszkodzone bajty.