
Cel: naprawić błąd uploadu dużych plików (`PATCH .../upload/resumable -> 400` z treścią `403 AccessDenied`) bez kupowania dodatkowej usługi typu Cloudflare Storage.

Co już wiemy po analizie:
- Limit rozmiaru pliku dla bucketa `videos` jest już poprawnie ustawiony na 5 GB.
- Problem nie wynika już z limitu rozmiaru, tylko z autoryzacji podczas kolejnych chunków TUS (`PATCH`).
- W regułach dostępu do plików istnieją polityki `SELECT/INSERT/DELETE` dla `videos`, ale brakuje polityki `UPDATE` dla `videos`.
- TUS przy uploadzie resumable używa `PATCH`, który wymaga uprawnień odpowiadających `UPDATE` na obiekcie w storage.
- W kodzie uploadu jest fallback do klucza publicznego, gdy brak sesji (`token = session?.access_token || anonKey`), co utrudnia diagnozę i może kończyć się 403 zamiast jasnego komunikatu „zaloguj się”.

Zakres wdrożenia:
1) Migracja backendu (najważniejsze)
- Dodać brakującą politykę `UPDATE` dla plików w buckecie `videos` na `storage.objects`.
- Zrobić to idempotentnie (najpierw `DROP POLICY IF EXISTS`, potem `CREATE POLICY`), żeby migracje były powtarzalne.
- Polityka będzie ograniczona do konkretnego bucketa (`bucket_id = 'videos'`), aby nie otwierać innych zasobów.

2) Małe utwardzenie uploadu po stronie frontendu
- W `useVideoStore.ts` zmienić logikę tokenu:
  - jeśli użytkownik nie ma aktywnej sesji, przerwać upload od razu z czytelnym błędem („Sesja wygasła, zaloguj się ponownie”),
  - nie używać fallbacku do anon key dla uploadów wymagających uprawnień zapisu.
- Dzięki temu użytkownik dostanie precyzyjny komunikat zamiast niejasnego `AccessDenied`.

3) (Opcjonalnie w tym samym kroku, jeśli chcesz od razu domknąć temat)
- Dodać analogiczną politykę `UPDATE` dla bucketa `thumbnails`, żeby zapobiec cichym błędom przy `upsert: true` miniaturek.

Pliki, które zostaną zmienione po akceptacji:
- `supabase/migrations/<nowa_migracja>.sql`
  - dodanie polityki `UPDATE` dla `storage.objects` (bucket `videos`, opcjonalnie także `thumbnails`).
- `src/hooks/useVideoStore.ts`
  - usunięcie fallbacku anon dla uploadu TUS i dodanie jasnego błędu przy braku sesji.

Plan testów po wdrożeniu:
1. Zalogować się i wejść do Dashboard.
2. Wrzucić duży plik (np. >200 MB) i potwierdzić:
   - brak błędu `PATCH 400/403`,
   - upload dochodzi do 100%,
   - rekord pojawia się na liście filmów.
3. Odświeżyć stronę i sprawdzić, czy wideo dalej jest dostępne.
4. Sprawdzić zachowanie bez sesji (po wylogowaniu):
   - upload ma być zablokowany od razu z jasnym komunikatem o konieczności logowania.
5. (Jeśli dodamy thumbnails UPDATE) podmienić miniaturę tego samego filmu i potwierdzić brak błędów.

Ryzyko i rollback:
- Ryzyko niskie: zmiana punktowa w polityce storage + komunikat sesji w uploaderze.
- Jeśli cokolwiek pójdzie nie tak, rollback to usunięcie nowej polityki migracją naprawczą i przywrócenie poprzedniej logiki tokenu.

Dlaczego nie trzeba kupować Cloudflare:
- Błąd jest autoryzacyjny (RLS/polityki dostępu), nie pojemnościowy ani transferowy.
- Po poprawnej polityce `UPDATE` upload resumable powinien działać na obecnym backendzie.
