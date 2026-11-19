import { atom } from 'nanostores'

import type { MemoryOwner } from '@/app/starmap/types'
import { getApiRequestConnection, getApiRequestProfile, getStarmapGraph, type ProfileScope } from '@/hermes'
import type { StarmapGraph } from '@/types/hermes'

// On-demand cache for the star map. The graph scan touches the skills catalog +
// usage ledger + memory files, so we fetch it only when the panel opens (and on
// an explicit refresh), never on a turn boundary.
export const $starmapGraph = atom<StarmapGraph | null>(null)
export const $starmapLoading = atom(false)
export const $starmapError = atom<null | string>(null)
export const $starmapOwner = atom<MemoryOwner | null>(null)
export const $starmapGeneration = atom(0)

let inflight: { key: string; promise: Promise<void> } | null = null

function captureScope(scope?: ProfileScope): { key: string; owner: MemoryOwner; request: ProfileScope } {
  const explicit = scope && typeof scope === 'object' ? scope : null
  const connectionId =
    (
      explicit?.connectionId ??
      (typeof scope === 'string' ? getApiRequestConnection() : getApiRequestConnection()) ??
      'local'
    ).trim() || 'local'
  const profile =
    (explicit?.profile ?? (typeof scope === 'string' ? scope : getApiRequestProfile()) ?? 'default').trim() || 'default'
  const request: ProfileScope = { connectionId, profile }

  return { key: `${connectionId}::${profile}`, owner: { connectionId, profile }, request }
}

export async function loadStarmapGraph(force = false, scope?: ProfileScope): Promise<void> {
  const captured = captureScope(scope)
  const currentOwner = $starmapOwner.get()

  if (inflight?.key === captured.key && !force) {
    return inflight.promise
  }

  if (
    $starmapGraph.get() &&
    !force &&
    currentOwner?.connectionId === captured.owner.connectionId &&
    currentOwner.profile === captured.owner.profile
  ) {
    return
  }

  const generation = $starmapGeneration.get() + 1
  $starmapGeneration.set(generation)

  $starmapLoading.set(true)
  $starmapError.set(null)

  let promise!: Promise<void>
  promise = (async () => {
    try {
      const graph = await getStarmapGraph(captured.request)

      if ($starmapGeneration.get() !== generation) {
        return
      }
      $starmapGraph.set(graph)
      $starmapOwner.set(captured.owner)
    } catch (err) {
      if ($starmapGeneration.get() === generation) {
        $starmapError.set(err instanceof Error ? err.message : String(err))
      }
    } finally {
      if ($starmapGeneration.get() === generation) {
        $starmapLoading.set(false)

        if (inflight?.promise === promise) {
          inflight = null
        }
      }
    }
  })()
  inflight = { key: captured.key, promise }

  return promise
}

/** Drop one node from the cached graph immediately; return rollback. */
export function evictStarmapNode(id: string, owner?: MemoryOwner, generation?: number): () => void {
  const prev = $starmapGraph.get()
  const currentOwner = $starmapOwner.get()

  if (
    !prev ||
    (owner && (currentOwner?.connectionId !== owner.connectionId || currentOwner.profile !== owner.profile)) ||
    (generation !== undefined && $starmapGeneration.get() !== generation)
  ) {
    return () => {}
  }

  const next: StarmapGraph = {
    ...prev,
    nodes: prev.nodes.filter(node => node.id !== id),
    edges: prev.edges.filter(edge => edge.source !== id && edge.target !== id)
  }

  $starmapGraph.set(next)

  return () => {
    const nowOwner = $starmapOwner.get()

    if (
      (!owner || (nowOwner?.connectionId === owner.connectionId && nowOwner.profile === owner.profile)) &&
      (generation === undefined || $starmapGeneration.get() === generation)
    ) {
      $starmapGraph.set(prev)
    }
  }
}

/** Drop the cache so the next open refetches against the now-active profile. */
export function resetStarmapGraph(): void {
  $starmapGeneration.set($starmapGeneration.get() + 1)
  inflight = null
  $starmapGraph.set(null)
  $starmapOwner.set(null)
  $starmapError.set(null)
}
