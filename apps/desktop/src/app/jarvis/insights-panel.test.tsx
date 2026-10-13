import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { I18nProvider } from '@/i18n'

import { JarvisInsightsPanel } from './insights-panel'
import { deriveJarvisMetrics } from './metrics'
import type { JarvisNewsItem } from './news'
import type { JarvisInsightsView } from './panel-copy'
import type { JarvisEvent } from './types'

const EVENTS: JarvisEvent[] = [
  { at: 1_000, label: 'Terminal', sessionId: 's1', taskId: 't1', toolCallId: 'a', type: 'tool.started' },
  {
    at: 3_000,
    detail: 'ls -la',
    label: 'Terminal',
    sessionId: 's1',
    taskId: 't1',
    toolCallId: 'a',
    type: 'tool.completed'
  },
  { at: 4_000, detail: 'Notatka gotowa', sessionId: 's1', taskId: 't1', type: 'task.verified' }
]

const COPY = {
  activity: {
    close: 'Zamknij aktywność',
    empty: 'Brak aktywności w tej rozmowie.',
    title: 'Co robi Agent Czesiek',
    types: {
      'task.verified': 'Zweryfikowano rezultat',
      'tool.completed': 'Narzędzie zakończone',
      'tool.started': 'Narzędzie uruchomione'
    }
  },
  news: {
    approvalDetail: 'Sprawdź szczegóły i zdecyduj.',
    approvalTitle: 'Czeka na Twoją zgodę',
    empty: 'Nic nowego.',
    engineTitle: 'Nowa wersja silnika',
    failureTitle: 'Zadanie nie powiodło się',
    openUpdate: 'Otwórz aktualizację',
    releaseNoNotes: 'Brak opisu zmian.',
    releaseTitle: 'Nowa wersja Agenta Cześka',
    resultTitle: 'Zweryfikowany rezultat',
    title: 'Newsy',
    toolDetail: (label: string, runs: number) => `${label} — ${runs}`,
    toolTitle: 'Najczęstsze narzędzie'
  },
  stats: {
    chart: {
      columnHeader: { bucket: 'Przedział', count: 'Zdarzenia', tool: 'Narzędzie' },
      timelineBucket: (count: number, from: string, to: string) => `${from}–${to}: ${count}`,
      timelineEmpty: 'Brak zdarzeń do pokazania na wykresie.',
      timelineSummary: (events: number) => `${events} zdarzeń`,
      timelineTitle: 'Aktywność w czasie',
      toolRunning: (running: number) => `${running} w toku`,
      toolRuns: (runs: number) => `${runs}×`,
      toolsEmpty: 'Brak narzędzi.',
      toolsTitle: 'Użyte narzędzia'
    },
    countsLabel: 'Liczby tej sesji',
    duration: (ms: number) => `${ms} ms`,
    empty: 'Statystyki pojawią się później.',
    failed: 'Błędy',
    medianToolTime: 'Mediana czasu narzędzia',
    notMeasured: '—',
    toolRuns: 'Uruchomienia narzędzi',
    verified: 'Zweryfikowane'
  },
  tabs: { activity: 'Aktywność', news: 'Newsy', stats: 'Statystyki' },
  viewsLabel: 'Panel Agenta Cześka'
}

function Harness({
  events = EVENTS,
  news = [],
  onOpenUpdate
}: {
  events?: readonly JarvisEvent[]
  news?: readonly JarvisNewsItem[]
  onOpenUpdate?: (target: 'backend' | 'client') => void
}) {
  const [view, setView] = useState<JarvisInsightsView>('activity')

  return (
    <I18nProvider configClient={null} initialLocale="pl">
      <JarvisInsightsPanel
        copy={COPY}
        events={events}
        labelledBy="panel-title"
        metrics={deriveJarvisMetrics(events)}
        news={news}
        onOpenUpdate={onOpenUpdate}
        onViewChange={setView}
        view={view}
      />
    </I18nProvider>
  )
}

afterEach(() => {
  cleanup()
})

describe('Agent CzesiekInsightsPanel', () => {
  it('keeps the complementary landmark and its name while gaining views', () => {
    render(<Harness />)

    const panel = screen.getByRole('complementary', { name: 'Co robi Agent Czesiek' })

    expect(panel.getAttribute('data-activity-surface')).toBe('panel')
    expect(within(panel).getByRole('button', { name: 'Aktywność' })).toBeTruthy()
    expect(within(panel).getByRole('button', { name: 'Statystyki' })).toBeTruthy()
    expect(within(panel).getByRole('button', { name: 'Newsy' })).toBeTruthy()
  })

  it('switches between the log, the measured stats, and the digest', () => {
    render(
      <Harness
        news={[{ detail: 'Notatka gotowa', id: 'r1', kind: 'result', title: 'Zweryfikowany rezultat', tone: 'accent' }]}
      />
    )

    // The log shows the raw event, detail and all.
    expect(screen.getByText('ls -la')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Statystyki' }))

    expect(screen.getByText('Uruchomienia narzędzi')).toBeTruthy()
    // The median of the one matched pair — 3000ms minus 1000ms — not a guess.
    expect(screen.getByText('2000 ms')).toBeTruthy()
    expect(screen.queryByText('ls -la')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Newsy' }))

    expect(screen.getByText('Zweryfikowany rezultat')).toBeTruthy()
    expect(screen.queryByText('Uruchomienia narzędzi')).toBeNull()
  })

  it('counts items needing attention on the news tab', () => {
    render(
      <Harness
        news={[
          { id: 'a1', kind: 'approval', title: 'Czeka na Twoją zgodę', tone: 'warn' },
          { id: 'r1', kind: 'result', title: 'Zweryfikowany rezultat', tone: 'accent' }
        ]}
      />
    )

    expect(screen.getByRole('button', { name: 'Newsy (1)' })).toBeTruthy()
  })

  it('shows honest empty states instead of a chart with no data', () => {
    render(<Harness events={[]} />)

    expect(screen.getByText('Brak aktywności w tej rozmowie.')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Statystyki' }))

    expect(screen.getByText('Statystyki pojawią się później.')).toBeTruthy()
    expect(screen.queryByRole('img')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Newsy' }))

    expect(screen.getByText('Nic nowego.')).toBeTruthy()
  })

  it('routes an update news item to the real update overlay', () => {
    const onOpenUpdate = vi.fn()

    render(
      <Harness
        news={[{ action: 'update-backend', id: 'e1', kind: 'engine', title: 'Nowa wersja silnika', tone: 'accent' }]}
        onOpenUpdate={onOpenUpdate}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Newsy' }))
    fireEvent.click(screen.getByRole('button', { name: 'Otwórz aktualizację' }))

    expect(onOpenUpdate).toHaveBeenCalledWith('backend')
  })

  it('offers no update action when the shell cannot open one', () => {
    render(
      <Harness
        news={[
          { action: 'update-client', id: 'c1', kind: 'release', title: 'Nowa wersja Agenta Cześka', tone: 'accent' }
        ]}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Newsy' }))

    expect(screen.getByText('Nowa wersja Agenta Cześka')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Otwórz aktualizację' })).toBeNull()
  })
})
