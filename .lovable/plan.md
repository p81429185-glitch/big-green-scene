## Problem

Edge function `submit-to-mux` wysyła do API Mux pole `mp4_support: "standard"`. Mux uznał tę wartość za **deprecated** dla planu "basic" i zwraca HTTP 400:

> `Deprecated 'standard' mp4_support is not allowed on basic assets`

Stąd toast w UI: *"Edge Function returned a non-2xx status code"*.

## Naprawa

W pliku `supabase/functions/submit-to-mux/index.ts` (linia 35) zamienić:

```ts
mp4_support: "standard",
```

na:

```ts
mp4_support: "capped-1080p",
```

`capped-1080p` to obecnie zalecana przez Mux wartość zapewniająca generowanie statycznego pliku MP4 (potrzebnego do fallbacku w playerze) i jest dozwolona na basic tier. Nie wymaga upgrade'u planu Mux.

## Zakres zmian

| Plik | Zmiana |
|------|--------|
| `supabase/functions/submit-to-mux/index.ts` | 1-linijkowa zmiana wartości `mp4_support` |

Nic innego nie zmieniam — webhook, DB, UI bez zmian. Po wdrożeniu wystarczy ponowić "Wyślij do Mux" dla zalegających filmów.
