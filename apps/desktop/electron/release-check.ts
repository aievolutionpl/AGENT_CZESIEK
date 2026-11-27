/**
 * "Is there a newer Agent Czesiek?" for installed builds.
 *
 * An installed app ships its own sealed engine (see bundled-runtime.ts), so it
 * has no git checkout to `fetch` and never updates by itself: the way forward
 * is a newer installer from the distribution repository's latest GitHub
 * Release. This module is the pure half — parse the release JSON, compare
 * versions, pick the right installer for this OS/CPU — so it is testable
 * without Electron or a network.
 */

export interface ReleaseAssetInfo {
  name: string
  size?: number
  url: string
}

export interface ReleaseCheckResult {
  /** Direct download for this platform, when the release carries one. */
  asset: null | ReleaseAssetInfo
  /** Checksum manifest or SHA256SUMS asset from the same release, when published. */
  checksumsAsset?: null | ReleaseAssetInfo
  currentVersion: string
  latestVersion: string
  /** First lines of the release notes, for a one-glance "what's new". */
  notes: string
  /** The release page — always present, the fallback when no asset matches. */
  pageUrl: string
  publishedAt: null | string
  updateAvailable: boolean
}

interface GithubAsset {
  browser_download_url?: unknown
  name?: unknown
  size?: unknown
}

interface GithubRelease {
  assets?: unknown
  body?: unknown
  draft?: unknown
  html_url?: unknown
  prerelease?: unknown
  published_at?: unknown
  tag_name?: unknown
}

const VERSION_RE = /^v?(\d+(?:\.\d+)+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/i

function parseVersion(value: string): { nums: number[]; pre: string[] } | null {
  const match = VERSION_RE.exec(value.trim())

  if (!match) {
    return null
  }

  const nums = match[1].split('.').map(part => Number(part))
  const pre = match[2] ? match[2].split('.') : []

  return { nums, pre }
}

function comparePrePart(a: string, b: string): number {
  const aNum = /^\d+$/.test(a)
  const bNum = /^\d+$/.test(b)

  if (aNum && bNum) {
    const diff = Number(a) - Number(b)

    return diff === 0 ? 0 : diff > 0 ? 1 : -1
  }

  if (aNum !== bNum) {
    return aNum ? -1 : 1
  }

  return a === b ? 0 : a > b ? 1 : -1
}

/** Numeric multi-segment (including 4-part) + SemVer pre-release comparison; unparsable compares as 0. */
export function compareVersions(a: string, b: string): number {
  const pa = parseVersion(a)
  const pb = parseVersion(b)

  if (!pa || !pb) {
    return 0
  }

  const len = Math.max(pa.nums.length, pb.nums.length)

  for (let i = 0; i < len; i += 1) {
    const diff = (pa.nums[i] ?? 0) - (pb.nums[i] ?? 0)

    if (diff !== 0) {
      return diff > 0 ? 1 : -1
    }
  }

  if (pa.pre.length === 0 && pb.pre.length === 0) {
    return 0
  }

  // Stable release (no pre-release) is newer than a pre-release of the same version.
  if (pa.pre.length === 0) {
    return 1
  }

  if (pb.pre.length === 0) {
    return -1
  }

  const preLen = Math.max(pa.pre.length, pb.pre.length)

  for (let i = 0; i < preLen; i += 1) {
    if (i >= pa.pre.length) {
      return -1
    }

    if (i >= pb.pre.length) {
      return 1
    }

    const diff = comparePrePart(pa.pre[i], pb.pre[i])

    if (diff !== 0) {
      return diff
    }
  }

  return 0
}

const TRUSTED_RELEASE_HOSTS = new Set([
  'github.com',
  'objects.githubusercontent.com',
  'release-assets.githubusercontent.com',
  'github-releases.githubusercontent.com'
])

export function isTrustedReleaseUrl(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false
  }

  try {
    const parsed = new URL(value)

    return parsed.protocol === 'https:' && TRUSTED_RELEASE_HOSTS.has(parsed.hostname.toLowerCase())
  } catch {
    return false
  }
}

