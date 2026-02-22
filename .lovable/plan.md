
## Prawdziwe logowanie + Panel admina do tworzenia kont

### Co robimy

1. **Zamiana hardcoded auth na prawdziwe logowanie** przez backend (Supabase Auth)
2. **Utworzenie konta admina** z danymi: `michalrucznaj@gmail.com` / `Admin123`
3. **System rol** -- tabela `user_roles` z rola `admin`
4. **Panel admina** do tworzenia nowych kont uzytkownikow
5. **Auto-confirm email** -- wlaczenie automatycznego potwierdzania emaili (zeby nie trzeba bylo klikac linku weryfikacyjnego)

---

### Krok 1: Migracja bazy danych

Utworzenie tabeli `user_roles` i tabeli `profiles` oraz funkcji pomocniczej `has_role`:

```sql
-- Enum rol
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Tabela rol
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Tabela profili
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Funkcja sprawdzajaca role (security definer, bez rekurencji RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS na user_roles: admini widza wszystko, usery widza swoje
CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- RLS na profiles
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT TO authenticated USING (id = auth.uid());

CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Trigger auto-tworzenia profilu po rejestracji
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### Krok 2: Wlaczenie auto-confirm email

Uzycie narzedzia `configure-auth` zeby wlaczyc automatyczne potwierdzanie emaili.

### Krok 3: Utworzenie konta admina

Uzycie edge function `create-admin` do:
1. Rejestracji usera `michalrucznaj@gmail.com` z haslem `Admin123`
2. Dodania roli `admin` w tabeli `user_roles`

### Krok 4: Nowy `AuthContext.tsx`

Calkowita zamiana -- zamiast hardcoded credentials, uzywa Supabase Auth:

- `supabase.auth.signInWithPassword()` do logowania
- `supabase.auth.signUp()` do rejestracji (tylko admin moze)
- `supabase.auth.signOut()` do wylogowania
- `onAuthStateChange` listener do sledzenia sesji
- Stan: `user`, `session`, `isAdmin`, `loading`
- Funkcja `isAdmin` sprawdza role w tabeli `user_roles`

### Krok 5: Nowa strona `Auth.tsx`

- Formularz logowania (email + haslo)
- Uzywa `supabase.auth.signInWithPassword()`
- Po zalogowaniu redirect do `/dashboard`

### Krok 6: Panel admina -- nowa strona/widok

Nowy widok w dashboardzie (np. `AdminUsersView.tsx`):

- Widoczny tylko dla adminow
- Lista uzytkownikow (z tabeli `profiles`)
- Formularz "Dodaj uzytkownika":
  - Email, haslo, rola (admin/user)
  - Wywoluje edge function `create-user` ktora:
    - Uzywa `supabase.auth.admin.createUser()` (wymaga service_role_key)
    - Dodaje role do `user_roles`
- Opcja usuwania uzytkownikow

### Krok 7: Edge function `create-user`

```typescript
// supabase/functions/create-user/index.ts
// - Weryfikuje ze wywolujacy jest adminem (sprawdza has_role)
// - Tworzy usera przez admin API
// - Dodaje role do user_roles
// - Zwraca dane nowego usera
```

### Krok 8: Sidebar -- nowy przycisk "Uzytkownicy"

- Widoczny tylko dla adminow
- Nowy `activeView: "users"` w DashboardSidebar
- Ikona Users/UserPlus

### Krok 9: Aktualizacja RLS na istniejacych tabelach

Obecne tabele (`videos`, `folders`, `video_chapters`, `brand_settings`) maja "Allow all" RLS. Trzeba je zaktualizowac zeby dzialaly z prawdziwym auth -- na razie zostawiamy je otwarte (bo to admin-only app), ale dodamy warunek `authenticated`.

---

### Modyfikowane/tworzone pliki:

| Plik | Akcja |
|------|-------|
| Migracja SQL | Nowa (user_roles, profiles, has_role, trigger) |
| `supabase/functions/create-user/index.ts` | Nowy |
| `src/contexts/AuthContext.tsx` | Zamiana na Supabase Auth |
| `src/pages/Auth.tsx` | Zamiana na signInWithPassword |
| `src/components/dashboard/AdminUsersView.tsx` | Nowy |
| `src/components/dashboard/DashboardSidebar.tsx` | Dodanie "Uzytkownicy" dla admina |
| `src/pages/Dashboard.tsx` | Dodanie widoku "users" |
