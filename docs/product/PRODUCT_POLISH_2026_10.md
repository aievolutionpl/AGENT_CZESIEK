# Agent Czesiek — stabilizacja produktu, październik 2026

Aktualizacja przygotowana na `2585f1f227` (PR #95). Nie zmienia protokołu silnika,
nazw katalogów danych ani zasad licencji komponentów zewnętrznych.

## Co poprawiono

- **Pamięć:** każde tworzenie notatki przez API kończyło się HTTP 500, ponieważ
  `VaultNoteCreate` nie deklarował używanego przez handler `external_source`.
  Pole jest teraz przekazywane do istniejącej obsługi danych zewnętrznych.
  Zapis na Windows nie zmienia samoczynnie końców linii przesłanego tekstu.
- **Edytor:** ponawianie odczytu i odświeżania, blokada równoczesnych zapisów,
  zachowanie tekstu i otwartego potwierdzenia po błędzie zapisu. Na wąskim
  panelu edytor układa się pod grafem; tekst ma rozmiar i krój spójny z aplikacją.
- **Profile i połączenia:** cache mapy, kart pamięci, statusów integracji i
  uprawnień jest przypisany do właściwego backendu oraz profilu. Opóźniony zapis
  uprawnień nie zastępuje danych nowo wybranego połączenia. Kreator Google
  przypina swoje operacje do połączenia, na którym został otwarty.
- **Start aplikacji:** szablon pamięci i instrukcja współpracownika trafiają
  do skonfigurowanego vaultu. Błędna ścieżka nie tworzy drugiej pamięci w tle.
- **Pulpit:** większa powierzchnia kuli, bardziej okrągła szklana sylwetka,
  czytelniejsze cząsteczki, spokojniejszy ruch spoczynkowy i widoczny opis stanu.
  Osobny przycisk kuli otwiera nakładkę pulpitu. Menu ma łagodniejsze zaznaczenie,
  a tekst i przyciski nad fotografią mają wyraźniejsze podłoże i obramowanie.

## Weryfikacja

- Testy regresji odtworzyły sześć błędów na plikach z poprzedniego `main`
  (izolacja połączeń, zapis/odczyt edytora, wybór lokalizacji pamięci).
- Dwa testy HTTP odtworzyły błąd 500 przed poprawką modelu żądania.
- Vitest: **324 testy** obszarów pulpitu, ustawień integracji, pamięci i runtime.
- Python przez `scripts/run_tests.sh`: **12 testów** prawdziwych operacji vaultu
  oraz autoryzowanej ścieżki HTTP → plik → ponowny odczyt.
- Electron: **19 testów** — nawigacja, konfiguracja, prompty, zmiana języka, klawiatura,
  szerokości 390–2560 px, pływająca kula i zapis notatki po ponownym otwarciu.
- TypeScript, build aplikacji i lint zmienionych plików.

Testy używają tymczasowego profilu, tymczasowego vaultu i dostawcy testowego.
Nie korzystają z prywatnych kluczy ani osobistych notatek.

## Granice tego sprawdzenia

Nie potwierdzono rozmowy z płatnym API ani działania mikrofonu użytkownika.
Obsługa Google jest sprawdzona na poziomie kreatora i routingu; rzeczywisty
odczyt poczty wymaga autoryzacji właściciela konta. Nie wydano podpisanego
instalatora i nie wykonano instalacji na czystym Windows. Scalony kod, lokalny
build oraz opublikowany instalator są oddzielnymi etapami wydania.

Dotychczasowa lokalizacja vaultu w Documents jest wspólnym zeszytem użytkownika;
oddzielny cache profili nie tworzy automatycznie osobnych folderów pamięci.
Własny vault można wskazać w konfiguracji profilu.
