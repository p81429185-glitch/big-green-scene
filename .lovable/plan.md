

# Przebudowa dashboardu w stylu Wistia

## Co zrobimy
Przebudujemy dashboard, aby wyglądał jak na screenshocie z Wistia -- z paskiem akcji na gorze, banerem ostatnio oglądanego filmu, tabelą najczęściej odtwarzanych filmów i panelem bocznym z ostatnio udostępnionymi.

## Zmiany w `src/pages/Dashboard.tsx`

### 1. Sidebar -- nowa nawigacja (jak na screenie)
- Home, Ulubione, Biblioteka, Kanaly, Analityka (zamiast obecnych Filmy/Foldery/Ustawienia)
- Ikony dopasowane do Wistia

### 2. Top bar
- Pole wyszukiwania po lewej
- Avatar uzytkownika po prawej

### 3. Pasek akcji (action cards)
- Rzad kafelkow: "X odtworzen w tym tygodniu", **"Upload"**, "Nagraj", "Folder", "Kanal"
- Kafelek "Upload" bedzie glownym sposobem dodawania filmow (na razie UI-only, bez prawdziwego uploadu)

### 4. Baner "Ostatnio ogladany film"
- Zielone tlo (zamiast niebieskiego z Wistia)
- Tytul filmu, data ostatniej edycji
- Przycisk "Wznow" i X do zamkniecia

### 5. Sekcja glowna -- dwie kolumny
- **Lewa (szersza)**: "Najczesciej odtwarzane filmy" -- tabela z miniatura, tytulem, data, liczba odtworzen, engagement %
- **Prawa (wezsza)**: "Ostatnio udostepnione" -- karta z miniatura, linkiem, statystykami

### 6. Mock data
- Zaktualizowane dane filmow z polami: title, created, plays, engagement
- Dane do panelu "ostatnio udostepnione"

## Pliki do zmiany
- `src/pages/Dashboard.tsx` -- pelna przebudowa layoutu

## Uwagi
- Upload bedzie na razie tylko UI (przycisk + dialog placeholder)
- Kolorystyka zostaje zielona, ale layout 1:1 jak Wistia
- Responsywnosc zachowana (na mobile kolumny sie zwijaja)
