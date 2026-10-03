export interface AiLesson {
  id: string
  title: string
  time: string
  intro: string
  sections: { title: string; body: string }[]
  example: string
  question: string
  answer: string
}

export const AI_LESSONS: readonly AiLesson[] = [
  {
    id: 'start',
    title: 'AI bez tajemnic',
    time: '3 min',
    intro: 'Czesiek pomaga myśleć i działać. Warto wiedzieć, skąd biorą się jego odpowiedzi.',
    sections: [
      {
        title: 'Model nie jest encyklopedią',
        body: 'Model językowy uczy się wzorców z danych. Na ich podstawie generuje kolejne fragmenty wypowiedzi. Może stworzyć przekonującą odpowiedź, która jest błędna. Ważne informacje sprawdzaj w źródłach.'
      },
      {
        title: 'Asystent a agent',
        body: 'Asystent odpowiada w rozmowie. Agent może dodatkowo używać narzędzi: odczytać plik, przeszukać internet lub przygotować dokument. Dostęp do narzędzia nie gwarantuje poprawnego wyniku — liczy się sprawdzenie wykonanej pracy.'
      },
      {
        title: 'Czesiek i współpracownicy',
        body: 'Czesiek przyjmuje polecenie i może przekazać wykonanie subagentowi. Role w zespole określają sposób pracy; nie są ludźmi ani oddzielnymi kontami usług. Postęp pochodzi z rzeczywistych działań silnika.'
      }
    ],
    example: '„Porównaj trzy oferty internetu. Podaj źródła, koszty i rzeczy, które trzeba jeszcze potwierdzić.”',
    question: 'Czy płynna odpowiedź oznacza, że model mówi prawdę?',
    answer: 'Nie. Sprawdź źródła, daty i obliczenia, szczególnie przed decyzją finansową lub publikacją.'
  },
  {
    id: 'prompts',
    title: 'Jak dobrze zlecać zadania',
    time: '4 min',
    intro: 'Dobre polecenie przypomina krótki brief dla współpracownika.',
    sections: [
      {
        title: 'Cel, kontekst, rezultat',
        body: 'Powiedz, co chcesz osiągnąć, dla kogo pracujesz i jaki wynik ma powstać. Dodaj materiały, ograniczenia i termin, jeśli są istotne.'
      },
      {
        title: 'Kryterium ukończenia',
        body: 'Zamiast „zrób marketing” napisz „przygotuj pięć propozycji postów, każdy do 500 znaków, z jednym wezwaniem do działania”. Dzięki temu łatwiej ocenić rezultat.'
      },
      {
        title: 'Doprecyzowanie',
        body: 'Przy złożonym zadaniu poproś najpierw o pytania i plan. Odpowiedz na brakujące szczegóły, a potem zatwierdź pracę. Przykładowe polecenia możesz przechowywać w swojej bazie promptów.'
      }
    ],
    example:
      '„Przygotuj szkic oferty dla małej restauracji. Użyj załączonego cennika, nie wymyślaj cen. Wynik: jedna strona do mojej akceptacji.”',
    question: 'Jakie trzy rzeczy warto umieścić w poleceniu?',
    answer: 'Cel, potrzebny kontekst i oczekiwany format wyniku. Pomagają też ograniczenia i kryteria odbioru.'
  },
  {
    id: 'models',
    title: 'Modele, API i głos',
    time: '4 min',
    intro: 'Model to silnik. Dostawca udostępnia go przez usługę, a API łączy ją z aplikacją.',
    sections: [
      {
        title: 'Dwa zastosowania',
        body: 'Model rozmowy Live obsługuje naturalną rozmowę głosową. Model pracy wykonuje zadania i wywołuje narzędzia. Mogą pochodzić od różnych dostawców. Wybór głosu nie zmienia uprawnień agenta.'
      },
      {
        title: 'Koszt i szybkość',
        body: 'Większy model nie zawsze jest najlepszy. Do prostego szkicu wystarczy szybki model, a trudna analiza może wymagać modelu rozumującego. Koszt zależy od cennika dostawcy, liczby tokenów, długości kontekstu i użytych narzędzi.'
      },
      {
        title: 'Klucz API',
        body: 'Klucz pozwala aplikacji korzystać z Twojego konta u dostawcy. Traktuj go jak hasło: nie wysyłaj w wiadomościach ani nie umieszczaj w repozytorium. Limity i rozliczenia sprawdzaj u dostawcy. Nazwy oraz dostępność modeli mogą się zmieniać.'
      }
    ],
    example:
      'Rozmawiasz przez Gemini Live, a analizę dokumentu zlecasz modelowi pracy. ElevenLabs może służyć do odczytu tekstu; to osobna funkcja od głosu Live.',
    question: 'Czy klucz API daje nielimitowane, bezpłatne użycie?',
    answer: 'Nie. Dostawca ustala limity, dostępne modele i ceny. Ustaw budżet na swoim koncie.'
  },
  {
    id: 'memory',
    title: 'Pamięć, kontekst i skille',
    time: '3 min',
    intro: 'Rozmowa, trwałe notatki i instrukcje pracy pełnią różne role.',
    sections: [
      {
        title: 'Kontekst',
        body: 'To informacje dostępne modelowi w danym momencie: instrukcje, fragmenty rozmowy i wyniki narzędzi. Okno kontekstu ma ograniczoną pojemność. Długie rozmowy mogą być podsumowywane.'
      },
      {
        title: 'Pamięć',
        body: 'Trwałe notatki pomagają wracać do preferencji i projektów. Mapa wiedzy pokazuje powiązania między notatkami. Pamięć warto przeglądać i poprawiać; nie każda wypowiedź staje się automatycznie trwałą wiedzą.'
      },
      {
        title: 'Skill',
        body: 'Skill to instrukcja wykonania konkretnej pracy, często z przykładami lub plikami pomocniczymi. Możesz stworzyć własny albo wkleić tekst z katalogu. Przeczytaj go przed włączeniem: instrukcja może wymagać dodatkowych narzędzi i uprawnień.'
      }
    ],
    example:
      'Zapisz preferencję „oferty pisz prostym językiem”, a w skillu określ strukturę oferty i sposób sprawdzania ceny.',
    question: 'Czy dodanie skilla instaluje wszystkie integracje, których potrzebuje?',
    answer: 'Nie. Skill opisuje sposób pracy. Wymagane usługi i narzędzia muszą być dostępne osobno.'
  },
  {
    id: 'integrations',
    title: 'Integracje i automatyzacje',
    time: '4 min',
    intro: 'Połączenie z usługą pozwala użyć jej danych i funkcji w zadaniu.',
    sections: [
      {
        title: 'OAuth i zakres dostępu',
        body: 'OAuth pozwala upoważnić aplikację bez przekazywania jej hasła. Ekran logowania pokazuje zakres dostępu. Gmail, Kalendarz i Dysk mają różne uprawnienia — połączenie jednej usługi nie dowodzi działania pozostałych.'
      },
      {
        title: 'MCP',
        body: 'MCP jest standardem udostępniania narzędzi i danych modelom. Serwer MCP może łączyć agenta z usługą. Instaluj tylko zaufane serwery i sprawdzaj, jakie działania umożliwiają.'
      },
      {
        title: 'Wyzwalacz i harmonogram',
        body: 'Automatyzacja wykonuje określoną pracę po zdarzeniu lub o wybranej porze. Zacznij od działań odczytu i szkiców. Przed wysyłką, publikacją lub zmianą danych ustal reguły zgody.'
      }
    ],
    example:
      'Codziennie rano przygotuj szkic raportu: dzisiejsze spotkania, ważne wiadomości i zadania. Raport nie powinien sam wysyłać odpowiedzi do klientów.',
    question: 'Czy informacja „połączono Google” oznacza, że działają wszystkie usługi Google?',
    answer: 'Nie. Sprawdź osobno Gmail, Kalendarz i Dysk oraz ich zakresy dostępu.'
  },
  {
    id: 'safety',
    title: 'Bezpieczna praca z agentem',
    time: '3 min',
    intro: 'Delegowanie działa najlepiej, gdy wiadomo, co agent może zrobić sam.',
    sections: [
      {
        title: 'Granice działania',
        body: 'Odczyt i przygotowanie szkicu zwykle mają mniejsze skutki niż publikacja, wysyłka lub usuwanie danych. Sprawdzaj reguły zgody i uprawnienia integracji. Rola „sprzedaż” sama nie nadaje dostępu do CRM.'
      },
      {
        title: 'Treści z internetu',
        body: 'Strona lub załącznik może zawierać polecenia próbujące sterować agentem. To dane do analizy, a nie Twoje instrukcje. Nie pozwalaj, aby obca treść nakazywała ujawnienie kluczy lub zmianę zasad pracy.'
      },
      {
        title: 'Sprawdź wynik',
        body: 'Przed ważną decyzją sprawdź plik, źródła i zakres wykonanej pracy. Komunikat o ukończeniu nie zastępuje odbioru rezultatu. Jeśli coś nie działa, zacznij od panelu diagnostyki w Ustawieniach.'
      }
    ],
    example: '„Przygotuj odpowiedzi na maile, ale niczego nie wysyłaj. Pokaż mi odbiorców i treść do zatwierdzenia.”',
    question: 'Czy avatar lub osobowość agenta zmienia zakres jego uprawnień?',
    answer: 'Nie. Uprawnienia wynikają z konfiguracji silnika, narzędzi i usług, a nie z wyglądu roli.'
  }
]

