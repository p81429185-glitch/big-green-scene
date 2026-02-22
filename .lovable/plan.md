

# Naprawienie uploadu wideo -- prawdziwy progress bar

## Problem
Obecny upload uzywa `supabase.storage.upload()`, ktory nie daje informacji o postepie przesylania. Progress bar skacze sztucznie z 10% na 60% -- uzytkownik nie widzi rzeczywistego postepu, a przy duzych plikach wyglada to jakby sie zawieszlo.

## Rozwiazanie
Zamienimy upload na `XMLHttpRequest` z eventem `progress`, ktory daje rzeczywisty procent przeslanych bajtow. Supabase Storage API to standardowy REST endpoint, wiec mozna do niego wyslac plik przez XHR.

## Zmiany

### 1. `src/hooks/useVideoStore.ts` -- nowa funkcja uploadu z XHR
- Zastapienie `supabase.storage.upload()` wlasna funkcja uzywajaca `XMLHttpRequest`
- Endpoint: `{SUPABASE_URL}/storage/v1/object/videos/{path}`
- Naglowki: `Authorization: Bearer {token}`, `apikey: {anon_key}`
- Event `xhr.upload.onprogress` raportuje rzeczywisty % przeslanych bajtow
- Progress 0-90% = upload pliku, 90-95% = zapis metadanych, 95-100% = miniaturka
- Dodanie nazwy pliku i rozmiaru w komunikacie progressu

### 2. `src/components/dashboard/UploadDialog.tsx` -- lepszy UI progressu
- Wyswietlanie nazwy przesylanego pliku
- Wyswietlanie rozmiaru pliku (np. "245 MB")
- Wyswietlanie etapu: "Przesylanie pliku...", "Zapisywanie...", "Generowanie miniaturki..."
- Plynna animacja progress bara (transition CSS)

## Szczegoly techniczne

Upload przez XHR zamiast Supabase SDK:
```
const xhr = new XMLHttpRequest();
xhr.upload.onprogress = (e) => {
  if (e.lengthComputable) {
    onProgress((e.loaded / e.total) * 90);
  }
};
xhr.open('POST', `${url}/storage/v1/object/videos/${path}`);
xhr.setRequestHeader('Authorization', `Bearer ${token}`);
xhr.setRequestHeader('apikey', anonKey);
xhr.send(file);
```

To daje rzeczywisty, plynny progress bar oparty na przeslanych bajtach.