function assetsOf(release: GithubRelease): ReleaseAssetInfo[] {
  if (!Array.isArray(release.assets)) {
    return []
  }

  return release.assets.flatMap((raw: GithubAsset) =>
    typeof raw?.name === 'string' && isTrustedReleaseUrl(raw.browser_download_url) && !/\.blockmap$/i.test(raw.name)
      ? [{ name: raw.name, size: typeof raw.size === 'number' ? raw.size : undefined, url: raw.browser_download_url }]
      : []
  )
}

const ARCH_ARM = /arm64|aarch64|apple/i
const ARCH_X64 = /x64|x86_64|intel|amd64/i
const ARCH_UNIVERSAL = /universal/i

function pickByArch(
  candidates: readonly ReleaseAssetInfo[],
  arch: string,
  allowOppositeFallback: boolean
): null | ReleaseAssetInfo {
  if (candidates.length === 0) {
    return null
  }

  const target = arch === 'arm64' ? ARCH_ARM : ARCH_X64
  const opposite = arch === 'arm64' ? ARCH_X64 : ARCH_ARM
  const exact = candidates.find(asset => target.test(asset.name))

  if (exact) {
    return exact
  }

  const universal = candidates.find(asset => ARCH_UNIVERSAL.test(asset.name))

  if (universal) {
    return universal
  }

  const neutral = candidates.find(asset => !opposite.test(asset.name))

  if (neutral) {
    return neutral
  }

  return allowOppositeFallback ? candidates[0] : null
}

/** The installer for this OS and CPU; null when the release has none (callers fall back to the page). */
export function pickInstallerAsset(
  assets: readonly ReleaseAssetInfo[],
  platform: string,
  arch: string
): null | ReleaseAssetInfo {
  const named = (re: RegExp) => assets.filter(asset => re.test(asset.name))

  if (platform === 'win32') {
    return pickByArch(named(/\.exe$/i), arch, true) ?? pickByArch(named(/\.msi$/i), arch, true) ?? null
  }

  if (platform === 'darwin') {
    // Never hand an arm64 DMG to an Intel Mac (or vice versa) unless it is universal/arch-neutral.
    return pickByArch(named(/\.dmg$/i), arch, false)
  }

  return (
    pickByArch(named(/\.AppImage$/i), arch, true) ??
    pickByArch(named(/\.deb$/i), arch, true) ??
    pickByArch(named(/\.rpm$/i), arch, true) ??
    null
  )
}

export function pickChecksumsAsset(assets: readonly ReleaseAssetInfo[]): null | ReleaseAssetInfo {
  return (
    assets.find(asset => /^release-manifest\.json$/i.test(asset.name)) ??
    assets.find(asset => /^sha256sums(?:\.txt)?$/i.test(asset.name)) ??
    null
  )
}

function firstLines(body: unknown, max = 6): string {
  return typeof body === 'string'
    ? body
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .slice(0, max)
        .join('\n')
    : ''
}

/** Turn one `releases/latest` payload into the answer the UI needs; throws on a payload that is not a usable release. */
export function evaluateRelease(
  payload: unknown,
  { arch, currentVersion, platform }: { arch: string; currentVersion: string; platform: string }
): ReleaseCheckResult {
  const release = (payload ?? {}) as GithubRelease
  const tag = typeof release.tag_name === 'string' ? release.tag_name : ''

  if (
    !tag ||
    !VERSION_RE.test(tag) ||
    !isTrustedReleaseUrl(release.html_url) ||
    release.draft === true ||
    release.prerelease === true
  ) {
    throw new Error('Latest release is missing, a draft, or has no version tag.')
  }

  const assets = assetsOf(release)

  return {
    asset: pickInstallerAsset(assets, platform, arch),
    checksumsAsset: pickChecksumsAsset(assets),
    currentVersion,
    latestVersion: tag.replace(/^v/i, ''),
    notes: firstLines(release.body),
    pageUrl: release.html_url,
    publishedAt: typeof release.published_at === 'string' ? release.published_at : null,
    updateAvailable: compareVersions(tag, currentVersion) > 0
  }
}