export const AI_GLOSSARY = [
  ['Token', 'Fragment tekstu przetwarzany przez model. Tokeny wpływają na długość kontekstu i koszt.'],
  ['LLM', 'Duży model językowy generujący i analizujący tekst.'],
  ['Prompt', 'Polecenie i kontekst przekazane modelowi.'],
  ['API', 'Interfejs, przez który aplikacje korzystają z usług innych systemów.'],
  ['Halucynacja', 'Przekonująco brzmiąca, lecz błędna lub zmyślona odpowiedź modelu.'],
  ['RAG', 'Dostarczanie modelowi wyszukanych fragmentów dokumentów, aby odpowiedział na ich podstawie.'],
  ['Subagent', 'Agent wykonujący wydzielone zadanie dla koordynatora.'],
  ['MCP', 'Standard łączenia aplikacji AI z narzędziami i źródłami danych.'],
  ['OAuth', 'Sposób udzielania aplikacji dostępu do konta bez przekazywania hasła.'],
  ['Multimodalność', 'Obsługa kilku rodzajów danych, np. tekstu, obrazu i dźwięku.'],
  ['Webhook', 'Powiadomienie między systemami, które może uruchomić pracę po zdarzeniu.'],
  ['Skill', 'Instrukcja i materiały pomagające agentowi wykonać określony typ pracy.']
] as const
