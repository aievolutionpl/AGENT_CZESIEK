# Agent Czesiek — odbiór uproszczonego interfejsu

## Zakres

Uproszczone menu: Pulpit, Zadania, Agenci, Rozmowy, Integracje i Więcej. Ustawienia i profil znajdują się na dole. Panele zadań i pamięci można otwierać na żądanie. Orb jest większy i dopasowuje się do dostępnej przestrzeni nad polem rozmowy. Materiały glassmorphism mają czytelniejsze tło oraz obsługę ograniczonych animacji.

Ustawienia głosu rozdzielają rozmowę Gemini Live od odczytu odpowiedzi ElevenLabs. Lista ElevenLabs pochodzi z konta użytkownika. Próbki są odtwarzane pojedynczo; spóźnione odpowiedzi poprzedniego profilu nie zmieniają bieżącego wyboru. Klucze pozostają po stronie backendu.

Google pokazuje niezależny wynik sprawdzenia Gmaila, Kalendarza i Dysku. Sam zapis tokenu nie oznacza sprawnego połączenia. Test wykonuje minimalny odczyt bez zwracania treści wiadomości lub plików.

## Potwierdzone lokalnie

- Pełne testy interfejsu: 8032 testy, bez błędów.
- Dodatkowy przebieg czterech plików nowych testów: 17 testów, w tym 2 testy ElevenLabs nieuwzględnione w powyższym przebiegu.
- Python przez kanoniczny runner: 44 testy w trzech plikach, bez błędów.
- Wybrane testy Electron dotyczące pakowania i przechwytywania ekranu: 16 testów, bez błędów.
- Odbiór Electron: 20 scenariuszy, bez błędów. Nawigacja, ustawienia, pamięć, nakładka oraz układ w 390, 768, 1280, 1440 i 1920 px.
- Kontrola typów i build: poprawne. Lint: 0 błędów, 193 ostrzeżenia.

Nowe obrazy pulpitu, integracji i pamięci zastępują wcześniejsze screenshoty w README. Obrazy light/dark dla pięciu szerokości są w `docs/assets/czesiek/acceptance/`. To lokalny odbiór aplikacji, bez potwierdzenia płatnych usług na żywo.

## Ograniczenia odbioru

CI używa standardowych runnerów GitHub zamiast niedostępnych w forku etykiet płatnych runnerów upstreamu. Pełny zakres testów pozostaje zachowany. Większe runnery można skonfigurować zmiennymi `CZESIEK_PYTHON_CI_RUNNER`, `CZESIEK_WINDOWS_CI_RUNNER` i `CZESIEK_RUST_CI_RUNNER`; równoległość Pythona ustawia `CZESIEK_TEST_WORKERS`. Test hooka pakowania izoluje etap kopiowania natywnych bibliotek, którego rzeczywiste zachowanie sprawdza oddzielny zestaw testów.

Nie przeprowadzono rzeczywistej rozmowy Gemini, płatnego odsłuchu ElevenLabs ani autoryzacji Google na koncie użytkownika. Te ścieżki wymagają osobnego odbioru z aktualnymi uprawnieniami i kluczami.

Pełny zestaw natywnych testów Electron na Windows: 161 plików przeszło, 14 nie przeszło, 1 pominięto; 2257 testów przeszło, 42 nie przeszły, 7 pominięto. Znaczna część niepowodzeń dotyczy założeń POSIX, trybów plików oraz ścieżek innych systemów. Wynik wybranych testów i E2E nie zastępuje pełnego odbioru natywnego.

Próba pełnego pakowania została zatrzymana przez brak przygotowanego runtime Windows zgodnego z manifestem. Nie wyłączono tej kontroli. Ten update nie dostarcza nowego podpisanego instalatora ani dowodu instalacji na czystym Windows.
