# Głos Cześka — research, audyt i rekomendowany setup

Stan na 2026-09-30. Dotyczy rozmowy głosowej Live (`voice.engine: realtime`). Kod: `hermes_cli/web_routers/voice_realtime.py`,
`hermes_cli/web_routers/voice_desk.py`, `hermes_cli/kanban_voice_desk.py`, `apps/desktop/src/lib/live-voice/`.

## 1. Werdykt

**Zostajemy przy „przednim agencie” na modelu speech-to-speech, a mózgiem i wszystkimi uprawnieniami pozostaje Hermes.**
Model głosowy słucha, mówi i przerywa się naturalnie; nigdy nie dostaje narzędzi, plików ani zgód. Do roboty odsyła
Hermesa albo — od tej zmiany — **tablicę kanban**, która jest księgą zleceń: co zlecono, komu, w jakim stanie, z jakim wynikiem.

| Decyzja | Wybór | Dlaczego |
|---|---|---|
| Front głosowy | Gemini Live (domyślnie), OpenAI Realtime (alternatywa) | Niski czas odpowiedzi, przerywanie, wywołania funkcji. Oba już działają za jednym kontraktem. |
| Mózg | Hermes | Narzędzia, pamięć, zatwierdzenia, sub-agenci, sterowanie komputerem zostają w jednym miejscu. |
| Śledzenie pracy | Kanban (SQLite) | Trwały, widoczny z dashboardu, przeżywa restart i działa między procesami. |
| Wzrok | Jedno zdjęcie ekranu na żądanie → model wizyjny Hermesa | Działa u każdego providera; nic nie jest strumieniowane ani zapisywane. |
| ElevenLabs | Jako **głos** silnika `classic` (już wybieralny: `tts.elevenlabs.*`), nie jako trzeci provider Live | Patrz §2. |
| GPT-Live-1 | Odłożony | Brak wejścia obrazu, polski niepotwierdzony, inny protokół delegacji. |

## 2. Porównanie dostawców

Liczby pochodzą z wyników wyszukiwania (dokumentacji dostawców nie dało się otworzyć z tego środowiska), więc **traktuj je
orientacyjnie i sprawdź przed decyzją zakupową**.

| | Gemini 3.8 Live | OpenAI gpt-realtime-2.1 | GPT-Live-1 | ElevenLabs Agents |
|---|---|---|---|---|
| Architektura | speech-to-speech | speech-to-speech | pełny duplex, warstwa głosu | kaskada STT → LLM → TTS |
| Polski | tak | tak | niepotwierdzony | tak |
| Obraz/ekran | natywne klatki wideo | wejście obrazu | brak | obraz/plik przez LLM wizyjny |
| Narzędzia | funkcje, także asynchroniczne (SILENT / WHEN_IDLE) | funkcje, MCP | delegacja (`session.delegation.created` → `delegate`) | narzędzia klienta, `contextual_update`, własny serwer LLM |
| Koszt (orient.) | najtańszy dźwięk, ok. 3 / 12 USD za 1 mln tokenów | 32 / 64 USD za 1 mln tokenów audio | 0,05 USD/min warstwy głosu | 0,08 USD/min + koszt LLM |
| Mocna strona | cena, obraz, asynchroniczne narzędzia | dojrzałe WebRTC, obraz | naturalny duplex | najlepsza prozodia i głosy |
| Słaba strona | limity sesji (kompresja + wznawianie) | cena | młody, bez obrazu | większe opóźnienie i koszt, agent trzeba utrzymywać po stronie ElevenLabs |
| W repo | **tak** (domyślny) | **tak** | nie | tylko TTS/STT |

**Dlaczego ElevenLabs nie jest trzecim providerem Live:** jego agent to kaskada z własnym LLM — dublowałby rolę Hermesa
(dwa „mózgi”, dwie polityki zgód), a agent i narzędzia żyją na koncie ElevenLabs, czyli poza naszym procesem zatwierdzeń.
Jeśli zależy Ci na samym brzmieniu, ustaw `voice.engine: classic` i `tts.provider: elevenlabs`: Hermes zostaje mózgiem,
a ElevenLabs tylko mówi. To wybór jakości kosztem opóźnienia.

## 3. Audyt stanu sprzed zmiany

- `delegate_to_hermes` uruchamiał zwykłą turę w czacie. Raport wracał, ale tylko dla sub-agentów tej jednej sesji
  (`$subagentsBySession`, pamięć procesu) — po restarcie nic nie zostawało, a model głosowy nie miał jak zapytać „co z robotą?”.
- Model nie widział ekranu.
- Dyspozytor kanban działa **tylko w bramce wiadomości** (gateway). Sesja desktopowa bez bramki nie wykonałaby zlecenia
  wrzuconego na tablicę — zadanie czekałoby w nieskończoność.
- `agent/task_registry.py` (RPC `task.*`) istnieje, ale jest w pamięci procesu i głos go nie używa.
- Dwa providery miały osobne kopie tej samej logiki wywołań narzędzi.

## 4. Co wdrożono

