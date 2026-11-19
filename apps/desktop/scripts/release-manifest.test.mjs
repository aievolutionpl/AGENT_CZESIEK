import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, test } from 'vitest'

import {
  buildManifest,
  CHECKSUMS_FILENAME,
  classifyArtifact,
  detectArch,
  MANIFEST_FILENAME,
  renderChecksums,
  sha256File,
  writeMacUpdateIndex,
  writeManifest
} from '../scripts/release-manifest.mjs'

let dir = ''

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'release-manifest-test-'))
})

afterEach(() => {
  fs.rmSync(dir, { force: true, recursive: true })
})

function writeArtifact(name, bytes = 64) {
  fs.writeFileSync(path.join(dir, name), Buffer.alloc(bytes, 7))
}

describe('classifyArtifact', () => {
  test('maps each installer extension to its platform and kind', () => {
    assert.deepEqual(classifyArtifact('AI-Evolution-Jarvis-0.17.2-win-x64.exe'), {
      platform: 'win',
      arch: 'x64',
      kind: 'nsis',
      signable: true
    })
    assert.equal(classifyArtifact('AI-Evolution-Jarvis-0.17.2-mac-arm64.dmg').kind, 'dmg')
    assert.equal(classifyArtifact('AI-Evolution-Jarvis-0.17.2-linux-x64.AppImage').kind, 'appimage')
    assert.equal(classifyArtifact('AI-Evolution-Jarvis-0.17.2-linux-x64.deb').platform, 'linux')
  })

  test('only macOS artifacts are treated as signable alongside Windows', () => {
    assert.equal(classifyArtifact('x-win-x64.msi').signable, true)
    assert.equal(classifyArtifact('x-mac-arm64.dmg').signable, true)
    assert.equal(classifyArtifact('x-linux-x64.rpm').signable, false)
  })

  test('unknown extensions are not published', () => {
    assert.equal(classifyArtifact('builder-debug.txt'), null)
  })

  test('a mac zip is recognised by its name, not its extension alone', () => {
    assert.equal(classifyArtifact('AI-Evolution-Jarvis-0.17.2-mac-arm64.zip').platform, 'mac')
  })
})

describe('detectArch', () => {
  // A universal dmg carries both tokens; reporting it as x64 would let the
  // gate believe the arm64 slice is missing.
  test('universal beats the arch tokens it contains', () => {
    assert.equal(detectArch('Jarvis-mac-universal-x64-arm64.dmg'), 'universal')
  })

  test('recognises the usual spellings', () => {
    assert.equal(detectArch('a-arm64.dmg'), 'arm64')
    assert.equal(detectArch('a-aarch64.rpm'), 'arm64')
    assert.equal(detectArch('a-x86_64.AppImage'), 'x64')
    assert.equal(detectArch('a-amd64.deb'), 'x64')
    assert.equal(detectArch('a.deb'), null)
  })
})

describe('writeMacUpdateIndex', () => {
  test('publishes both Mac update payloads with the digest of their actual contents', async () => {
    for (const arch of ['arm64', 'x64']) {
      for (const ext of ['zip', 'dmg']) {
        const name = `Jarvis-1.0.0-mac-${arch}.${ext}`
        fs.writeFileSync(path.join(dir, name), name)
      }
    }
    await writeMacUpdateIndex(dir, '1.0.0')
    const index = JSON.parse(fs.readFileSync(path.join(dir, 'latest-mac.yml'), 'utf8'))
    assert.equal(index.files.length, 4)
    assert.equal(index.path, 'Jarvis-1.0.0-mac-x64.zip')
    assert.equal(index.sha512, index.files[0].sha512)
    for (const { url, size, sha512 } of index.files) {
      assert.equal(size, Buffer.byteLength(url))
      assert.equal(sha512, createHash('sha512').update(url).digest('base64'))
    }
    assert.ok(index.files.some(file => file.url === 'Jarvis-1.0.0-mac-arm64.zip'))
  })

  test('rejects incomplete Mac releases before replacing the index', async () => {
    writeArtifact('Jarvis-1.0.0-mac-x64.zip')
    writeArtifact('Jarvis-1.0.0-mac-x64.dmg')
    await assert.rejects(writeMacUpdateIndex(dir, '1.0.0'), /arm64/)
    assert.equal(fs.existsSync(path.join(dir, 'latest-mac.yml')), false)
  })
})

