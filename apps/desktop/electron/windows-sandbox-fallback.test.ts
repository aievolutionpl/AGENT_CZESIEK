import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { test } from 'vitest'

import {
  ALL_APPLICATION_PACKAGES_SID,
  buildIcaclsGrantArgs,
  grantAllApplicationPackagesAcl,
  parseSandboxMarker,
  readSandboxMarker,
  sandboxMarkerPath,
  shouldAttemptAclRepair,
  WINDOWS_SANDBOX_MARKER_FILENAME,
  writeSandboxMarker
} from './windows-sandbox-fallback'

test('shouldAttemptAclRepair only fires on evidence of trouble', () => {
  assert.equal(shouldAttemptAclRepair(null), false)
  assert.equal(shouldAttemptAclRepair({ state: 'ok' }), false)
  assert.equal(shouldAttemptAclRepair({ state: 'booting' }), true)
  assert.equal(shouldAttemptAclRepair({ state: 'fallback' }), true)
})

test('sandbox marker round-trips through the userData file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hermes-sandbox-marker-'))

  try {
    assert.equal(sandboxMarkerPath(dir), path.join(dir, WINDOWS_SANDBOX_MARKER_FILENAME))
    assert.equal(readSandboxMarker(dir), null)

    writeSandboxMarker(dir, { state: 'booting' })
    assert.deepEqual(readSandboxMarker(dir), { state: 'booting' })

    // A prior version may have persisted a sticky opt-out; only its boot state is used.
    fs.writeFileSync(sandboxMarkerPath(dir), JSON.stringify({ state: 'fallback', reason: 'boot-loop' }))
    assert.deepEqual(readSandboxMarker(dir), { state: 'fallback' })

    assert.equal(parseSandboxMarker({ state: 'fallback' })?.state, 'fallback')
    assert.equal(parseSandboxMarker({ state: 'nope' }), null)
    // Unknown reason strings and junk fields are dropped, not fatal.
    assert.deepEqual(parseSandboxMarker({ state: 'fallback', reason: 'weird', bootAborts: -3 }), {
      state: 'fallback'
    })
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('buildIcaclsGrantArgs targets ALL APPLICATION PACKAGES with inherited RX', () => {
  assert.deepEqual(buildIcaclsGrantArgs('C:\\Hermes\\win-unpacked'), [
    'C:\\Hermes\\win-unpacked',
    '/grant',
    `*${ALL_APPLICATION_PACKAGES_SID}:(OI)(CI)(RX)`,
    '/T',
    '/C',
    '/Q'
  ])
})

test('grantAllApplicationPackagesAcl is a no-op off Windows and reports exec failures', () => {
  assert.deepEqual(grantAllApplicationPackagesAcl('C:\\x', { platform: 'darwin' }), { ok: false })

  const calls: Array<{ file: string; args: readonly string[] }> = []

  const ok = grantAllApplicationPackagesAcl('C:\\Hermes', {
    platform: 'win32',
    execFileSync(file, args) {
      calls.push({ file, args })

      return Buffer.alloc(0)
    }
  })

  assert.deepEqual(ok, { ok: true })
  assert.equal(calls.length, 1)
  assert.equal(calls[0]?.file, 'icacls')
  assert.deepEqual(calls[0]?.args, buildIcaclsGrantArgs('C:\\Hermes'))

  const failed = grantAllApplicationPackagesAcl('C:\\Hermes', {
    platform: 'win32',
    execFileSync() {
      throw new Error('access denied')
    }
  })

  assert.equal(failed.ok, false)
  assert.match(String(failed.error), /access denied/)
})
