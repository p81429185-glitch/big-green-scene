

## Brand Kit -- globalna konfiguracja brandingu dla embedow

Zamiast konfigurowania kolorow i logo osobno dla kazdego embeda, powstanie osobna strona "Brand Kit" w dashboardzie, gdzie ustawienia brandingu konfiguruje sie raz. Kazdy nowo generowany embed automatycznie uzywa tych ustawien.

### Nowe elementy:

**1. Tabela w bazie danych: `brand_settings`**
- `id` (uuid, PK)
- `user_id` (uuid, NOT NULL -- referencja do auth.users)
- `logo_url` (text, nullable)
- `player_color` (text, default `#16a34a`)
- `icon_color` (text, default `#ffffff`)
- `progress_color` (text, default `#ffffff`)
- `play_bg_color` (text, default `#16a34a80`)
- `font_family` (text, default `Inter`)
- `created_at` / `updated_at` (timestamptz)
- RLS: uzytkownik widzi/edytuje tylko swoje ustawienia

**2. Nowy widok "Brand Kit" w sidebarze dashboardu**
- Nowa pozycja w `navItems` z ikona `Palette` i labelem "Brand Kit"
- Nowy `activeView` = `"brandkit"`

**3. Nowy komponent `src/components/dashboard/BrandKitView.tsx`**
- Wyglad wzorowany na screenshotach uzytkownika:
  - Sekcja **Logos**: drop zone z przyciskiem "Upload" do przeslania logo (upload do Supabase Storage, bucket `brand-assets`). Podglad aktualnego logo z mozliwoscia edycji/usuniecia.
  - Sekcja **Colors**: karty kolorow (Player Color, Icon Color, Progress Color, Play BG Color). Kazda karta pokazuje podglad koloru z wartoscia hex + przyciski edycji/usuniecia. Przycisk "+ Add new" z color pickerem.
  - Sekcja **Fonts**: karta z aktualna czcionka (domyslnie Inter) + pole "Add a font" z wyborem z predefiniowanej listy (Inter, Roboto, Open Sans, Lato, Montserrat, Poppins).
  - Podglad playera na zywo z aktualnymi ustawieniami brandingu

**4. Hook `src/hooks/useBrandSettings.ts`**
- Pobiera ustawienia brandingu z tabeli `brand_settings` dla zalogowanego uzytkownika
- Funkcje: `loadBrandSettings`, `saveBrandSettings`, `uploadLogo`
- Uzywa `@tanstack/react-query` do cache'owania

**5. Zmiany w `EmbedDialog.tsx`**
- Przy otwieraniu dialogu automatycznie laduje ustawienia z `useBrandSettings`
- Stany `brandColor`, `brandIconColor`, `brandProgressColor`, `brandLogoUrl`, `brandPlayBgColor` inicjalizowane z zapisanych ustawien
- Sekcja Branding w dialogu nadal istnieje, ale domyslnie wypelniona globalnymi wartosciami (mozna nadpisac per-embed)

**6. Zmiany w `Dashboard.tsx`**
- Nowy typ `"brandkit"` w `activeView`
- Import i renderowanie `BrandKitView` gdy `activeView === "brandkit"`

**7. Zmiany w `DashboardSidebar.tsx`**
- Nowa pozycja nawigacji: `{ icon: Palette, label: "Brand Kit" }`
- Mapowanie w `viewMap`: `"Brand Kit": "brandkit"`

### Przepyw uzytkownika:

1. Uzytkownik klika "Brand Kit" w sidebarze
2. Widzi strone z sekcjami Logos, Colors, Fonts
3. Uploaduje logo, wybiera kolory, wybiera czcionke
4. Klika "Zapisz" -- dane zapisuja sie do bazy
5. Przy generowaniu embeda dla dowolnego filmu -- kolory i logo sa automatycznie pobierane z zapisanych ustawien
6. W dialogu embed mozna nadal recznie zmienic kolory per-embed

### Szczegoly techniczne:

- Upload logo: Supabase Storage bucket `brand-assets` z polityka RLS (uzytkownik uploaduje tylko do swojego folderu `{user_id}/`)
- Czcionka w embedzie: dodana jako Google Fonts `<link>` w generowanym kodzie embed
- Tabela `brand_settings` ma constraint UNIQUE na `user_id` -- jeden zestaw ustawien per uzytkownik
- Komponent BrandKitView uzywa kart z obramowaniem dashed (jak na screenshocie) dla pustych slotow

