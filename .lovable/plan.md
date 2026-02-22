

## Dodanie przycisku NotebookLM pod odtwarzaczem wideo

Prosty przycisk/link pod playerem wideo, ktory przekierowuje uzytkownika na strone NotebookLM (https://notebooklm.google.com/) w nowej karcie przegladarki.

### Zmiany

**Plik: `src/pages/VideoPlayer.tsx`**

Pod elementem `<video>` (wewnatrz sekcji odtwarzacza) dodany zostanie przycisk:
- Ikona zewnetrznego linku + tekst "Otworz w NotebookLM"
- Klikniecie otwiera https://notebooklm.google.com/ w nowej karcie
- Styl: wariant `outline`, pelna szerokosc pod playerem, z mala przerwa (margin-top)

