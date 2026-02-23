

## Utworzenie konta admina

### Co zostanie zrobione
Wywołanie istniejącej funkcji backendowej `create-admin`, która:
- Utworzy konto z emailem `michalrucznaj@gmail.com` i hasłem `Admin123`
- Potwierdzi email automatycznie (bez potrzeby weryfikacji)
- Nada rolę `admin` w tabeli `user_roles`

### Szczegoly techniczne
Funkcja `create-admin` jest juz zaimplementowana w `supabase/functions/create-admin/index.ts` i zawiera te dane logowania na stale. Wystarczy ja wywolac (deploy + curl).

| Krok | Opis |
|------|------|
| 1 | Deploy funkcji `create-admin` (jesli nie jest jeszcze wdrozona) |
| 2 | Wywolanie funkcji przez HTTP |
| 3 | Weryfikacja ze konto dziala -- logowanie na `/auth` |

Zadne pliki nie wymagaja zmian.

