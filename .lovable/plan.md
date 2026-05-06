## Cel
Naprawić zawieszanie/glitchowanie widżetu uploadu bez redesignu UI i bez zmiany backendu.

## Plan zmian
1. **Ograniczyć częstotliwość aktualizacji progressu**
   - `tus-js-client` przy `parallelUploads` może wywoływać `onProgress` bardzo często.
   - Dodam throttling aktualizacji stanu Reacta, żeby UI odświeżało się maksymalnie kilka razy na sekundę oraz zawsze dostało finalne 100%.

2. **Zmniejszyć presję równoległych chunków**
   - Obecne `parallelUploads: 6` oznacza wiele równoległych requestów i bardzo dużo eventów progressu.
   - Zmienię to na bezpieczniejsze `parallelUploads: 3`, nadal szybkie, ale stabilniejsze na telefonach i słabszych łączach.

3. **Ustabilizować hook kolejki**
   - Zmieniam `useUploadQueue`, żeby ignorował drobne/zbędne aktualizacje, które nie zmieniają realnie paska.
   - Zachowam monotoniczne wartości `progress` i `bytesUploaded`, żeby pasek nie cofał się ani nie „mielił” renderów.

4. **Naprawić ostrzeżenia React ref**
   - Konsola pokazuje `Function components cannot be given refs` dla `UploadQueue` i `StatusIcon`.
   - Opakuję te komponenty przez `React.forwardRef` albo usunę źródło przekazywania refa, żeby nie generowały błędów/renderowych warningów podczas uploadu.

## Pliki do zmiany
- `src/hooks/useVideoStore.ts`
- `src/hooks/useUploadQueue.ts`
- `src/components/dashboard/UploadQueue.tsx`

## Weryfikacja po wdrożeniu
- Uruchomić upload dużego pliku i sprawdzić, że pasek idzie płynnie do przodu.
- Sprawdzić, że UI nie freezuje przy aktywnym uploadzie.
- Sprawdzić konsolę: brak warningów `Function components cannot be given refs` dla uploadu.
- Test mobilny: widżet nadal mieści się i pozwala anulować upload.