// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { $screenLooking } from '@/store/screen-looking'

import { ScreenLookingBadge } from './screen-looking-badge'

afterEach(() => {
  cleanup()
  $screenLooking.set(false)
})

describe('ScreenLookingBadge', () => {
  it('says so only while a look is happening', () => {
    render(<ScreenLookingBadge />)

    expect(screen.queryByRole('status')).toBeNull()

    act(() => $screenLooking.set(true))

    expect(screen.getByRole('status').textContent).toMatch(/Czesiek (patrzy|is looking)/)

    act(() => $screenLooking.set(false))

    expect(screen.queryByRole('status')).toBeNull()
  })
})
