

## 1. Wyszukiwarka filmow na dashboardzie

Pole wyszukiwania w headerze (`Input` linia 101 w `Dashboard.tsx`) istnieje wizualnie, ale nie filtruje filmow. Trzeba je podlaczyc.

### Zmiany:

**`src/pages/Dashboard.tsx`**
- Nowy stan `searchQuery` (string)
- Podlaczenie `value` i `onChange` do istniejacego `Input` w headerze
- Rozszerzenie logiki `filteredVideos` o filtrowanie po `title` i `file_name` (case-insensitive) na podstawie `searchQuery`
- Wyszukiwanie dziala we wszystkich widokach (home, favorites, library)

---

## 2. Ograniczenie domeny w embed

Dodanie opcji w `EmbedDialog` pozwalajacej ustawic domene, na ktorej embed bedzie dzialal. Wygenerowany kod embed bedzie zawieral skrypt sprawdzajacy `window.location.hostname`.

### Zmiany:

**`src/components/dashboard/EmbedDialog.tsx`**
- Nowy stan `allowedDomain` (string, domyslnie pusty = brak ograniczenia)
- Nowy checkbox "Ogranicz do domeny" z polem tekstowym na wpisanie domeny (np. `mojastrona.pl`)
- Umieszczenie w sekcji zaawansowanych opcji (`advancedOptionsJsx`)
- Gdy domena jest ustawiona, wygenerowany kod embed (w `embedCode`) bedzie zawieral wrapper JS sprawdzajacy `window.location.hostname`:
  - Jesli hostname nie pasuje -- iframe nie zostanie wyrenderowany, zamiast tego pojawi sie komunikat "Ten film nie jest dostepny na tej stronie"
  - Jesli hostname pasuje -- normalny embed

### Przyklad wygenerowanego kodu z ograniczeniem:
```text
<div id="embed-xyz">
  <script>
    (function(){
      var allowed = "mojastrona.pl";
      if (window.location.hostname === allowed || window.location.hostname.endsWith("." + allowed)) {
        document.getElementById("embed-xyz").innerHTML = '<iframe src="..." ...></iframe>';
      } else {
        document.getElementById("embed-xyz").innerHTML = '<p>Ten film nie jest dostępny na tej stronie.</p>';
      }
    })();
  </script>
</div>
```

### Szczegoly techniczne

- Wyszukiwanie: prosty `filter` na tablicy `filteredVideos` z `toLowerCase().includes()`
- Ograniczenie domeny: generowanie unikalnego ID (`embed-` + losowy string) dla kazdego kodu embed, aby uniknac kolizji wielu embedow na jednej stronie
- Ograniczenie domeny to zabezpieczenie po stronie klienta (mozliwe do obejscia) -- wystarczajace dla typowych przypadkow uzycia

