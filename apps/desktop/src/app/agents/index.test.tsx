// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { requestGatewayForAgent } = vi.hoisted(() => ({ requestGatewayForAgent: vi.fn() }))
vi.mock('@/store/gateway', () => ({ activeGatewayConnectionId: () => null, requestGatewayForAgent }))
vi.mock('@/api/skills', () => ({
  getSkills: vi.fn().mockResolvedValue([{ name: 'brand-post-system', enabled: true }])
}))
vi.mock('@/store/subagents', () => ({
  $subagentsBySession: { get: () => ({}), listen: () => () => {} },
  allSubagents: () => [],
  buildSubagentTree: () => []
}))
vi.mock('@/components/pane-shell/pane-visibility', () => ({ usePaneVisible: () => true }))
vi.mock('@/i18n', () => ({
  useI18n: () => ({
    t: {
      agents: {
        close: 'Close',
        emptyTitle: 'No live subagents',
        emptyDesc: 'None',
        title: 'Spawn tree',
        subtitle: 'Live',
        running: 'Running',
        failed: 'Failed',
        done: 'Done',
        streaming: 'Streaming',
        files: 'Files',
        moreFiles: () => '',
        moreAgents: () => '',
        queued: 'Queued',
        waitingActivity: 'Waiting',
        steer: 'Steer',
        steerPlaceholder: '',
        steerQueued: '',
        stopRequested: '',
        requestRejected: '',
        delegation: () => '',
        workers: () => '',
        workersActive: () => '',
        agentsCount: () => '',
        activeCount: () => '',
        failedCount: () => '',
        toolsCount: () => '',
        filesCount: () => '',
        updatedAgo: () => '',
        ageNow: '',
        ageSeconds: () => '',
        ageMinutes: () => '',
        ageHours: () => '',
        ageDays: () => '',
        durationSeconds: () => '',
        durationMinutes: () => '',
        tokens: () => ''
      }
    }
  })
}))
vi.mock('@/store/profile', () => ({
  $activeGatewayProfile: { get: () => 'default' },
  normalizeProfileKey: (value: string) => value
}))
vi.mock('@/components/ui/fade-text', () => ({
  FadeText: ({ children }: { children: React.ReactNode }) => <span>{children}</span>
}))
vi.mock('@/components/ui/glyph-spinner', () => ({ GlyphSpinner: () => null }))
vi.mock('@/components/ui/codicon', () => ({ Codicon: () => null }))
vi.mock('@/lib/use-enter-animation', () => ({ useEnterAnimation: () => undefined }))
vi.mock('@/components/chat/activity-timer', () => ({ useElapsedSeconds: () => 0 }))
vi.mock('@/components/chat/activity-timer-text', () => ({ ActivityTimerText: () => null }))
vi.mock('@/components/ui/button', async () => await vi.importActual('@/components/ui/button'))
vi.mock('@/components/ui/input', async () => await vi.importActual('@/components/ui/input'))

describe('AgentsView preset surface', () => {
  beforeEach(() => {
    requestGatewayForAgent.mockResolvedValue({
      profiles: [{ name: 'default', ui_meta_revisions: { 'agent-czesiek.subagent-presets': 0 } }]
    })
  })
  afterEach(cleanup)

  it('keeps live empty state and exposes ready preset management', async () => {
    const { AgentsView } = await import('./index')
    await act(async () => {
      render(
        <MemoryRouter>
          <AgentsView onClose={vi.fn()} />
        </MemoryRouter>
      )
    })
    expect(await screen.findByText('Gotowe role asystenta')).toBeTruthy()
    expect(screen.getByText('Marketing')).toBeTruthy()
    expect(screen.getByText('No live subagents')).toBeTruthy()
  })
})
