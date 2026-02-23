

## Naprawa uploadu plików ze spacjami i polskimi znakami

### Problem
Nazwa pliku `VSL OCZY PEŁNY.mp4` zawiera spacje i polskie znaki (Ł, Ó), które są niedozwolone w kluczach storage. Upload kończy się błędem 400.

### Rozwiązanie
Dodanie funkcji sanityzacji nazwy pliku, która zamieni niedozwolone znaki na podkreślniki przed uploadem.

### Zmiany

**Plik: `src/hooks/useVideoStore.ts`**
- Dodanie funkcji `sanitizeFileName()` która:
  - Zamienia wszystkie znaki niealfanumeryczne (spacje, polskie litery, symbole) na podkreślniki `_`
  - Usuwa podwójne podkreślniki
  - Obcina nazwę do max 100 znaków
- Zmiana linii generującej `storagePath`:
  ```
  // Przed:
  const storagePath = `${crypto.randomUUID()}_${file.name}`;
  // Po:
  const storagePath = `${crypto.randomUUID()}_${sanitizeFileName(file.name)}`;
  ```

Oryginalna nazwa pliku (`file.name`) nadal będzie zapisywana w bazie danych w kolumnie `file_name` i wyświetlana użytkownikowi -- zmiana dotyczy tylko klucza w storage.

### Szczegoly techniczne

Funkcja sanityzacji:
```javascript
function sanitizeFileName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9_\-.]/g, '_')
    .replace(/_+/g, '_')
    .substring(0, 100);
}
```
