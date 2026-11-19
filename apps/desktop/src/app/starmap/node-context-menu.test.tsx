import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/hermes', () => ({
  deleteLearningNode: vi.fn(),
  editLearningNode: vi.fn(),
  getLearningNode: vi.fn(),
  setApiRequestProfile: vi.fn()
}))
vi.mock('@/app/learning/archive-skill-confirm-dialog', () => ({
  ArchiveSkillConfirmDialog: () => null,
  fireOptimistic: vi.fn()
}))
vi.mock('@/components/chat/code-editor', () => ({ CodeEditor: () => null }))
vi.mock('@/components/ui/button', () => ({
  Button: ({ children }: { children: React.ReactNode }) => <button>{children}</button>
}))
vi.mock('@/components/ui/confirm-dialog', () => ({ ConfirmDialog: () => null }))
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DialogContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <>{children}</>
}))

import { NodeContextMenu } from './node-context-menu'

describe('imported memory ownership', () => {
  it('does not offer local mutation actions for imported graphs', () => {
    render(
      <NodeContextMenu
        onClose={() => {}}
        onNodeRemoved={() => {}}
        source={{
          kind: 'imported',
          import_id: 'shared',
          graph: { nodes: [], edges: [], clusters: [], memory: [], stats: {} }
        }}
        target={{ id: 'memory:memory:0', kind: 'memory', label: 'Imported', x: 10, y: 10 }}
      />
    )

    expect(screen.queryByRole('button', { name: /edit memory/i })).toBeNull()
    expect(screen.getByText('Imported memory is read-only')).toBeTruthy()
  })
})
