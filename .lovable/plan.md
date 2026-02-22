

# System logowania tylko dla admina (bez Supabase)

## Co zrobimy
Stworzymy prosty system logowania z hardcoded danymi admina, bez publicznej rejestracji. Supabase podłączymy później.

## Zmiany

### 1. Kontekst autoryzacji (`src/contexts/AuthContext.tsx`)
- Nowy kontekst React przechowujący stan zalogowanego użytkownika
- Hardcoded dane admina: `michalrucznaj@gmail.com` / `Admin123`
- Funkcje: `login()`, `logout()`, `isAuthenticated`
- Stan zapisywany w `localStorage` (przetrwa odświeżenie strony)

### 2. Strona logowania (`src/pages/Auth.tsx`)
- Usunięcie opcji rejestracji -- tylko formularz logowania
- Walidacja danych z hardcoded adminem
- Po zalogowaniu przekierowanie na `/dashboard`
- Komunikat błędu przy złych danych

### 3. Ochrona dashboardu (`src/pages/Dashboard.tsx`)
- Przekierowanie na `/auth` gdy użytkownik nie jest zalogowany
- Przycisk wylogowania w sidebarze
- Wyświetlanie emaila admina zamiast "Jan Kowalski"

### 4. App.tsx
- Owinięcie aplikacji w `AuthProvider`

## Uwaga
To rozwiązanie tymczasowe -- hasło jest w kodzie. Po podłączeniu Supabase przeniesiemy auth na prawdziwy backend.

