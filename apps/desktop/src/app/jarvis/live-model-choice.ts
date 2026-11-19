import { useStore } from '@nanostores/react'
import { useState } from 'react'

import { getHermesConfigRecord, saveHermesConfigRecord } from '@/api/config'
import { useI18n } from '@/i18n'
import { LIVE_VOICE_MODELS } from '@/lib/live-voice/models'
import { $activeConnectionId } from '@/store/connections'
import { notifyError } from '@/store/notifications'
import { $activeGatewayProfile } from '@/store/profile'
import { $liveVoiceChoice, applyVoiceEngineFromConfig } from '@/store/voice-prefs'

import { setNested } from '../settings/helpers'

export { LIVE_VOICE_MODELS } from '@/lib/live-voice/models'

export const liveModelValue = (choice: { model: string; provider: string }) => `${choice.provider}:${choice.model}`

/** The active Live voice model and the one write that changes it (config, scoped to the active gateway/profile). */
export function useLiveVoiceModel() {
  const { locale } = useI18n()
  const live = useStore($liveVoiceChoice)
  const connectionId = useStore($activeConnectionId)
  const profile = useStore($activeGatewayProfile)
  const [saving, setSaving] = useState(false)

  const choose = async (selection: string) => {
    const model = LIVE_VOICE_MODELS.find(item => liveModelValue(item) === selection)

    if (!model) {
      return
    }

    setSaving(true)

    const scope = { connectionId, profile }

    try {
      let config: Record<string, unknown> = { ...(await getHermesConfigRecord(scope)) }
      config = setNested(config, 'voice.engine', 'realtime')
      config = setNested(config, 'voice.realtime.provider', model.provider)
      config = setNested(
        config,
        model.provider === 'gemini' ? 'voice.realtime.gemini.model' : 'voice.realtime.model',
        model.model
      )

      const result = await saveHermesConfigRecord(config, scope)

      if (!result.ok) {
        throw new Error('Configuration was not saved')
      }

      if ($activeGatewayProfile.get() === profile && $activeConnectionId.get() === connectionId) {
        applyVoiceEngineFromConfig(config)
      }
    } catch (error) {
      notifyError(error, locale === 'pl' ? 'Nie zapisano modelu rozmowy' : 'Could not save voice model')
    } finally {
      setSaving(false)
    }
  }

  const current = LIVE_VOICE_MODELS.find(item => liveModelValue(item) === liveModelValue(live))

  return { choose, current, label: current?.label ?? live.model, live, saving }
}
