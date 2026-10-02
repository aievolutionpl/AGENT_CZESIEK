import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { I18nProvider } from '@/i18n'

import { VaultView } from './vault-view'

const owner = vi.hoisted(() => ({ connectionId: 'alpha', profile: 'default' }))
vi.mock('@/hooks/use-active-capability-scope', () => ({
  useActiveCapabilityScope: () => ({ scope: { ...owner }, scopeKey: `${owner.connectionId}::${owner.profile}` })
}))
vi.mock('./vault-graph', () => ({
  folderHues: () => new Map(),
  VaultGraphCanvas: ({ onSelect }: { onSelect: (id: string) => void }) => (
    <button onClick={() => onSelect('b.md')}>Open B</button>
  )
}))
vi.mock('@/store/notifications', () => ({ notify: vi.fn(), notifyError: vi.fn() }))

const graph = {
  vault: { path: 'C:/test-vault', exists: true },
  edges: [],
  nodes: [{ id: 'a.md', label: 'Note A', excerpt: '', folder: '', tags: [], links: 0, size: 1, timestamp: 1 }]
}

function view(client: QueryClient) {
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/starmap?note=a.md']}>
        <I18nProvider configClient={null} initialLocale="pl">
          <VaultView />
        </I18nProvider>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.stubGlobal('hermesDesktop', { api: vi.fn() })
})
afterEach(() => {
  cleanup()
  owner.connectionId = 'alpha'
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('vault editing', () => {
  it('keeps the draft and save dialog on a failed save; repeated keyboard saves cannot race', async () => {
    let rejectSave!: (reason: Error) => void

    const api = vi.spyOn(window.hermesDesktop, 'api').mockImplementation(async request => {
      if (request.method === 'PUT') {
        return new Promise((_resolve, reject) => {
          rejectSave = reject
        })
      }

      if (request.path.endsWith('/graph')) {
        return graph
      }

      return { id: 'a.md', content: 'original' }
    })

    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
    render(view(client))
    const editor = await screen.findByRole('textbox', { name: 'Note A' })
    fireEvent.change(editor, { target: { value: 'keep my changes' } })
    fireEvent.click(screen.getByRole('button', { name: 'Open B' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Zapisz i przejdź' }))
    fireEvent.keyDown(editor, { key: 's', ctrlKey: true })
    expect(api.mock.calls.filter(([request]) => request.method === 'PUT')).toHaveLength(1)
    await act(async () => rejectSave(new Error('disk unavailable')))
    expect(await screen.findByRole('dialog')).toBeTruthy()
    expect((editor as HTMLTextAreaElement).value).toBe('keep my changes')
    expect(api.mock.calls.some(([request]) => request.path.includes('b.md'))).toBe(false)
    client.clear()
  })

  it('reloads the same note from the new connection and offers recovery for a failed read', async () => {
    let failRead = true
    vi.spyOn(window.hermesDesktop, 'api').mockImplementation(async request => {
      if (request.path.endsWith('/graph')) {
        return graph
      }

      if (request.connectionId === 'beta' && failRead) {
        throw new Error('Note unavailable')
      }

      return { id: 'a.md', content: request.connectionId }
    })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
    const mounted = render(view(client))
    await waitFor(() =>
      expect((screen.getByRole('textbox', { name: 'Note A' }) as HTMLTextAreaElement).value).toBe('alpha')
    )
    owner.connectionId = 'beta'
    mounted.rerender(view(client))
    expect((await screen.findByRole('alert')).textContent).toContain('Note unavailable')
    expect(screen.queryByRole('textbox', { name: 'Note A' })).toBeNull()
    failRead = false
    const retry = screen.getAllByRole('button', { name: 'Odśwież' }).at(-1)!
    fireEvent.click(retry)
    await waitFor(() =>
      expect((screen.getByRole('textbox', { name: 'Note A' }) as HTMLTextAreaElement).value).toBe('beta')
    )
    client.clear()
  })
})
