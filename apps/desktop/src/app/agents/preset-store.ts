import { requestGatewayForAgent } from '@/store/gateway'

import { normalizePresetMetadata, PRESET_METADATA_KEY, type SubagentPresetMetadata } from './presets'

export interface PresetOwner {
  connectionId: string
  profile: string
}

export interface PresetSnapshot {
  owner: PresetOwner
  metadata: SubagentPresetMetadata
  revision: number
  supports_cas: boolean
}

export interface PresetConfigureParams {
  name: string
  ui_meta: { 'agent-czesiek.subagent-presets': SubagentPresetMetadata }
  ui_meta_expected_revisions: { 'agent-czesiek.subagent-presets': number }
}

export interface PresetConfigureResult {
  ok: boolean
  applied: {
    ui_meta: boolean
    ui_meta_revisions?: Record<string, number>
    ui_meta_conflicts?: Record<string, { expected: number | null; actual: number }>
  }
}

export class PresetStoreError extends Error {
  constructor(
    message: string,
    readonly code: 'unsupported' | 'conflict' | 'failed'
  ) {
    super(message)
    this.name = 'PresetStoreError'
  }
}

interface ProfilesListResponse {
  profiles?: Array<{
    name?: unknown
    ui_meta?: Record<string, unknown>
    ui_meta_revisions?: Record<string, unknown>
  }>
}

function profileName(owner: PresetOwner): string {
  return owner.profile.trim() || 'default'
}

export async function loadPresetSnapshot(owner: PresetOwner): Promise<PresetSnapshot> {
  const captured = { connectionId: owner.connectionId || 'local', profile: profileName(owner) }

  const result = await requestGatewayForAgent<ProfilesListResponse>(
    captured.connectionId,
    captured.profile,
    'profiles.list',
    {
      include_sessions: false
    }
  )

  const row = (result.profiles ?? []).find(candidate => candidate.name === captured.profile)
  const revisions = row?.ui_meta_revisions
  const supportsCas = Boolean(row && revisions && typeof revisions === 'object')

  return {
    owner: captured,
    metadata: normalizePresetMetadata(row?.ui_meta?.[PRESET_METADATA_KEY]),
    revision: Math.max(0, Number(revisions?.[PRESET_METADATA_KEY] ?? 0)),
    supports_cas: supportsCas
  }
}

export async function savePresetMetadata(
  snapshot: PresetSnapshot,
  metadata: SubagentPresetMetadata
): Promise<PresetSnapshot> {
  if (!snapshot.supports_cas) {
    throw new PresetStoreError('This backend does not support revision-safe preset storage.', 'unsupported')
  }

  const owner = { connectionId: snapshot.owner.connectionId || 'local', profile: profileName(snapshot.owner) }

  const params: PresetConfigureParams = {
    name: owner.profile,
    ui_meta: { [PRESET_METADATA_KEY]: metadata },
    ui_meta_expected_revisions: { [PRESET_METADATA_KEY]: snapshot.revision }
  }

  const result = await requestGatewayForAgent<PresetConfigureResult>(
    owner.connectionId,
    owner.profile,
    'profiles.configure',
    params as unknown as Record<string, unknown>
  )

  const applied = result?.applied

  if (applied?.ui_meta_conflicts?.[PRESET_METADATA_KEY]) {
    throw new PresetStoreError('Preset storage changed elsewhere. Reload before saving.', 'conflict')
  }

  if (
    applied?.ui_meta !== true ||
    !applied.ui_meta_revisions ||
    typeof applied.ui_meta_revisions[PRESET_METADATA_KEY] !== 'number'
  ) {
    throw new PresetStoreError('The backend did not confirm the preset update.', 'failed')
  }

  return { owner, metadata, revision: applied.ui_meta_revisions[PRESET_METADATA_KEY]!, supports_cas: true }
}
