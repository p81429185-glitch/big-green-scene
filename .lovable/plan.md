

# Naprawa: upload pokazuje 100% ale wideo nie pojawia sie

## Diagnoza problemu

Problem jest w XHR uploadzie. Przegladarka wysyla bajty szybko (progress dochodzi do 90%), ale serwer jeszcze przetwarza plik -- `xhr.onload` nie odpalil sie. Pasek progressu wyglada na pelny (90% wizualnie wyglada jak 100%), ale upload jeszcze trwa na serwerze. Dlatego:
- Pasek wyglada pelny
- Status to nadal "uploading" (spinner sie kreci)
- Wideo nie pojawia sie w tabeli

Dodatkowo: XHR uzywa **anon key** jako token autoryzacji zamiast tokenu zalogowanego uzytkownika. To moze powodowac problemy z uploadem do storage.

## Zmiany

### 1. `src/hooks/useVideoStore.ts` -- uzycie tokena uzytkownika + lepszy progress

- **Pobranie tokena sesji** uzytkownika zamiast anon key dla Authorization header:
  ```
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token || anonKey;
  ```
- **Zmiana progress na 0-95%** w XHR zamiast 0-90%, zeby pasek nie wygladal na pelny za wczesnie
- **Dodanie statusu "Przetwarzanie..."** -- gdy progress osiagnie 95% (bajty wyslane), ale serwer jeszcze nie odpowiedzial

### 2. `src/hooks/useUploadQueue.ts` -- nowy status "processing"

- Dodanie statusu `"processing"` do QueueItem -- gdy bajty sa wyslane ale serwer przetwarza
- Aktualizacja statusu w odpowiednim momencie

### 3. `src/components/dashboard/UploadQueue.tsx` -- UI dla stanu przetwarzania

- Nowa ikona/tekst dla statusu "processing": "Przetwarzanie na serwerze..."
- Animowany spinner dla tego stanu zeby uzytkownik widzial ze cos sie dzieje
- Pasek progressu z animacja pulsowania gdy serwer przetwarza

### Podsumowanie zmian w plikach:
- `src/hooks/useVideoStore.ts` -- token uzytkownika, lepszy progress mapping
- `src/hooks/useUploadQueue.ts` -- status "processing"
- `src/components/dashboard/UploadQueue.tsx` -- UI dla przetwarzania