describe('buildManifest', () => {
  test('records size and digest for every artifact', () => {
    writeArtifact('AI-Evolution-Jarvis-0.17.2-win-x64.exe', 128)
    const manifest = buildManifest({ dir, version: '0.17.2' })

    assert.equal(manifest.artifacts.length, 1)
    assert.equal(manifest.artifacts[0].size, 128)
    assert.equal(
      manifest.artifacts[0].sha256,
      createHash('sha256').update(Buffer.alloc(128, 7)).digest('hex')
    )
  })

  // The whole point of reading the report rather than guessing: a build with
  // no signing step must produce a manifest that says so.
  test('artifacts are unsigned when no signing report exists', () => {
    writeArtifact('AI-Evolution-Jarvis-0.17.2-win-x64.exe')
    const manifest = buildManifest({ dir, version: '0.17.2' })

    assert.equal(manifest.artifacts[0].signed, false)
    assert.equal(manifest.signing.windows, 'none')
  })

  test('the Windows signing report marks exactly the files it listed', () => {
    writeArtifact('signed.exe')
    writeArtifact('unsigned.msi')
    fs.writeFileSync(
      path.join(dir, '.signing-report.json'),
      JSON.stringify({ mode: 'azure', signed: ['signed.exe'] })
    )

    const manifest = buildManifest({ dir, version: '0.17.2' })
    const byFile = Object.fromEntries(manifest.artifacts.map(a => [a.file, a.signed]))

    assert.deepEqual(byFile, { 'signed.exe': true, 'unsigned.msi': false })
    assert.equal(manifest.signing.windows, 'azure')
  })

  test('the notarization report marks mac artifacts', () => {
    writeArtifact('Jarvis-mac-arm64.dmg')
    fs.writeFileSync(
      path.join(dir, '.notarization-report.json'),
      JSON.stringify({ mode: 'api-key', notarized: ['Jarvis-mac-arm64.dmg'] })
    )

    const manifest = buildManifest({ dir, version: '0.17.2' })
    assert.equal(manifest.artifacts[0].signed, true)
    assert.equal(manifest.signing.macos, 'api-key')
  })

  test('bookkeeping files never become release assets', () => {
    writeArtifact('Jarvis-win-x64.exe')
    fs.writeFileSync(path.join(dir, 'builder-debug.yml'), 'x')
    fs.writeFileSync(path.join(dir, '.signing-report.json'), '{}')

    const files = buildManifest({ dir, version: '0.17.2' }).artifacts.map(a => a.file)
    assert.deepEqual(files, ['Jarvis-win-x64.exe'])
  })

  test('records the commit so a tag can be traced back to a build', () => {
    writeArtifact('Jarvis-win-x64.exe')
    const manifest = buildManifest({ dir, version: '0.17.2', commit: 'abc123' })
    assert.equal(manifest.commit, 'abc123')
  })
})

describe('renderChecksums', () => {
  // `sha256sum -c` is strict about the two-space separator and the trailing
  // newline; getting either wrong makes the file useless to the user it is for.
  test('emits sha256sum -c compatible lines', () => {
    const manifest = {
      artifacts: [
        { file: 'a.exe', sha256: 'aa' },
        { file: 'b.dmg', sha256: 'bb' }
      ]
    }

    assert.equal(renderChecksums(manifest), 'aa  a.exe\nbb  b.dmg\n')
  })
})

describe('writeManifest', () => {
  test('writes both the manifest and the checksum file', () => {
    writeArtifact('Jarvis-win-x64.exe')
    const manifest = buildManifest({ dir, version: '0.17.2' })
    writeManifest(dir, manifest)

    assert.ok(fs.existsSync(path.join(dir, MANIFEST_FILENAME)))
    const sums = fs.readFileSync(path.join(dir, CHECKSUMS_FILENAME), 'utf8')
    assert.equal(sums, `${sha256File(path.join(dir, 'Jarvis-win-x64.exe'))}  Jarvis-win-x64.exe\n`)
  })
})
