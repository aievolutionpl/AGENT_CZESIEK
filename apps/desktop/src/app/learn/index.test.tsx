import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, expect, it } from 'vitest'

import { AI_LESSONS } from './lessons'

import { LearnView } from './index'

afterEach(cleanup)

it('switches lessons and clears the previous answer when a new lesson opens', () => {
  render(
    <MemoryRouter>
      <LearnView />
    </MemoryRouter>
  )
  fireEvent.click(screen.getByRole('button', { name: 'Pokaż odpowiedź' }))
  expect(screen.getByRole('status').textContent).toBe(AI_LESSONS[0].answer)
  fireEvent.click(screen.getByRole('button', { name: /Modele, API i głos/ }))
  expect(screen.queryByRole('status')).toBeNull()
  expect(screen.getByRole('heading', { name: 'Modele, API i głos' })).toBeTruthy()
})

it('finds glossary definitions and explains an empty search', () => {
  render(
    <MemoryRouter>
      <LearnView />
    </MemoryRouter>
  )
  fireEvent.click(screen.getByRole('button', { name: 'Słownik AI' }))
  fireEvent.change(screen.getByLabelText('Szukaj pojęcia'), { target: { value: 'halucynacja' } })
  expect(screen.getByText('Halucynacja')).toBeTruthy()
  expect(screen.queryByText('Token')).toBeNull()
  fireEvent.change(screen.getByLabelText('Szukaj pojęcia'), { target: { value: 'xyzxyz' } })
  expect(screen.getByText(/Nie znaleziono pojęcia/)).toBeTruthy()
})
