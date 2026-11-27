import fs from 'node:fs'
import path from 'node:path'

export const WINDOWS_SANDBOX_MARKER_FILENAME = 'windows-sandbox-fallback.json'

/** Well-known SID for "ALL APPLICATION PACKAGES". */
export const ALL_APPLICATION_PACKAGES_SID = 'S-1-15-2-2'

export type SandboxMarkerState = 'booting' | 'fallback' | 'ok'

export interface SandboxMarker {
  state: SandboxMarkerState
}

export function sandboxMarkerPath(userDataDir: string): string {
  return path.join(String(userDataDir || ''), WINDOWS_SANDBOX_MARKER_FILENAME)
}

export function parseSandboxMarker(raw: unknown): SandboxMarker | null {
  if (!raw || typeof raw !== 'object') {
    return null
  }

  const record = raw as Record<string, unknown>
  const state = record.state

  if (state !== 'booting' && state !== 'fallback' && state !== 'ok') {
    return null
  }

  return { state }
}

export function readSandboxMarker(userDataDir: string, { readFileSync = fs.readFileSync } = {}): SandboxMarker | null {
  try {
    const raw = JSON.parse(readFileSync(sandboxMarkerPath(userDataDir), 'utf8'))

    return parseSandboxMarker(raw)
  } catch {
    return null
  }
}

export function writeSandboxMarker(
  userDataDir: string,
  marker: SandboxMarker,
  {
    mkdirSync = fs.mkdirSync,
    writeFileSync = fs.writeFileSync
  }: {
    mkdirSync?: typeof fs.mkdirSync
    writeFileSync?: typeof fs.writeFileSync
  } = {}
): void {
  const dir = String(userDataDir || '')

  if (!dir) {
    return
  }

  mkdirSync(dir, { recursive: true })
  writeFileSync(sandboxMarkerPath(dir), `${JSON.stringify(marker)}\n`, 'utf8')
}

/**
 * ACL repair is not free (`icacls /T` recurses the whole install tree), so it
 * only runs when there is evidence of trouble: a prior launch aborted
 * mid-boot, or the fallback already engaged. Healthy hosts never pay for it —
 * the installer already granted the ACE at install time.
 */
export function shouldAttemptAclRepair(marker: SandboxMarker | null | undefined): boolean {
  return marker?.state === 'booting' || marker?.state === 'fallback'
}

/**
 * Build `icacls` argv that grants ALL APPLICATION PACKAGES RX with inheritance.
 * `/T` applies to existing children (win-unpacked DLLs); `/C` continues on
 * errors; `/Q` stays quiet for installer logs.
 */
export function buildIcaclsGrantArgs(targetDir: string): string[] {
  return [String(targetDir), '/grant', `*${ALL_APPLICATION_PACKAGES_SID}:(OI)(CI)(RX)`, '/T', '/C', '/Q']
}

export function grantAllApplicationPackagesAcl(
  targetDir: string,
  {
    platform = process.platform,
    execFileSync
  }: {
    platform?: NodeJS.Platform | string
    execFileSync?: (file: string, args: readonly string[], options?: object) => Buffer | string
  } = {}
): { ok: boolean; error?: string } {
  if (platform !== 'win32') {
    return { ok: false }
  }

  const dir = String(targetDir || '').trim()

  if (!dir || typeof execFileSync !== 'function') {
    return { ok: false, error: 'missing-target-or-exec' }
  }

  try {
    execFileSync('icacls', buildIcaclsGrantArgs(dir), {
      windowsHide: true,
      timeout: 30_000,
      stdio: 'ignore'
    })

    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}
