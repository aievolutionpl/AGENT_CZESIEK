import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { readKey } from '@/lib/storage'
import { $interfaceMaterial, setInterfaceMaterial } from '@/store/interface-material'

import { InterfaceMaterialSettings } from './interface-material'

vi.mock('@/i18n', () => ({ useI18n: () => ({ locale: 'pl' }) }))

beforeEach(() => setInterfaceMaterial('liquid'))

describe('interface material selection', () => {
  it('persists the selected appearance and supports arrow-key selection', () => {
    render(<InterfaceMaterialSettings />)
    const liquid = screen.getByRole('radio', { name: /Liquid Glass/ })
    const standard = screen.getByRole('radio', { name: /Klasyczny/ })
    fireEvent.click(standard)
    expect($interfaceMaterial.get()).toBe('standard')
    expect(readKey('czesiek.interface-material.v1')).toBe('standard')
    expect(standard.getAttribute('aria-checked')).toBe('true')
    fireEvent.keyDown(standard, { key: 'ArrowRight' })
    expect($interfaceMaterial.get()).toBe('liquid')
    expect(readKey('czesiek.interface-material.v1')).toBe('liquid')
    expect(liquid.getAttribute('aria-checked')).toBe('true')
    expect(document.activeElement).toBe(liquid)
  })
})
