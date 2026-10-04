# Mapa repozytorium Agent Czesiek

## Workspace, biuro agentów i nauka AI

- Liquid Glass: `apps/desktop/src/app/jarvis/liquid-glass.css` (tapeta całego okna i materiały), `src/store/interface-material.ts` (lokalny wybór stylu), `app/settings/interface-material.tsx` (przełącznik w Wygląd). Domyślnie Liquid Glass; nie zmienia natywnej przezroczystości okna ani uprawnień agenta.

- Nawigacja: `apps/desktop/src/app/jarvis/navigation.tsx`; nazwa Workspace zachowuje dotychczasową trasę `/`.
- Biuro: `app/agents/presets.ts` (gotowe role), `preset-list.tsx` (działy i zadania), `preset-editor.tsx` (własne role), `character-avatar.tsx` + `office-team.css` (atlas i ruch). Zapis nadal przez `preset-store.ts` z CAS; uruchomienie przez `launch-preset.ts` w nowej rozmowie.
- Edukacja: `apps/desktop/src/app/learn/lessons.ts` (treść), `index.tsx` (lekcje i słownik), trasa `/learn` w `app/routes.ts` i `app/contrib/surfaces.tsx`.
- Profil współpracy: `app/settings/personal-profile.tsx`; zapis `display.czesiek_profile` i bloku osobowości w `custom_prompt` do przypiętego połączenia/profilu. Onboarding zapisuje ten sam obiekt. Nowe instrukcje obowiązują od nowej rozmowy.
- Screenshoty README: `apps/desktop/e2e/office-learning.spec.ts`; opcjonalne `CZESIEK_CAPTURE_README=1` zapisuje prawdziwe zrzuty Electron do `docs/assets/czesiek/`. Test używa izolowanego profilu i backendu testowego, bez prywatnych kluczy.

Zacznij od tej strony. Wybierz obszar z tabeli, przeczytaj jego `AGENTS.md` i
dopiero wtedy szukaj symbolu w tym katalogu (`rg -n 'nazwa' <katalog>`). Nie
ładuj całego repo, całej dokumentacji ani wszystkich testów na starcie.
Główne [AGENTS.md](../AGENTS.md) zawiera zasady wspólne, a
[AGENT_SETUP.md](AGENT_SETUP.md) — uruchomienie i kontrole.