**Tablica pracy** (`kanban_voice_desk.py`, router `/api/voice/desk*`). Nowe narzędzia głosu:

- `assign_work` — zlecenie dla współpracownika (profilu Hermesa); wraca od razu z id zadania. Powtórzone w 2 minuty to to samo zadanie.
- `work_status` — odczyt tablicy lub jednego zadania, natychmiast, bez tury Hermesa.
- `steer_work` — nowy kierunek, odpowiedź na pytanie współpracownika (odblokowuje zadanie) albo zatrzymanie.

Zasady, które trzymają to w ryzach:

- **Tylko stan potwierdzony przez backend.** Werdykt liczy backend z pól tablicy: `done` tylko z raportem,
  `done_unreported` (zamknięte bez raportu — „nie potwierdzaj sukcesu”), `needs_you`, `blocked`, `stalled`
  (ciche ponad 15 min), `retrying`. Model dostaje te słowa i nie może ich ulepszać.
- **Tekst współpracownika to dane, nie polecenia.** Streszczenia, wyniki i komentarze trafiają do modelu w
  `<external-data>`; znacznik wstrzyknięty w treść jest neutralizowany.
- **Dyspozytor na żądanie.** `dispatch` i `steer` uruchamiają jeden tik dyspozytora (bezpieczny obok działającej bramki:
  blokada per tablica). Odpowiedź mówi wprost, gdy żaden dyspozytor nie działa.
- **Raporty same przychodzą.** Desktop co 8 s czyta tablicę i, dla zadań tej rozmowy, zgłasza modelowi: zakończone,
  zamknięte bez raportu, czeka na Ciebie, zablokowane, utknęło. Pierwszy odczyt to tylko punkt odniesienia —
  praca skończona przed rozmową nie jest „nowiną”.

**Wzrok** (`look_at_screen`, `electron/screen-capture.ts`, `agent/screen_vision.py`). Jedno zdjęcie głównego ekranu,
tylko gdy model o nie poprosi; skalowane do 1600 px, JPEG; opisuje je model wizyjny Hermesa; opis wraca jako dane
(`<external-data source="screen">`), a pytanie do modelu wizyjnego mówi, że tekst na ekranie nigdy nie jest poleceniem.
Każde spojrzenie pokazuje powiadomienie. Narzędzie jest deklarowane tylko, gdy klient potrafi przechwytywać ekran
(własność sesji, nie hosta) i `voice.vision.enabled` nie jest wyłączone (Ustawienia → Voice). macOS bez uprawnienia
do nagrywania ekranu dostaje uczciwe „nie widzę”, nie pusty obraz.

**Jeden runner narzędzi** (`live-voice/tools.ts`): oba providery podają `(nazwa, argumenty)` i dostają tekst dla modelu.
Nowy provider to jeden plik transportu plus mintowanie sesji.

## 5. Czego nie zrobiono (i dlaczego)

- **Natywne klatki obrazu** (Gemini `realtimeInput.video`, OpenAI `input_image`) — wymagają sprawdzenia na żywym koncie.
  Zdjęcie na żądanie działa u obu providerów bez tego.
- **ElevenLabs Agents i GPT-Live-1 jako providery Live** — protokołów nie dało się zweryfikować w dokumentacji, a transport
  pisany na ślepo to gotowy sposób na ciche awarie. Kontraktem jest `LiveVoiceProvider` (`live-voice/types.ts`).
- **Testy na prawdziwych kontach i w Electronie** — nie miałem ani kluczy, ani GUI. Przetestowane są: logika tablicy na
  prawdziwej bazie kanban, trasy REST, deklaracje narzędzi obu providerów, runner, watcher, reguły przechwytywania.
  Nieprzetestowane: realny zrzut na Wayland/macOS i prawdziwa rozmowa.
- Nowe napisy są tylko po polsku i angielsku.

## 6. Jak to sprawdzić ręcznie

1. Włącz rozmowę Live i powiedz: „zleć mojemu asystentowi research rynku AI i daj znać, jak skończy”.
2. Zapytaj: „co z robotą?” — odpowiedź ma zawierać liczby z tablicy, nie zgadywanie.
3. Gdy zadanie się zamknie, Czesiek ma sam zgłosić wynik; zadanie bez raportu ma paść jako „zamknięte bez raportu”.
4. Powiedz: „spójrz na ekran, co tu jest nie tak?” — pojawia się powiadomienie, potem opis.
5. Bez działającej bramki: zlecenie nadal rusza (dyspozytor na żądanie); odpowiedź to zaznacza.

## 7. Następne kroki (rekomendacja)

1. Zmierz opóźnienie `classic` + ElevenLabs względem Gemini Live na tych samych trzech zdaniach — decyzja o głosie na danych.
2. Gdy dokumentacja GPT-Live-1 potwierdzi polski i wejście obrazu, dopisać go jako provider.
3. Jeśli obraz ma być ciągły, dołożyć klatki natywne za przełącznikiem i osobnym powiadomieniem „patrzę na żywo”.
