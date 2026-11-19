/**
 * Native in-app installer downloader & SHA-256 verifier for installed Agent Czesiek builds.
 *
 * Downloads the selected GitHub Release installer directly into the app's local
 * updates cache, streams SHA-256 verification against `release-manifest.json` or
 * `SHA256SUMS.txt` when published on the release, and emits live progress events.
 */

import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import { isTrustedReleaseUrl, type ReleaseAssetInfo } from './release-check'

export type ReleaseDownloadStage = 'downloading' | 'verifying' | 'ready' | 'installing' | 'error'

export interface ReleaseDownloadProgress {
  stage: ReleaseDownloadStage
  receivedBytes: number
  totalBytes: number
  percent: number
  message?: string
}

export interface ReleaseDownloadResult {
  ok: boolean
  filePath?: string
  sha256?: string
  verified?: boolean
  error?: string
}

/** Sanitize a release asset filename to a safe single-segment basename. */
export function safeAssetFilename(name: string): string {
  const base = path.basename(name.trim()).replace(/[^A-Za-z0-9._-]/g, '_')

  if (!base || base === '.' || base === '..') {
    throw new Error('Invalid installer asset name.')
  }

  return base
}

/** Extract the expected lowercase SHA-256 hex digest for `assetName` from release-manifest.json or SHA256SUMS.txt. */
export function parseExpectedSha256(content: string, assetName: string): string | null {
  const target = path.basename(assetName).toLowerCase()

  try {
    const parsed = JSON.parse(content) as { artifacts?: Array<{ name?: unknown; sha256?: unknown }> }

    if (parsed && Array.isArray(parsed.artifacts)) {
      const hit = parsed.artifacts.find(
        item => typeof item?.name === 'string' && path.basename(item.name).toLowerCase() === target
      )

      if (hit && typeof hit.sha256 === 'string' && /^[a-f0-9]{64}$/i.test(hit.sha256.trim())) {
        return hit.sha256.trim().toLowerCase()
      }
    }
  } catch {
    // Fall through to SHA256SUMS.txt line parsing.
  }

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    const match = /^([a-f0-9]{64})\s+\*?(.+)$/i.exec(line)

    if (match && path.basename(match[2].trim()).toLowerCase() === target) {
      return match[1].toLowerCase()
    }
  }

  return null
}

async function fetchTrusted(url: string, fetchImpl: typeof fetch, signal?: AbortSignal): Promise<Response> {
  if (!isTrustedReleaseUrl(url)) {
    throw new Error('Refused to download from an untrusted release host.')
  }

  const response = await fetchImpl(url, {
    headers: { 'User-Agent': 'agent-czesiek-release-updater' },
    redirect: 'follow',
    signal
  })

  if (response.url && !isTrustedReleaseUrl(response.url)) {
    throw new Error('Release download redirected to an untrusted host.')
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  return response
}

export async function downloadAndVerifyReleaseAsset({
  asset,
  checksumsAsset,
  downloadDir,
  fetchImpl = fetch,
  onProgress,
  signal
}: {
  asset: ReleaseAssetInfo
  checksumsAsset?: null | ReleaseAssetInfo
  downloadDir: string
  fetchImpl?: typeof fetch
  onProgress?: (progress: ReleaseDownloadProgress) => void
  signal?: AbortSignal
}): Promise<ReleaseDownloadResult> {
  const filename = safeAssetFilename(asset.name)
  const finalPath = path.join(downloadDir, filename)
  const tempPath = path.join(downloadDir, `.${filename}.${process.pid}.${Date.now()}.part`)

  fs.mkdirSync(downloadDir, { recursive: true })

  let stream: fs.WriteStream | null = null

  try {
    onProgress?.({ stage: 'downloading', receivedBytes: 0, totalBytes: asset.size ?? 0, percent: 0 })

    const response = await fetchTrusted(asset.url, fetchImpl, signal)
    const headerTotal = Number(response.headers.get('content-length') || 0)
    const totalBytes = headerTotal > 0 ? headerTotal : (asset.size ?? 0)
    const hash = createHash('sha256')
    stream = fs.createWriteStream(tempPath, { mode: 0o600 })

    let receivedBytes = 0
    let lastEmit = 0

    if (response.body) {
      const reader = response.body.getReader()

      while (true) {
        const { done, value } = await reader.read()

        if (done) {
          break
        }

        if (value && value.byteLength > 0) {
          hash.update(value)
          await new Promise<void>((resolve, reject) => {
            if (!stream!.write(value)) {
              stream!.once('drain', resolve)
              stream!.once('error', reject)
            } else {
              resolve()
            }
          })
          receivedBytes += value.byteLength
          const now = Date.now()

          if (now - lastEmit >= 120 || (totalBytes > 0 && receivedBytes >= totalBytes)) {
            lastEmit = now
            const percent = totalBytes > 0 ? Math.min(100, Math.round((receivedBytes / totalBytes) * 100)) : 0
            onProgress?.({ stage: 'downloading', receivedBytes, totalBytes, percent })
          }
        }
      }
    } else {
      const buf = Buffer.from(await response.arrayBuffer())
      hash.update(buf)
      receivedBytes = buf.byteLength
      await new Promise<void>((resolve, reject) => {
        stream!.end(buf, (err?: Error | null) => (err ? reject(err) : resolve()))
      })
      stream = null
    }

    if (stream) {
      await new Promise<void>((resolve, reject) => {
        stream!.end((err?: Error | null) => (err ? reject(err) : resolve()))
      })
      stream = null
    }

    const actualSha256 = hash.digest('hex').toLowerCase()
    let verified = false

    if (checksumsAsset && isTrustedReleaseUrl(checksumsAsset.url)) {
      onProgress?.({ stage: 'verifying', receivedBytes, totalBytes: totalBytes || receivedBytes, percent: 100 })
      const checksumResponse = await fetchTrusted(checksumsAsset.url, fetchImpl, signal)
      const checksumText = await checksumResponse.text()
      const expected = parseExpectedSha256(checksumText, asset.name)

      if (expected) {
        if (expected !== actualSha256) {
          throw new Error('SHA-256 verification failed: the downloaded installer does not match the release checksum.')
        }

        verified = true
      }
    }

    fs.renameSync(tempPath, finalPath)
    onProgress?.({ stage: 'ready', receivedBytes, totalBytes: totalBytes || receivedBytes, percent: 100 })

    return { ok: true, filePath: finalPath, sha256: actualSha256, verified }
  } catch (error) {
    if (stream) {
      try {
        stream.destroy()
      } catch {
        // Ignore stream teardown error
      }
    }

    try {
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath)
      }
    } catch {
      // Ignore temp cleanup error
    }

    const message = error instanceof Error ? error.message : String(error)
    onProgress?.({ stage: 'error', receivedBytes: 0, totalBytes: 0, percent: 0, message })

    return { ok: false, error: message }
  }
}
