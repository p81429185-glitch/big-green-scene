

## Przyciski skip 15s obok duzego Play na srodku ekranu

### Obecny stan
Duzy przycisk Play (overlay na srodku) pojawia sie gdy wideo jest zapauzowane -- jest to pojedyncze kolko z ikona Play. Przyciski skip 15s sa tylko w dolnym pasku kontrolnym.

### Zmiana

**Plik: `src/components/video/BrandedVideoPlayer.tsx`**

Zmodyfikowac sekcje "Big play button" (linie 255-267) tak, aby zamiast samego przycisku Play, wyswietlac 3 elementy obok siebie:

```text
[ <<15 ]   [ PLAY ]   [ 15>> ]
```

Szczegoly:
- Kontener uzywa `flex items-center gap-6` (lub gap-8) zeby przyciski mialy odstep
- Przycisk Play -- obecne kolko z ikona, bez zmian (16x16 / w-16 h-16)
- Przyciski skip -- mniejsze kolka (np. w-10 h-10) z polprzezroczystym tlem (`rgba(0,0,0,0.5)`), z ikonami strzalek 15s (takie same SVG jak w control bar, tylko wieksze ~20x20)
- Przyciski musza miec `pointer-events-auto` (kontener nadrzedny ma `pointer-events-none` zeby klikniecie poza przyciskami przechodzilo do video)
- Klikniecie skip wywoluje istniejaca funkcje `skip(-15)` / `skip(+15)` z `e.stopPropagation()` zeby nie triggerowalo togglePlay
- Przyciski sa widoczne takze podczas odtwarzania gdy kontrolki sa widoczne (hover), nie tylko na pauzie

### Techniczne

Nowy JSX dla overlay (zastepuje linie 255-267):

```
<div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"
     style={{ opacity: showControls || !playing ? 1 : 0, transition: "opacity 0.3s" }}>

  <!-- Skip back 15s -->
  <button pointer-events-auto w-10 h-10 rounded-full bg-black/50
          onClick={skip(-15)} stopPropagation>
    [ikona 15s wstecz, 20x20]
  </button>

  <!-- Play/Pause (duzy) -->
  <button pointer-events-auto w-16 h-16 rounded-full bg play_bg_color
          onClick={togglePlay} stopPropagation>
    [ikona play lub pause]
  </button>

  <!-- Skip forward 15s -->
  <button pointer-events-auto w-10 h-10 rounded-full bg-black/50
          onClick={skip(15)} stopPropagation>
    [ikona 15s do przodu, 20x20]
  </button>
</div>
```

Kluczowe punkty:
- Overlay jest widoczny rowniez podczas odtwarzania (przy hover), nie tylko na pauzie
- Kazdy przycisk ma `pointer-events-auto` i `e.stopPropagation()` zeby nie konfliktowal z `onClick={togglePlay}` na kontenerze
- Ikona w duzym przycisku zmienia sie miedzy Play a Pause w zaleznosci od stanu `playing`
- Przyciski skip w dolnym control bar pozostaja bez zmian
