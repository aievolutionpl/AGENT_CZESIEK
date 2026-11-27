export interface SecretStoragePolicy {
  /** Keychain-backed encryption enabled (enabled by default). */
  on: boolean
  /** One-shot legacy-blob migration already attempted. */
  migrated: boolean
}

export const SECRET_STORAGE_POLICY_FILE = 'secure-token-storage.json'

export interface SecretStoragePolicyIo {
  readText: () => string
  writeText: (text: string) => void
}

/** Older builds wrote on:false automatically during a startup migration.
 * Only a preference written by the fixed Settings flow proves an explicit opt-out. */
export function readSecretStoragePolicy(io: SecretStoragePolicyIo): SecretStoragePolicy {
  try {
    const parsed = JSON.parse(io.readText())

    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      if (parsed.version === 2) {
        return { on: parsed.on !== false, migrated: parsed.migrated === true }
      }
    }
  } catch {
    // fall through to default
  }

  return { on: true, migrated: false }
}

export function writeSecretStoragePolicy(policy: SecretStoragePolicy, io: SecretStoragePolicyIo): void {
  io.writeText(JSON.stringify({ version: 2, on: policy.on === true, migrated: policy.migrated === true }))
}

/** One stored secret blob as it appears on disk. */
interface StoredSecret {
  encoding?: string
  value?: string
}

export function classifyStoredSecret(
  secret: StoredSecret | null | undefined,
  policy: SecretStoragePolicy
): 'keep' | 'drop' {
  if (!secret || typeof secret !== 'object' || secret.encoding !== 'safeStorage') {
    return 'keep'
  }

  if (policy.on) {
    return 'keep'
  }

  return 'drop'
}
