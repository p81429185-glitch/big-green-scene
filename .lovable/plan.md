

# Naprawa warninga w EmbedDialog

## Problem
Komponent `AdvancedOptions` jest zdefiniowany jako zwykla funkcja wewnatrz `EmbedDialog`. Radix UI (przez `TabsContent` / `CollapsibleContent`) probuje przekazac do niego `ref`, co powoduje warning w konsoli:
> "Function components cannot be given refs."

## Rozwiazanie
Zamiast definiowac `AdvancedOptions` i inne pod-komponenty (`SizeOptions`, `VideoPreview`, `PlaceholderTab`) jako osobne function components wewnatrz renderowania, nalezy zamienic je na **inline JSX** bezposrednio w kodzie `EmbedDialog`, lub przeniesc je poza komponent i uzyc `React.forwardRef`.

Najprostrsze podejscie: zamienic wewnetrzne komponenty na zwykly inline JSX w odpowiednich miejscach w `TabsContent`. To eliminuje problem z ref i upraszcza kod.

### Plik: `src/components/dashboard/EmbedDialog.tsx`

1. Usunac definicje `SizeOptions`, `AdvancedOptions`, `VideoPreview`, `PlaceholderTab` jako osobnych komponentow
2. Wstawic ich zawartosc bezposrednio (inline) w odpowiednie miejsca w JSX
3. Zadna zmiana logiki ani wygladu -- tylko refaktor struktury JSX

