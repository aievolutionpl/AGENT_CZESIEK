import { beforeEach, describe, expect, it, vi } from 'vitest'

const requests = vi.hoisted(() => ({
  getApiRequestConnection: vi.fn(() => 'remote-a'),
  getApiRequestProfile: vi.fn(() => 'alpha'),
  setApiRequestProfile: vi.fn(),
  getStarmapGraph: vi.fn()
}))

vi.mock('@/hermes', () => requests)

import {
  $starmapGeneration,
  $starmapGraph,
  $starmapOwner,
  evictStarmapNode,
  loadStarmapGraph,
  resetStarmapGraph
} from './starmap'

const graph = (id: string) => ({
  nodes: [
    {
      id,
      label: id,
      kind: 'memory' as const,
      category: 'memory',
      useCount: 0,
      state: 'active',
      createdBy: null,
      pinned: false
    }
  ],
  edges: [],
  clusters: [],
  memory: [],
  stats: {}
})

describe('scoped starmap cache', () => {
  beforeEach(() => {
    resetStarmapGraph()
    requests.getStarmapGraph.mockReset()
    requests.getApiRequestConnection.mockReturnValue('remote-a')
    requests.getApiRequestProfile.mockReturnValue('alpha')
  })

  it('does not let a late response from the previous owner populate the new profile', async () => {
    let resolveA!: (value: ReturnType<typeof graph>) => void
    const pendingA = new Promise<ReturnType<typeof graph>>(resolve => {
      resolveA = resolve
    })
    requests.getStarmapGraph.mockReturnValueOnce(pendingA).mockResolvedValueOnce(graph('b'))

    const first = loadStarmapGraph()
    await loadStarmapGraph(true, { connectionId: 'remote-b', profile: 'beta' })
    resolveA(graph('a'))
    await first

    expect($starmapOwner.get()).toEqual({ connectionId: 'remote-b', profile: 'beta' })
    expect($starmapGraph.get()?.nodes[0]?.id).toBe('b')
  })

  it('rolls back only the cache generation that accepted the optimistic deletion', async () => {
    requests.getStarmapGraph.mockResolvedValue(graph('memory'))
    await loadStarmapGraph()
    const generation = $starmapGeneration.get()
    const rollback = evictStarmapNode('memory', $starmapOwner.get()!, generation)

    resetStarmapGraph()
    rollback()

    expect($starmapGraph.get()).toBeNull()
  })
})