| Zmiana dotyczy | Punkt wejścia | Instrukcje obszaru |
| --- | --- | --- |
| Okno desktopowe, onboarding, orb, menu, ustawienia | `apps/desktop/src/app/`, `apps/desktop/src/plugins/`, `apps/desktop/electron/` | [`apps/desktop/AGENTS.md`](../apps/desktop/AGENTS.md), [`apps/desktop/src/AGENTS.md`](../apps/desktop/src/AGENTS.md) |
| Transport desktop ↔ backend | `apps/shared/`, `tui_gateway/` | [`tui_gateway/AGENTS.md`](../tui_gateway/AGENTS.md) |
| Rozmowa, model, pamięć i pętla agenta | `run_agent.py`, `agent/` | [`agent/AGENTS.md`](../agent/AGENTS.md) |
| Narzędzia, przeglądarka, delegowanie | `model_tools.py`, `toolsets.py`, `tools/` | [`tools/AGENTS.md`](../tools/AGENTS.md) |
| Konfiguracja, profile, komendy CLI | `cli.py`, `hermes_cli/` | [`hermes_cli/AGENTS.md`](../hermes_cli/AGENTS.md) |
| Komunikatory i gateway | `gateway/`, `gateway/platforms/` | [`gateway/AGENTS.md`](../gateway/AGENTS.md) |
| Zadania cykliczne | `cron/` | [`cron/AGENTS.md`](../cron/AGENTS.md) |
| Rozszerzenia i umiejętności | `plugins/`, `skills/` | [`plugins/AGENTS.md`](../plugins/AGENTS.md), [`skills/AGENTS.md`](../skills/AGENTS.md) |
| Panel webowy | `web/`, `hermes_cli/web_routers/` | [`web/AGENTS.md`](../web/AGENTS.md) |
| Strona sprzedażowa Cześka | `sales-site/dist/` | [`sales-site/README.md`](../sales-site/README.md); osobna statyczna strona, bez zmian w aplikacji |
| Testy i pipeline | `tests/`, `tests-js/`, `.github/workflows/`, `scripts/` | [testowanie w głównym AGENTS](../AGENTS.md#testing-applies-everywhere) |

Najkrótsza ścieżka zmiany: znajdź właściciela zachowania w tabeli → przeczytaj
lokalne instrukcje → odtwórz błąd → zmień najmniejszy właściwy moduł → uruchom
testy tego obszaru. Testy Pythona uruchamiaj **wyłącznie** przez
`scripts/run_tests.sh`; dla desktopu użyj skryptów z `apps/desktop/package.json`.
Nie zmieniaj identyfikatorów instalacji, protokołu i profili tylko po to, by
usunąć starszą nazwę — mogą być potrzebne do zgodności z aktualizacjami.

### Stabilizacja pulpitu i pamięci — październik 2026

- `apps/desktop/src/hooks/use-active-capability-scope.ts` przypina zapytania i cache
  pamięci, statusów integracji i uprawnień do pary połączenie/profil. Nie zastępuj
  kluczy zawierających `scopeKey` wspólnym kluczem dla wszystkich maszyn.
- `app/starmap/vault-view.tsx`: zapis bez wyścigów, odzyskiwanie po błędzie,
  potwierdzenie niezapisanych zmian i edytor dostosowany do szerokości okna.
- `hermes_cli/web_routers/vault.py`: model tworzenia notatki musi przekazywać
  `external_source`; brak tego pola powodował HTTP 500 dla każdego tworzenia.
  Test pełnej ścieżki HTTP → plik → odczyt: `tests/hermes_cli/test_web_vault.py`.
- `electron/vault-seed.ts` respektuje lokalizację pamięci z procesu lub `.env`
  profilu; szablon, protokół i odczyt backendu muszą wskazywać to samo miejsce.
- Test Electron `e2e/jarvis-shell-vertical.spec.ts` sprawdza nawigację, kulę na
  pulpicie i zapis pamięci; fixture ustawia własny `OBSIDIAN_VAULT_PATH` w temp.
- Raport weryfikacji i ograniczenia: [PRODUCT_POLISH_2026_10.md](product/PRODUCT_POLISH_2026_10.md).

Wydanie jest osobnym etapem: [pipeline](product/RELEASE_PIPELINE.md),
[podpisywanie](RELEASE_SIGNING.md) i bramka
`apps/desktop/scripts/verify-release-gate.mjs`. Zielony test lokalny ani scalony
PR nie potwierdzają podpisanego instalatora. Kod Hermes ma warunki [MIT](../LICENSE),
a autorskie zasoby marki mają [osobne warunki](../CZESIEK-ASSETS-LICENSE.md).
Sekrety i dane profilu pozostają poza repozytorium.

## Własne skille, role i orb

- Muzyka powitalna: `apps/desktop/src/lib/jarvis-intro-music.ts` (jednorazowy start, odtwarzacz i fraza „tatuś wrócił”), `app/contrib/wiring.tsx` (start tylko w głównym oknie), `app/chat/composer/hooks/use-realtime-conversation.ts` i `use-composer-voice.ts` (transkrypcja użytkownika). Poziom mikrofonu nie uruchamia muzyki.

- Wygląd i polskie ustawienia: `apps/desktop/src/app/jarvis/glass.css`, `src/i18n/{pl,en,types}.ts`. Tła: `src/assets/backgrounds/czesiek-glass-*.webp`.
- Modele pracy: `apps/desktop/src/app/jarvis/work-models.ts` i `model-switcher-options.ts` (propozycje filtrowane katalogiem, wyszukiwanie).
- Integracje i pamięć Dysku: `apps/desktop/src/app/connections/`; `drive-memory-panel.tsx` przypina żądania i cache do połączenia/profilu. Opis zakresu: [POLISH_BRAND_EXPERIENCE.md](product/POLISH_BRAND_EXPERIENCE.md).

- Import z tekstu i kreator: `apps/desktop/src/app/skills/skill-create.tsx`;
  walidacja/podgląd: `skill-draft.ts`; zapis: `src/api/skills.ts` →
  `hermes_cli/web_routers/skills.py` → istniejący `tools/skill_manager_tool.py`.
  Profil jest częścią routingu żądania; test integracyjny:
  `tests/hermes_cli/test_web_server_skill_editor.py`.
- Role asystenta: `apps/desktop/src/app/agents/presets.ts`, `preset-store.ts`
  (zapis CAS), `launch-preset.ts` (przygotowanie nowego zadania).
- Kolor i ruch orba: `apps/desktop/src/app/jarvis/plasma.ts`,
  `plasma-palette.ts`, `particle-orb.ts`; podpis pływającej kuli:
  `src/app/pet-overlay/orb-overlay.tsx`.

Instrukcja użytkownika: [własne umiejętności i role](SKILLS_AND_ASSISTANT.md).


### Windows: silnik w instalatorze i wybór współpracownika

- `apps/desktop/electron/runtime-collaborator.ts`: wykrywanie gotowego środowiska i zapis wyboru; własny profil Cześka pozostaje oddzielny.
- `apps/desktop/src/components/collaborator-picker.tsx`: automatyczne wykrywanie i ręczny wybór folderu w pierwszym uruchomieniu.

- `apps/desktop/electron/bundled-runtime.ts`: wybór dołączonego silnika przed starym bootstrapem.
- `apps/desktop/scripts/stage-windows-runtime.mjs`: pakowanie kodu, Pythona, zależności, Git i Node.
- `apps/desktop/scripts/before-pack.mjs`: zgodność commita i architektury pakietu.
- `docs/CZESIEK_INSTALLATION.md`: instrukcja budowania i granice działania offline.

### macOS: DMG i wbudowany silnik
- `scripts/build-macos-installer.sh`: jedna komenda → DMG/ZIP; `apps/desktop/scripts/stage-macos-runtime.mjs` składa `build/runtime` (odpowiednik wersji Windows).
- `apps/desktop/electron/bundled-runtime.ts`: na darwin używa runtime tylko gdy jest `manifest.json`, inaczej bootstrap online; `before-pack.mjs` pilnuje commita i architektury.
- `scripts/install-obsidian.sh` + `installObsidianOnMac` w `electron/main.ts`: Obsidian w tle przy pierwszym starcie.


## Diagnostyka, współpraca i odzyskiwanie

- `apps/desktop/src/app/settings/assistant-health.tsx`: panel „Czy wszystko działa?”, testy API/audio bez ujawniania sekretów; `health-error.ts` tłumaczy błędy.
- `apps/desktop/src/app/chat/composer/hooks/use-realtime-conversation.ts`: szybkie przyjęcie zlecenia głosowego, sterowanie podagentami i raporty; `status-stack/work-results.tsx` zachowuje wyniki po zakończeniu.
- `apps/desktop/electron/update-recovery.ts`: kopia aplikacji i danych, przywracanie z zachowaniem obecnej wersji; `recovery-controller.ts` zatrzymuje backend i blokuje równoległy start podczas kopii.
- `apps/desktop/src/app/settings/recovery-settings.tsx`: wspólny panel kopii w ustawieniach i przy błędzie startu.
- `apps/desktop/scripts/prepare-clean-windows-test.ps1`: przygotowanie testu w Windows Sandbox. Samo przygotowanie nie jest potwierdzeniem instalacji.

### Rozmowa Live i pulpit
- `apps/desktop/src/app/jarvis/live-model-picker.tsx`: osobny wybór modelu głosu, zapis przypięty do połączenia i profilu; model wykonawczy pozostaje bez zmian.
- `apps/desktop/src/app/jarvis/use-live-autostart.ts`: start rozmowy po konfiguracji, raz na profil/połączenie podczas uruchomienia aplikacji; wymaga dostępnego klucza i zgody na mikrofon.
- `apps/desktop/src/app/jarvis/home-hero.tsx`: orb, przyciski rozmowy i propozycje zadań.
- Starszy współpracownik bez adaptera Live jest pomijany; aplikacja korzysta z dołączonego silnika. `scripts/smoke-bundled-runtime.mjs` sprawdza także status Live i brak klucza (400 zamiast 405).

### Pamięć w vaulcie Obsidiana, głos i kursor
- `agent/vault_notes.py` + `hermes_cli/web_routers/vault.py` (`/api/vault/*`): notatki markdown vaultu (`OBSIDIAN_VAULT_PATH`, domyślnie `~/Documents/Czesiek Vault`) jako graf — węzły to notatki, krawędzie to `[[wikilinki]]`; odczyt, zapis, tworzenie, usuwanie do `.trash`. Ścieżki spoza vaultu są odrzucane. Test: `tests/agent/test_vault_notes.py`.
- `apps/desktop/src/app/starmap/vault-view.tsx` (widok + edytor notatki), `vault-graph.tsx` (graf sił na canvasie), `src/api/vault.ts`: domyślna zakładka „Mapa wiedzy”; obok stare zakładki Umiejętności i Pamięć (graf nauczonych umiejętności).
- `apps/desktop/src/app/jarvis/voice-aura.tsx`: pierścień widma głosu wokół orba, napędzany realnym `$micLevel`; dok głosu (`voice-controls.tsx`) to tylko cztery minimalne przyciski.
- `tools/browser_cursor_overlay.py`: kursor agenta w oknie przeglądarki (gradientowa strzałka z plakietką „Czesiek”, halo, ogon, fala przy kliknięciu); natywny kursor sterownika komputera: `tools/computer_use/cursor_overlay.py`.

### Aktualizacje: skąd aplikacja wie o nowej wersji
- `hermes_cli/distribution.py` (silnik) i `apps/desktop/electron/distribution.ts` (aplikacja): **jedyne** miejsca, które nazywają oficjalne repozytorium tej dystrybucji (`aievolutionpl/AGENT_CZESIEK`). Sprawdzanie aktualizacji, wykrywanie forka, pobieranie ZIP i linki do wydań z nich wynikają. Nie wpisuj adresu repo nigdzie indziej; dla lustra ustaw `HERMES_DISTRIBUTION_REPO=owner/name`.
- Zainstalowana aplikacja nie ma checkoutu gita, więc „Sprawdź aktualizacje” w Ustawieniach → O aplikacji (`settings/release-update-card.tsx`) czyta ostatnie Wydanie z GitHuba (`electron/release-check.ts`, kanał `hermes:updates:release-check`), porównuje wersje i otwiera instalator dla tego systemu. 404 = repozytorium prywatne albo brak wydania; aplikacja mówi to wprost. Samo wydanie nadal buduje i podpisuje [pipeline](product/RELEASE_PIPELINE.md).
- `scripts/upstream_watch.py` + `.github/workflows/upstream-watch.yml` (co poniedziałek): lista zmian w upstream Hermes od ostatniego przeglądu, pogrupowana po obszarach, z plikami zmienionymi po obu stronach (tam będą konflikty). Historia gita forka jest niezależna od upstreamu, więc punkt startu zapisuje `docs/upstream/WATCH.json` (SHA po pierwszym przeglądzie: `python scripts/upstream_watch.py --mark-reviewed <sha>`). Wynik trafia do jednego issue z etykietą `upstream-watch`; nic nie jest scalane automatycznie.

### Kula na pulpicie, dźwięki i wygląd
- `apps/desktop/src/app/pet-overlay/orb-overlay.tsx` + `orb-overlay.css`: kula na pulpicie (okno przezroczyste). Rozmiar to jedna liczba (`--orb-scale`, 0.5–1.6): kółko myszy nad kulą, uchwyt na jej krawędzi albo przyciski −/+. Rozmiar zmienia się wokół środka, kula nie ucieka poza ekran i po puszczeniu przy krawędzi „przykleja się” do niej. Reguły (skala, środek, kotwiczenie, przyciąganie): `app/jarvis/desktop-orb-geometry.ts`; zapis rozmiaru: `desktop-orb-state.ts` (`czesiek.orb-scale.v1`, wspólny dla obu okien).
- `apps/desktop/src/lib/ui-sound.ts`: ciche dźwięki interfejsu (WebAudio, bez plików). Podpięte pod istniejące `triggerHaptic(intent)`, więc dźwięk dostaje każde miejsce, które już oznaczało świadome kliknięcie; przycisk wyciszenia na pasku tytułu wycisza też je, a Ustawienia → Wygląd → „Dźwięki interfejsu” wyłącza tylko dźwięki. Strumieniowanie ma własne dźwięki, więc jest pominięte.
- Kolory: `--czesiek-grad` i `--czesiek-glow` w `app/jarvis/glass.css` to jeden gradient marki (przycisk główny, znacznik aktywnej pozycji menu, logotyp).

### Połączenia: Google, role, przeglądarka
- Google bez ręcznej konfiguracji przez agenta: `agent/google_connect.py` + `hermes_cli/web_routers/google_connect.py` (`/api/google/*`) prowadzą istniejący skill `google-workspace` (status z plików, zapis pliku klienta OAuth, dwa kroki logowania, prawdziwy test odczytu kalendarza i poczty). Kreator: `apps/desktop/src/app/connections/google-connect-dialog.tsx` (wznawia od ostatniego kroku). Własna aplikacja OAuth marki (logowanie jednym kliknięciem) wymaga weryfikacji Google i nie jest zrobiona.
- Stan połączeń (`agent/connection_status.py`, `/api/connections/status`): tylko obecność plików i poświadczeń, bez sieci i bez wartości; co nieznane, to `unknown` (bez plakietki). Używają go plakietki na stronie Integracje i karta „Połącz więcej” w panelu bocznym (`jarvis/rail-connect-card.tsx`, `suggestConnections`).
- Onboarding: wybór roli (`connections-catalog.ts`: `JARVIS_ROLE_CONNECTIONS`, `selectionForRole`) zaznacza polecane narzędzia; każdy wybór można zmienić.
- Raport dnia dostaje sekcję Google (dzisiejsze spotkania i nieprzeczytane maile) z `/api/briefing`, gdy Google jest połączony; treść maili idzie do modelu jako dane, nie polecenia.
- Ustawienia → Narzędzia → Przeglądarka: „Zablokowane strony” (`settings/browser-sites-panel.tsx`) edytuje `security.website_blocklist`, które backend egzekwuje przy nawigacji przeglądarki i w narzędziach sieciowych. Pytanie „czy wejść na tę stronę” przed wizytą nie istnieje.

## Browser modes (agent's browser + Google login)

- `agent/browser_modes.py` — status / `set_mode` (`managed` | `own` | `copy`) / `open_sign_in` / `import_now` / `clear_*`. Reuses `hermes_cli/browser_connect.py` (own `chrome-debug` profile, real-profile snapshot). Login check reads cookie **names/hosts only** from a temp copy; values are never returned.
- `hermes_cli/web_routers/browser.py` — `/api/browser/*`. Desktop: `src/api/browser.ts`, `src/app/settings/browser-modes-panel.tsx` (Skills → Browser). Tests: `tests/agent/test_browser_modes.py`.
- Driving the live default profile is intentionally not offered (Chrome ≥136 blocks CDP on it); `copy` is the supported cookie import.

## Integrations that pay off at once

- **Raport dnia** — `hermes_cli/web_routers/briefing.py` adds open kanban tasks (`summarize_tasks`) next to Google mail/calendar, news, sessions and jobs; the prompt lives in `apps/desktop/src/app/jarvis/briefing.ts`.
- **Dysk → pamięć** — `agent/drive_memory.py` (folders → `Drive/<folder>/*.md` notes in the vault, link to source, incremental by `modifiedTime`, `STEP_LIMIT` files per call), router `web_routers/drive_memory.py`, UI `src/app/connections/drive-memory-panel.tsx` (shown on the connected Google card).
- **Sklep MCP** — already present: `src/app/skills/mcp-tab.tsx` + `/api/mcp/catalog`.
- **Polski kontekst** — `optional-skills/finance/fakturownia` (read-only, API not yet run against a live account).

## Security foundation (untrusted content, secrets)

- `agent/external_content.py` — `fence()` wraps text written by others in `<external-data source="…">` (tags inside are neutralised). Used by `vault_notes.create_note(external_source=…)` (news saved from the rail), `agent/drive_memory.py`; `read_note` reports `external`. The agent's standing rule is the second block in `AGENTS.md` (`electron/vault-seed.ts`, `AGENTS_EXTERNAL_MARKER`), appended to existing installs too.
- `agent/secret_audit.py` + `web_routers/secrets_audit.py` — presence-only audit of credential files/folders and one-click owner-only permissions; UI `connections/secrets-audit-card.tsx` (Keys tab). OS keychain storage is not implemented yet.

## Premium UI pass (dashboard rail, composer, pages)

- `apps/desktop/src/components/model-brand-icon.tsx` — `ModelBrandIcon` / `resolveModelBrand`: one maker mark per model (simple-icons where they exist, drawn glyphs for GPT, DeepSeek, Hermes, free); used by the model card, the live-voice picker and preset rows.
- `src/app/jarvis/glass.css` (bottom sections) — gradient-hairline `.jarvis-panel`, `.jarvis-icon-chip`, `.model-brand-tile`, `.jarvis-choice`, `.jarvis-segment`, `.jarvis-menu`, `.jarvis-rise` entrance animation; composer glass controls `.jarvis-ctl*` (classes set in `chat/composer/control-classes.ts`); list/detail surfaces `.jarvis-page-list|detail` and `.jarvis-row` (set in `master-detail.tsx`, `overlays/panel.tsx`). All motion respects `prefers-reduced-motion`.

## Tips and first-run experience

- `apps/desktop/src/app/jarvis/setup-progress.ts` + `rail-start-card.tsx` — "Zacznij tutaj" card at the top of the dashboard rail: progress from real state (model, Google, vault, browser login, first task, daily report), hides itself when done or dismissed.
- `playbook-extras.ts` + `tips.tsx` — connection-aware tips ("with what you have connected": mail/calendar need Google, file search needs the vault, the "Tatuś wrócił" voice tip) shown above the regular playbook; the launcher asks what is connected each time the window opens.
- Onboarding wizard (`onboarding.tsx`, `onboarding-welcome.tsx`): glass panel, gradient step markers and progress bar, per-step entrance animation.

## Trust levels and the action log

- `agent/integration_trust.py` — four levels per integration (`read` | `propose` | `ask` | `auto`, config `approvals.integrations.<id>`, default `ask`), `classify_command` (which `google_api.py` calls *write*, with a recipient/subject preview, never the body), and the decision log `HERMES_HOME/integration_actions.jsonl` (`read_log`).
- `tools/approval_integrations.py` — the gate hooks: `integration_block` is part of `_user_deny_block` (same floor as `approvals.deny`: not bypassable by yolo/mode off), `integration_ask` forces the human prompt at level `ask` even under yolo and skips the guardian model, `record_outcome` writes the log. Unattended contexts (cron) fail closed at `ask`.
- `web_routers/trust.py` (`/api/trust`), desktop `connections/trust-card.tsx` (Połączenia tab). Only Google writes are classified today.

## News ticker fairness

- `web_routers/news.py`: `cap_per_source` (no source over 8 of a page while others have items, backfilled on quiet days; also used by the briefing) and same-host feeds fetched one after another with a 1.5 s gap (issue #24).

## ChatGPT subscription and model logos in setup

- `apps/desktop/src/app/jarvis/chatgpt-connect.ts` (+ `chatgpt-quick-connect.tsx`) — "Sign in with ChatGPT": the engine's existing `openai-codex` device-code login (`/api/providers/oauth/openai-codex/*`) driven from the wizard's engine step and the rail's model card; `chatGptWorkModel` picks the newest GPT the subscription lists (`gpt-6` first). OpenRouter (DeepSeek) stays as the alternative.
- Model cards with maker logos: wizard model step (`quickModels`), provider cards, rail model card (ChatGPT row). Logos: `components/model-brand-icon.tsx`.

## Voice: work board and eyes (research: `docs/product/VOICE_RESEARCH.md`)

- `hermes_cli/kanban_voice_desk.py` — the kanban board as the voice agent's ledger: `dispatch` (job for a profile, idempotent for 2 min, tagged `created_by: voice`), `digest` / `render_digest` (what needs the user, what runs, what finished), `report`, `steer`, `cancel`, `nudge` (one dispatcher tick on demand: the embedded dispatcher only lives in the gateway), `dispatcher_state`. `verdict_for` is the one place that decides where a task really stands (`done` only with a report, else `done_unreported`; `stalled` after 15 min of silence). Worker text is fenced with `agent/external_content.fence`.
- `hermes_cli/web_routers/voice_desk.py` — `/api/voice/desk*` over the above, plus `/api/voice/vision` (`agent/screen_vision.py`: a screenshot in, a fenced description out). Every answer carries `text`, the wording the voice model gets.
- `hermes_cli/web_routers/voice_realtime.py` — the tool declarations (`voice_tools(screen)`: `ask_jarvis`, `delegate_to_hermes`, `assign_work`, `work_status`, `steer_work`, `+look_at_screen` only for `POST /session?screen=true` and `voice.vision.enabled`) and the instruction blocks `_DESK_INSTRUCTIONS` / `_VISION_INSTRUCTIONS`.
- `apps/desktop/src/lib/live-voice/tools.ts` — the one runner both providers call (`runVoiceTool`); `desk-tools.ts` (`createDeskTools`: board tools + the look, with the on-screen notice before the capture); `desk-watcher.ts` (`diffDesk` / `startDeskWatcher`: polls the board every 8 s and pushes reports for this conversation's tasks, first read is baseline only); `src/api/voice-desk.ts`; `src/lib/screen-capture.ts`. Hook wiring: `app/chat/composer/hooks/use-realtime-conversation.ts`.
- `apps/desktop/electron/screen-capture.ts` — `hermes:captureScreen` (primary display, ≤1600 px JPEG, macOS permission reported as `denied`), exposed as `hermesDesktop.captureScreen`.

## Dashboard right rail: board, fold, stats, news

- `app/jarvis/rail-layout.ts` — `$railLayout` (order + hidden cards, persisted `czesiek:rail-layout:v1`), `normalizeRailLayout` (a new card slots in after its default predecessor), `applyVisibleOrder`, `moveRailCard`; `$railHidden` remembers the whole rail folded away.
- `rail-board.tsx` — `RailBoard` (dnd-kit sortable over `chat/sidebar/reorderable-list.tsx`; drag from a card header, Space/arrows on the grip; hidden cards are not mounted) and `RailCustomizeMenu` (show/hide, move up/down, reset). `rail-card.tsx` — `RailCard` (animated fold, content unmounted after the fold; grip via `RailSlotContext`); `rail-copy.ts` — pl/en words and screen-reader announcements.
- `insights-stats.ts` + `insights-card.tsx` — stats card with metric (sessions/tokens/cost) and range (7/14/30 d) choice persisted, change vs the equal window before, scrubbable chart, top model/tool/skill. `news-read.ts` + `rail-news-card.tsx` — read/unread tracking, mark-all, "Brief me".

## Voice screen: simple controls and the model switcher

- `app/jarvis/voice-controls.tsx` — the dock is two buttons: mute the assistant's voice (`store/voice-output.ts` `$speakerMuted`; Live sessions mute their own audio through `setSpeakerMuted`, reset when the conversation ends) and start/end the conversation. Home shows no status pills; the hero no longer repeats the end-conversation chip.
- `app/jarvis/dashboard.tsx` `HomeTopBar` — "Workspace" on the left; the `switcher` slot and one "more" menu (daily report, tips, focus mode, desktop orb) on the right.
- `app/jarvis/model-switcher.tsx` (+ `model-switcher-options.ts`, `live-model-choice.ts`) — two pills with maker icons: the Hermes model (flagship models of each usable provider, through `onSelectModel`) and the Live voice model (`useLiveVoiceModel`, same config write as the rail picker).

## Voice: voices, preview, bottom dock, fast default

- Defaults: male voices (`voice.realtime.voice: cedar`, Gemini `Puck`); `agent.reasoning_effort: low` (the rail's "Szybki" mode; the desktop falls back to it too).
- `app/jarvis/live-voices.ts` — voices per provider (male first, character and feel); `app/settings/live-voice-picker.tsx` — the Voice settings picker with a play button per voice (replaces the two plain dropdowns; `voiceFieldVisible` hides them). Preview: `POST /api/voice/realtime/preview` (`voice_realtime.py`: OpenAI `audio/speech` or Gemini TTS, returned as a base64 WAV).
- Home while live is only the orb; the dock (mic switch, voice mute, end) sits at the bottom (`dashboard.tsx`, `voice-controls.tsx`).

## Voice screen: orb, mini wave, side controls

- The spectrum ring round the orb is gone (`voice-aura.tsx` removed). `app/jarvis/voice-wave.tsx` (`VoiceWave`, `waveTargets`) draws a small wave under the orb from the real audio level; used by the home hero and the conversation header.
- While live, home shows only orb, wave and dock; everything else sits at the sides of `HomeTopBar`: left-panel toggle + "Workspace" on the left; model pills, "more" and a right-panel toggle on the right. The task-model label no longer says "Hermes".

## Uproszczony pulpit, głos i Google (październik 2026)

Wyniki testów i granice odbioru: [CLEAR_DESKTOP_VALIDATION.md](product/CLEAR_DESKTOP_VALIDATION.md).

- Menu: "apps/desktop/src/app/jarvis/navigation.tsx"; panel: "dashboard.tsx", stan trwały: "rail-layout.ts"; orb: "home-hero.tsx", "core.tsx".
- Ustawienia głosu: "apps/desktop/src/app/settings/config-settings.tsx", "live-voice-picker.tsx", "elevenlabs-voice-picker.tsx". Jeden odtwarzacz i ochrona późnych odpowiedzi: "use-voice-preview.ts".
- ElevenLabs: "src/api/elevenlabs.ts" → "hermes_cli/web_routers/audio.py"; klucze tylko w backendzie, profilowe.
- Google: "src/app/connections/google-service-status.tsx", "google-connect-dialog.tsx" → "agent/google_connect.py" → "skills/productivity/google-workspace/scripts/google_api.py check" (minimalne metadane trzech usług).
- Odbiór wyglądu i sesji: "apps/desktop/e2e/jarvis-shell-vertical.spec.ts"; obrazy: "docs/assets/czesiek/acceptance/".
