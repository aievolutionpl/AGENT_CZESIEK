import { beforeEach, describe, expect, it, vi } from 'vitest'

const { requestGatewayForAgent } = vi.hoisted(() => ({ requestGatewayForAgent: vi.fn() }))
vi.mock('@/store/gateway', () => ({ requestGatewayForAgent }))

import { loadPresetSnapshot, PresetStoreError, savePresetMetadata } from './preset-store'
import { initialPresetMetadata, PRESET_METADATA_KEY } from './presets'

describe('scoped preset store', () => {
  beforeEach(() => vi.clearAllMocks())

  it('reads and writes only the captured connection/profile namespace', async () => {
    const metadata = initialPresetMetadata()
    requestGatewayForAgent.mockResolvedValueOnce({
      profiles: [
        {
          name: 'research',
          ui_meta: { [PRESET_METADATA_KEY]: metadata },
          ui_meta_revisions: { [PRESET_METADATA_KEY]: 4 }
        }
      ]
    })
    const snapshot = await loadPresetSnapshot({ connectionId: 'remote-a', profile: 'research' })
    expect(requestGatewayForAgent).toHaveBeenCalledWith('remote-a', 'research', 'profiles.list', {
      include_sessions: false
    })

    requestGatewayForAgent.mockResolvedValueOnce({
      ok: true,
      applied: { ui_meta: true, ui_meta_revisions: { [PRESET_METADATA_KEY]: 5 } }
    })
    const saved = await savePresetMetadata(snapshot, { schema_version: 1, presets: [] })
    expect(requestGatewayForAgent).toHaveBeenLastCalledWith(
      'remote-a',
      'research',
      'profiles.configure',
      expect.objectContaining({
        name: 'research',
        ui_meta_expected_revisions: { [PRESET_METADATA_KEY]: 4 }
      })
    )
    expect(saved.revision).toBe(5)
  })

  it('reports a revision conflict instead of retrying last-write-wins', async () => {
    const metadata = initialPresetMetadata()
    requestGatewayForAgent.mockResolvedValueOnce({
      profiles: [
        {
          name: 'default',
          ui_meta: { [PRESET_METADATA_KEY]: metadata },
          ui_meta_revisions: { [PRESET_METADATA_KEY]: 2 }
        }
      ]
    })
    const snapshot = await loadPresetSnapshot({ connectionId: 'local', profile: 'default' })
    requestGatewayForAgent.mockResolvedValueOnce({
      ok: true,
      applied: { ui_meta: false, ui_meta_conflicts: { [PRESET_METADATA_KEY]: { expected: 2, actual: 3 } } }
    })
    await expect(savePresetMetadata(snapshot, { schema_version: 1, presets: [] })).rejects.toMatchObject({
      code: 'conflict'
    })
    expect(requestGatewayForAgent).toHaveBeenCalledTimes(2)
  })

  it('treats a backend without CAS as unsupported', async () => {
    await expect(
      savePresetMetadata(
        {
          owner: { connectionId: 'local', profile: 'default' },
          metadata: initialPresetMetadata(),
          revision: 0,
          supports_cas: false
        },
        initialPresetMetadata()
      )
    ).rejects.toBeInstanceOf(PresetStoreError)
    expect(requestGatewayForAgent).not.toHaveBeenCalled()
  })
})
