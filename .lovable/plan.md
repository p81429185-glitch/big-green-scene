## Co naprawdę się dzieje

Sprawdziłem DB — **wszystkie 5 ostatnich filmów** ma `mux_asset_id` i `mux_status: processing`, niektóre od 2 dni. To znaczy:

- Plik wgrał się do storage poprawnie ✅
- `submit-to-mux` zadziałało, Mux dostał plik i zaczął transkodować ✅
- **Webhook `video.asset.ready` z Mux nigdy nie dociera do nas** ❌ → DB nie dostaje finalnego statusu, player widzi `processing` i pokazuje „Błąd odtwarzania"

Mux raczej już dawno skończył transkodować (są nawet pliki <100 MB sprzed 2 dni z tym samym problemem). Problem to webhook (zły URL w Mux dashboard, zła wartość `MUX_WEBHOOK_SECRET`, albo nigdy nie został podpięty po fixach).

## Plan naprawy

### 1. Nowa edge function `sync-mux-status`
Odpytuje Mux API `GET /video/v1/assets/:id` dla każdego filmu z `mux_status in (processing, pending)` i aktualizuje DB:
- `ready` → `mux_status=ready`, `mux_playback_id`, `is_processed=true`, `processing_status=ready`
- `errored` → `mux_status=error`, `processing_status=failed`
- inne → bez zmian

Może też przyjąć `{ video_id }` dla pojedynczego filmu.

### 2. Auto-sync w playerze
W `BrandedVideoPlayer` / `VideoPlayer` jeśli wideo jest w stanie `processing` przez >10s — wywołaj `sync-mux-status` z `video_id`. Jak Mux skończył, status się odświeży realtime (subscription już istnieje) i player zacznie grać.

### 3. Przycisk „Synchronizuj z Mux" w Admin → Mux Settings
Dla manualnego odpalenia sync-all, gdyby coś znowu utknęło.

### 4. Diagnostyka webhooka
Dodać w `MuxSettingsView` info o URL webhooka, który trzeba ustawić w Mux dashboard:
`https://bdwhqsjbfnbxthfjdbfw.supabase.co/functions/v1/mux-webhook`
oraz przypomnienie o `MUX_WEBHOOK_SECRET`. To jednorazowa konfiguracja po stronie Mux — nie da się zrobić tego z kodu.

### 5. Natychmiastowy fix dla obecnych 5 filmów
Po wdrożeniu funkcji wywołać `sync-mux-status` bez `video_id` — przejdzie po wszystkich, zaktualizuje statusy. Filmik z screenshota powinien wtedy zagrać.

## Pliki do zmiany

| Plik | Akcja |
|---|---|
| `supabase/functions/sync-mux-status/index.ts` | **Nowy** — pull-based sync z Mux API |
| `src/components/video/BrandedVideoPlayer.tsx` | Dodać auto-trigger `sync-mux-status` przy `processing` |
| `src/components/dashboard/MuxSettingsView.tsx` | Przycisk „Synchronizuj statusy" + info o webhook URL |

## Czego NIE ruszamy
- TUS, faststart, storage, RLS — działają.
- `submit-to-mux` — działa (filmy mają `mux_asset_id`).
- `mux-webhook` — kod jest OK, problem jest w konfiguracji po stronie Mux dashboard.
