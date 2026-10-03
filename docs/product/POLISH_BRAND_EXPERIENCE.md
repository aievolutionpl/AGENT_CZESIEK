# Agent Czesiek — interfejs i integracje, 3 października 2026

## Zmiany

- Nowe tła jasne i ciemne, przejrzyste panele, czytelniejszy podpis AI Evolution Polska oraz nagłówki ustawień. Ograniczenie animacji i przezroczystości respektuje preferencje systemowe.
- Polskie opisy ustawień komputera, wyglądu, zespołów modeli, limitów procesów, umiejętności oraz odinstalowania. Domyślny profil ma czytelną nazwę „Profil główny”.
- Integracje mają nową ilustrację, ikony o lepszym kontraście, odświeżanie statusu oraz komunikaty błędu i braku wyników. „Skonfigurowano” oznacza zapisane dane, a nie potwierdzenie udanego połączenia z API.
- Synchronizacja dokumentów Google Drive jest przypisana do połączenia i profilu. Przełączenie kontekstu zatrzymuje kolejne kroki starej synchronizacji; jej wynik nie zastępuje danych nowego profilu.
- Wybór modelu pracy umożliwia przeszukanie całego katalogu dostawcy. Propozycje do kodowania, analizy i złożonych zadań pojawiają się wyłącznie, gdy dany model jest w katalogu podłączonego dostawcy. Nie zmieniamy samoczynnie aktywnego modelu ani modelu głosowego.
- Błąd odinstalowania pozostaje widoczny po zamknięciu potwierdzenia. Testy nie odinstalowują aplikacji.

## Modele do pracy

Publiczny katalog OpenRouter sprawdzony 3 października 2026: `openai/gpt-6.1-sol`, `anthropic/claude-sonnet-5.5`, `anthropic/claude-opus-5.5`, `google/gemini-3.8-flash`, `openai/gpt-6-luna`. To propozycje zastosowania, nie ranking jakości. Dostępność i koszty zależą od konta dostawcy. Lista w aplikacji pozostaje oparta na rzeczywistym katalogu backendu.

## Weryfikacja i granice

364 testy Vitest obejmują zmienione ekrany, języki i integracje. 20 testów Electron sprawdza nawigację, skalowanie okna, pływającą kulę, ustawienia, zapis pamięci przez prawdziwy backend oraz respektowanie ograniczenia animacji. TypeScript, lint i build są sprawdzane osobno. Zrzuty zostały obejrzane po wygenerowaniu; brak wzorca obrazkowego nie jest automatycznym testem zgodności wizualnej.

Testy korzystają z izolowanego profilu i dostawcy testowego. Nie potwierdzają rozmowy z płatnym API, uprawnień mikrofonu użytkownika, autoryzacji jego kont Google ani instalacji na czystym Windows. Ta aktualizacja kodu nie jest publikacją podpisanego instalatora. Gotowość wydania nadal wymaga bramek z [RELEASE_PIPELINE.md](RELEASE_PIPELINE.md).

Grafiki utworzono wbudowanym imagegen; [prompty i ścieżki zasobów](UI_ASSET_PROMPTS_2026_10.md). Istniejące logo i wcześniejsze zasoby pozostają zachowane.
