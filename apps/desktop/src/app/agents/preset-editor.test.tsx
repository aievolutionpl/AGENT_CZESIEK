import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

import { PresetEditor } from './preset-editor'
import { initialPresetMetadata, normalizePresetMetadata } from './presets'

afterEach(cleanup)

it('saves a custom teammate with chosen avatar, department and unique skill references', () => {
  const save = vi.fn()
  render(<PresetEditor onCancel={vi.fn()} onSave={save} preset={null} />)
  fireEvent.change(screen.getByLabelText('Nazwa agenta'), { target: { value: 'Ada' } })
  fireEvent.change(screen.getByLabelText('Dział lub specjalizacja'), { target: { value: 'Finanse' } })
  fireEvent.change(screen.getByLabelText('Instrukcje agenta'), {
    target: { value: 'Sprawdzaj obliczenia i pytaj o brakujące dane.' }
  })
  fireEvent.change(screen.getByLabelText('Skille do roli'), { target: { value: 'budzet, budzet' } })
  fireEvent.click(screen.getByRole('button', { name: 'Avatar Iga' }))
  fireEvent.click(screen.getByRole('button', { name: 'Zapisz rolę' }))
  expect(save).toHaveBeenCalledWith(
    expect.objectContaining({ name: 'Ada', avatar: 'iga', department: 'Finanse', skills: [{ name: 'budzet' }] })
  )
  const metadata = normalizePresetMetadata({ schema_version: 1, presets: [save.mock.calls[0][0]] })
  expect(metadata.presets).toEqual([save.mock.calls[0][0]])
})

it('preserves a saved teammate identity when changing its appearance', () => {
  const saved = initialPresetMetadata().presets[0]
  const save = vi.fn()
  render(<PresetEditor onCancel={vi.fn()} onSave={save} preset={saved} />)
  fireEvent.click(screen.getByRole('button', { name: 'Avatar Lena' }))
  fireEvent.click(screen.getByRole('button', { name: 'Zapisz rolę' }))
  expect(save).toHaveBeenCalledWith(
    expect.objectContaining({ id: saved.id, created_at: saved.created_at, avatar: 'lena' })
  )
})
