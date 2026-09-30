// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { I18nProvider } from '@/i18n'
import { Sparkles } from '@/lib/icons'

import { RailBoard, RailCustomizeMenu } from './rail-board'
import { RailCard } from './rail-card'
import { $railCollapsed } from './rail-collapse'
import { RAIL_CARD_IDS, type RailCardId, resetRailLayout } from './rail-layout'

const cards = Object.fromEntries(
  RAIL_CARD_IDS.map(id => [
    id,
    <RailCard icon={Sparkles} key={id} testId={id} title={`Karta ${id}`}>
      <p>treść {id}</p>
    </RailCard>
  ])
) as Record<RailCardId, React.ReactNode>

function renderBoard() {
  return render(
    <MemoryRouter>
      <I18nProvider configClient={null} initialLocale="pl">
        <RailCustomizeMenu />
        <RailBoard cards={cards} />
      </I18nProvider>
    </MemoryRouter>
  )
}

const shownOrder = () => screen.getAllByRole('heading', { level: 2 }).map(h => h.textContent)

beforeAll(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      disconnect() {}
      observe() {}
      unobserve() {}
    }
  )
})

afterEach(() => {
  cleanup()
  resetRailLayout()
  $railCollapsed.set({})
  window.localStorage.clear()
})

describe('rail board', () => {
  it('shows the cards in the shipped order, each with a labelled grip', () => {
    renderBoard()

    expect(shownOrder()).toEqual(RAIL_CARD_IDS.map(id => `Karta ${id}`))
    expect(screen.getByRole('button', { name: 'Przesuń kartę: Karta news' })).toBeTruthy()
  })

  it('hides a card without mounting it, and brings it back where it was', async () => {
    renderBoard()
    fireEvent.click(screen.getByRole('button', { name: 'Dostosuj panel' }))
    fireEvent.click(await screen.findByRole('switch', { name: 'Pokaż kartę: Newsy AI' }))

    expect(screen.queryByText('treść news')).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Karta news' })).toBeNull()

    fireEvent.click(screen.getByRole('switch', { name: 'Pokaż kartę: Newsy AI' }))
    expect(shownOrder()).toEqual(RAIL_CARD_IDS.map(id => `Karta ${id}`))
  })

  it('moves a card with the arrows, no dragging needed, and resets', async () => {
    renderBoard()
    fireEvent.click(screen.getByRole('button', { name: 'Dostosuj panel' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Przesuń wyżej: Pamięć' }))

    expect(shownOrder().slice(0, 2)).toEqual(['Karta memory', 'Karta start'])

    const menu = screen.getByTestId('jarvis-rail-customize')

    fireEvent.click(within(menu).getByRole('button', { name: 'Przywróć domyślny układ' }))
    expect(shownOrder().slice(0, 2)).toEqual(['Karta start', 'Karta memory'])
  })

  it('folds and opens a card, unmounting the content only after the fold has played', async () => {
    renderBoard()

    const toggle = screen.getByRole('button', { name: 'Karta memory' })

    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    await act(async () => new Promise(resolve => setTimeout(resolve, 400)))
    expect(screen.queryByText('treść memory')).toBeNull()

    fireEvent.click(toggle)
    expect(screen.getByText('treść memory')).toBeTruthy()
  })
})
