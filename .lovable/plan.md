

## Zmiana kolorystyki na zielono-biala

Zmiana polega wylacznie na podmianie zmiennych CSS w `src/index.css` oraz usunieciu klasy `dark` z `<body>` w `index.html`. Zadne komponenty nie zostana zmienione -- caly layout, gradienty i efekty pozostaja takie same, zmienia sie tylko paleta kolorow.

### Co sie zmieni:

**`index.html`**
- Usuniecie `class="dark"` z `<body>` -- strona bedzie jasna (biala) domyslnie

**`src/index.css`** -- nowa paleta `:root` (light mode):
- Background: bialy / bardzo jasny szary
- Foreground: ciemny szaro-zielony
- Primary: soczysty zielony (ok. `142 71% 45%` -- emerald green)
- Accent: ciemniejszy zielony lub tealowy (ok. `160 84% 39%`)
- Card: czysty bialy
- Muted: jasny szaro-zielony
- Sidebar: bardzo jasny zielonkawy
- Ring/border: subtelne szaro-zielone

Tryb `.dark` rowniez zostanie zaktualizowany na zielone odcienie (ciemne tlo z zielonym accentem), ale domyslnie strona bedzie jasna/biala.

### Czego NIE zmieniam:
- Zadne komponenty (Index, Dashboard, Sidebar, ActionCards, itd.) -- ich klasy Tailwind odwoluja sie do zmiennych CSS, wiec automatycznie dostaną nowe kolory
- Zadna logika ani layout
- Czcionki i rozmiary zostaja bez zmian

