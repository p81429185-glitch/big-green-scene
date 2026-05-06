## Plan naprawy

1. Ustabilizować komponent kolejki uploadu
   - Usunąć źródło ostrzeżeń `ref` bez wracania do wadliwego `forwardRef`.
   - Zastąpić Radix `ScrollArea` w `UploadQueue` prostym natywnym kontenerem scrollującym, bo to on przekazuje ref do zwykłych komponentów i generuje dodatkową pracę przy częstych renderach.
   - Użyć memoizacji komponentu kolejki i ikon statusu, żeby upload nie odświeżał niepotrzebnie całego widoku.

2. Odciążyć aktualizacje postępu
   - Przenieść buforowanie postępu w `useUploadQueue` na `requestAnimationFrame` + minimalny interwał, zamiast wykonywać `setQueue` bezpośrednio z każdego callbacku TUS.
   - Wymusić monotoniczne wartości procentów i bajtów, ale aktualizować React state tylko wtedy, gdy realnie zmienia się widoczny tekst/progress.

3. Zmniejszyć presję TUS na przeglądarkę
   - Obniżyć `parallelUploads` do 1 dla stabilności UI.
   - Zostawić resumable upload i retry, ale ograniczyć liczbę jednoczesnych callbacków/procesów, które obecnie powodują przycinki na dashboardzie.

4. Zweryfikować po zmianach
   - Sprawdzić konsolę pod kątem błędów runtime i ostrzeżeń `ref`.
   - Potwierdzić, że widget uploadu aktualizuje się płynnie i nie cofa procentów.