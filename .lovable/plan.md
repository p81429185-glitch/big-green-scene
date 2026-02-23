

## Naprawa synchronizacji ustawien brandingu + kolor przyciskow 15s

### Problem 1: "Nic sie nie zmienia"
Hook `useBrandSettings` jest uzywany osobno w `VideoCustomizeTab` i `BrandedVideoPlayer`. Kazdy komponent ma wlasna kopie stanu -- zmiana w jednym nie aktualizuje drugiego. Trzeba uzyc wspoldzielonego stanu (React Context).

### Problem 2: Brak opcji koloru przyciskow skip 15s
Przyciski skip maja na sztywno `rgba(0,0,0,0.45)`. Trzeba dodac nowe pole `skip_bg_color` do ustawien brandingu i kolumne w bazie.

### Zmiany

#### 1. Nowa migracja SQL
Dodac kolumne `skip_bg_color` do tabeli `brand_settings`:
```sql
ALTER TABLE brand_settings ADD COLUMN skip_bg_color text NOT NULL DEFAULT 'rgba(0,0,0,0.45)';
```

#### 2. Konwersja `useBrandSettings` na Context
Utworzyc `src/contexts/BrandSettingsContext.tsx`:
- Przenosimy cala logike z hooka do providera
- Provider opakowuje aplikacje w `App.tsx`
- Hook `useBrandSettings` staje sie wrapperem na `useContext`
- Dzieki temu zmiana koloru w Customize tab natychmiast odswierza player

Plik `src/hooks/useBrandSettings.ts` -- zamieniony na prosty re-export z kontekstu.

#### 3. Aktualizacja `BrandSettings` interface
Dodac pole `skip_bg_color: string` z domyslna wartoscia `rgba(0,0,0,0.45)`.

#### 4. Aktualizacja `VideoCustomizeTab`
Dodac nowy color picker "Tlo skip 15s" do listy COLOR_FIELDS:
```
{ key: "skip_bg_color", label: "Tlo skip 15s" }
```
Obsluga `handleColorChange` dla `skip_bg_color` -- analogicznie do `play_bg_color` (rgba z alpha 0.45).

#### 5. Aktualizacja `BrandedVideoPlayer`
Zmienic hardcoded `rgba(0,0,0,0.45)` na `settings.skip_bg_color` w obu przyciskach skip.

#### 6. Aktualizacja `persistToDb` i `loadFromDb`
Uwzglednic nowe pole `skip_bg_color` przy zapisie i odczycie z bazy.

### Podsumowanie plikow

| Plik | Akcja |
|------|-------|
| Migracja SQL | Nowa kolumna `skip_bg_color` |
| `src/contexts/BrandSettingsContext.tsx` | Nowy -- context provider |
| `src/hooks/useBrandSettings.ts` | Edycja -- re-export z kontekstu |
| `src/App.tsx` | Edycja -- opakowac w `BrandSettingsProvider` |
| `src/components/video/VideoCustomizeTab.tsx` | Edycja -- dodac color picker skip |
| `src/components/video/BrandedVideoPlayer.tsx` | Edycja -- uzyc `settings.skip_bg_color` |

### Techniczne

Context provider dziala tak:
- Stan `settings` jest w jednym miejscu (provider)
- Wszystkie komponenty uzywajace `useBrandSettings()` dostaja ten sam obiekt
- Zmiana w VideoCustomizeTab natychmiast odswierza BrandedVideoPlayer
- localStorage i DB sync pozostaja bez zmian

