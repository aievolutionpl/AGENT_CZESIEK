import { beforeEach, describe, expect, it } from 'vitest'

import { cancelPreparedPresetTask, preparePresetTask, takePreparedPresetTask } from './launch-preset'
import type { PresetOwner } from './preset-store'
import type { SubagentPreset } from './presets'

const owner: PresetOwner = { connectionId: 'remote-a', profile: 'default' }
const preset: SubagentPreset = {
  id: 'marketing',
  name: 'Marketing',
  character: 'Draft carefully.',
  skills: [{ name: 'brand-post-system' }],
  created_at: 'a',
  updated_at: 'a'
}

beforeEach(() => {
  // Consume any preparation left by a failed assertion in this module.
  takePreparedPresetTask(owner)
})

describe('scoped preset task preparation', () => {
  it('prepares explicit parent text but does not submit it', () => {
    const prepared = preparePresetTask(owner, preset, 'Write a launch post', [
      { name: 'brand-post-system', state: 'enabled' }
    ])
    expect(prepared.text).toContain('Draft carefully.')
    expect(prepared.text).toContain('Write a launch post')
    expect(takePreparedPresetTask(owner)).toEqual(prepared)
  })

  it('cannot be consumed by a foreign owner', () => {
    preparePresetTask(owner, preset, 'Task', [{ name: 'brand-post-system', state: 'enabled' }])
    expect(takePreparedPresetTask({ connectionId: 'remote-b', profile: 'default' })).toBeNull()
    expect(takePreparedPresetTask(owner)?.owner).toEqual(owner)
  })

  it('cancelling preparation leaves no launch request to consume', () => {
    const prepared = preparePresetTask(owner, preset, 'Cancelled', [])
    cancelPreparedPresetTask(prepared.id)
    expect(takePreparedPresetTask(owner)).toBeNull()
  })
})
