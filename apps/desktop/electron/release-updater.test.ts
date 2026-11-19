import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { downloadAndVerifyReleaseAsset, parseExpectedSha256, safeAssetFilename } from './release-updater'

const tempDirs: string[] = []

function makeTempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'czesiek-release-updater-'))
  tempDirs.push(dir)

  return dir
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()!
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

describe('release-updater', () => {
  it('parses SHA-256 digests from release-manifest.json and SHA256SUMS.txt', () => {
    const hash = 'a'.repeat(64)

    const manifest = JSON.stringify({
      artifacts: [{ name: 'AI-Evolution-Jarvis-0.18.0-win-x64.exe', sha256: hash }]
    })

    expect(parseExpectedSha256(manifest, 'AI-Evolution-Jarvis-0.18.0-win-x64.exe')).toBe(hash)

    const sums = `${hash}  AI-Evolution-Jarvis-0.18.0-win-x64.exe\n`
    expect(parseExpectedSha256(sums, 'AI-Evolution-Jarvis-0.18.0-win-x64.exe')).toBe(hash)
    expect(parseExpectedSha256(sums, 'other.exe')).toBeNull()
  })

  it('sanitizes asset filenames to a single safe segment', () => {
    expect(safeAssetFilename('../evil/setup.exe')).toBe('setup.exe')
  })

  it('downloads and verifies an installer against SHA256SUMS.txt', async () => {
    const payload = Buffer.from('installer-binary-content')
    const expectedHash = createHash('sha256').update(payload).digest('hex')
    const downloadDir = makeTempDir()
    const stages: string[] = []

    const fetchImpl: typeof fetch = async input => {
      const url = String(input)

      if (url.endsWith('SHA256SUMS.txt')) {
        return new Response(`${expectedHash}  Agent-Czesiek.exe\n`, { status: 200 })
      }

      return new Response(payload, {
        status: 200,
        headers: { 'content-length': String(payload.byteLength) }
      })
    }

    const result = await downloadAndVerifyReleaseAsset({
      asset: {
        name: 'Agent-Czesiek.exe',
        size: payload.byteLength,
        url: 'https://github.com/aievolutionpl/AGENT_CZESIEK/releases/download/v0.18.0/Agent-Czesiek.exe'
      },
      checksumsAsset: {
        name: 'SHA256SUMS.txt',
        url: 'https://github.com/aievolutionpl/AGENT_CZESIEK/releases/download/v0.18.0/SHA256SUMS.txt'
      },
      downloadDir,
      fetchImpl,
      onProgress: progress => stages.push(progress.stage)
    })

    expect(result.ok).toBe(true)
    expect(result.verified).toBe(true)
    expect(result.sha256).toBe(expectedHash)
    expect(result.filePath).toBe(path.join(downloadDir, 'Agent-Czesiek.exe'))
    expect(fs.readFileSync(result.filePath!)).toEqual(payload)
    expect(stages).toContain('downloading')
    expect(stages).toContain('verifying')
    expect(stages).toContain('ready')
  })

  it('rejects checksum mismatches and cleans up the partial file', async () => {
    const payload = Buffer.from('tampered-binary')
    const wrongHash = 'b'.repeat(64)
    const downloadDir = makeTempDir()

    const fetchImpl: typeof fetch = async input => {
      const url = String(input)

      if (url.endsWith('SHA256SUMS.txt')) {
        return new Response(`${wrongHash}  Agent-Czesiek.exe\n`, { status: 200 })
      }

      return new Response(payload, { status: 200 })
    }

    const result = await downloadAndVerifyReleaseAsset({
      asset: {
        name: 'Agent-Czesiek.exe',
        url: 'https://github.com/aievolutionpl/AGENT_CZESIEK/releases/download/v0.18.0/Agent-Czesiek.exe'
      },
      checksumsAsset: {
        name: 'SHA256SUMS.txt',
        url: 'https://github.com/aievolutionpl/AGENT_CZESIEK/releases/download/v0.18.0/SHA256SUMS.txt'
      },
      downloadDir,
      fetchImpl
    })

    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/SHA-256 verification failed/i)
    expect(fs.readdirSync(downloadDir)).toEqual([])
  })

  it('refuses untrusted download hosts', async () => {
    const downloadDir = makeTempDir()

    const result = await downloadAndVerifyReleaseAsset({
      asset: { name: 'Agent-Czesiek.exe', url: 'https://evil.example/Agent-Czesiek.exe' },
      downloadDir
    })

    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/untrusted release host/i)
  })
})
