
# Transkrypcja wideo za pomoca AI (Gemini)

## Opis
System automatycznej transkrypcji wideo z uzyciem Lovable AI (Gemini). Uzytkownik klika przycisk "Transkrybuj" na stronie wideo, a AI przetwarza audio i zapisuje tekst transkrypcji w bazie danych.

## Zmiany w bazie danych

Dodanie kolumny `transcription` do tabeli `videos`:

```sql
ALTER TABLE videos ADD COLUMN transcription text;
```

## Nowa funkcja backendowa: `transcribe-video`

Plik: `supabase/functions/transcribe-video/index.ts`

1. Odbiera `videoId` w body (POST)
2. Pobiera rekord wideo z bazy (storage_path)
3. Generuje publiczny URL wideo
4. Pobiera plik wideo jako binary (z limitem ~50MB)
5. Konwertuje na base64
6. Wysyla do Lovable AI Gateway (Gemini) z promptem: "Transkrybuj dokladnie wszystkie slowa wypowiedziane w tym nagraniu wideo. Zwroc sama transkrypcje bez dodatkowych komentarzy."
7. Zapisuje wynik w kolumnie `transcription` tabeli `videos`
8. Zwraca transkrypcje w odpowiedzi

Konfiguracja w `supabase/config.toml`:
```toml
[functions.transcribe-video]
verify_jwt = false
```

## Zmiany w UI

### Plik: `src/pages/VideoPlayer.tsx`

1. Dodanie stanu `transcribing` (boolean) i `transcription` (string | null)
2. Przy ladowaniu wideo, odczytanie istniejacego pola `transcription` z bazy
3. W panelu bocznym (zakladka "Szczegoly") lub jako nowa zakladka "Transkrypcja":
   - Jesli transkrypcja istnieje -- wyswietlenie tekstu
   - Jesli nie -- przycisk "Transkrybuj" ktory wywoluje edge function
   - Podczas przetwarzania -- spinner z napisem "Trwa transkrypcja..."
4. Mozliwosc ponownej transkrypcji (przycisk "Transkrybuj ponownie")

### Plik: `src/components/dashboard/EmbedDialog.tsx`

Zakladka "Transkrypcja" (obecnie placeholder) -- wyswietlenie transkrypcji jako kod embed do osadzenia, jesli transkrypcja istnieje. Komponent otrzyma nowy prop `transcription`.

## Przeplyw uzytkownika

1. Uzytkownik otwiera strone wideo
2. W panelu bocznym widzi zakladke "Transkrypcja" lub przycisk w "Szczegolach"
3. Klika "Transkrybuj"
4. Pojawia sie spinner -- "Trwa transkrypcja..."
5. Po zakonczeniu tekst transkrypcji wyswietla sie w panelu
6. Transkrypcja jest zapisana w bazie -- przy kolejnych odwiedzinach laduje sie automatycznie

## Ograniczenia
- Limit rozmiaru pliku do ~50MB (wieksze pliki moga przekroczyc limity API)
- Czas przetwarzania zalezy od dlugosci wideo (moze trwac 10-60 sekund)
- Jesli wideo jest za duze, pokaze sie odpowiedni komunikat bledu
