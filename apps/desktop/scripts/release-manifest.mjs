#!/usr/bin/env node
/**
 * release-manifest.mjs — turn a release/ directory into the two files the
 * release gate and our users both need:
 *
 *   SHA256SUMS.txt        `sha256sum -c`-compatible, so a user can verify a
 *                         download with the tool already on their machine.
 *   release-manifest.json the structured form the gate reads: per-artifact
 *                         platform/arch/kind/size/digest, plus whether the
 *                         artifact carries a signature.
 *
 * Signature state is NOT re-derived here — it is read from the reports the
 * signing steps wrote (.signing-report.json on Windows, .notarization-report.json
 * on macOS). A manifest that inferred "signed" from the filename would happily
 * bless an unsigned installer.
 *
 * Usage:
 *   node scripts/release-manifest.mjs --dir release --version 0.17.2
 */

import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import { isMain } from './utils.mjs'
import { readSigningReport, SIGNING_REPORT_FILENAME } from './sign-windows.mjs'

export const NOTARIZATION_REPORT_FILENAME = '.notarization-report.json'
export const MANIFEST_FILENAME = 'release-manifest.json'
export const CHECKSUMS_FILENAME = 'SHA256SUMS.txt'

/** Internal bookkeeping that must never be published as a release asset. */
export const NON_ARTIFACT_FILES = new Set([
  SIGNING_REPORT_FILENAME,
  NOTARIZATION_REPORT_FILENAME,
  MANIFEST_FILENAME,
  CHECKSUMS_FILENAME,
  'builder-debug.yml',
  'builder-effective-config.yaml',
  '.icon-ico',
  '.icon-icns'
])

/**
 * Artifacts that are small by design, so the release gate's truncation floor
 * must not apply to them. A `latest-*.yml` index is under a kilobyte and a
 * `.blockmap` is a couple of hundred — the floor exists to catch a truncated
 * *installer*, and a release whose installers are all intact must not fail
 * because a sidecar is legitimately tiny. Kept here, next to the kinds
 * themselves, so the gate and its tests share one source of truth.
 */
export const SIZE_FLOOR_EXEMPT_KINDS = new Set(['blockmap', 'update-metadata'])

/**
 * Artifact kinds we publish, in the order a human reads them. `platform` and
 * `signable` drive the gate: only platforms whose OS enforces code signature
 * checks at launch (Windows SmartScreen, macOS Gatekeeper) are required to be
 * signed — Linux packages are verified by checksum instead.
 */
const KIND_RULES = [
  { ext: '.exe', platform: 'win', kind: 'nsis', signable: true },
  { ext: '.msi', platform: 'win', kind: 'msi', signable: true },
  { ext: '.dmg', platform: 'mac', kind: 'dmg', signable: true },
  { ext: '.pkg', platform: 'mac', kind: 'pkg', signable: true },
  { ext: '.appimage', platform: 'linux', kind: 'appimage', signable: false },
  { ext: '.deb', platform: 'linux', kind: 'deb', signable: false },
  { ext: '.rpm', platform: 'linux', kind: 'rpm', signable: false },
  { ext: '.snap', platform: 'linux', kind: 'snap', signable: false },
  { ext: '.blockmap', platform: null, kind: 'blockmap', signable: false },
  { ext: '.yml', platform: null, kind: 'update-metadata', signable: false },
  { ext: '.yaml', platform: null, kind: 'update-metadata', signable: false }
]

/**
 * Classify one artifact filename.
 *
 * `.zip` is deliberately not in KIND_RULES: electron-builder emits a mac zip
 * (the auto-update payload) AND, on other targets, unrelated archives. The
 * arch/platform hints in our artifactName template are what disambiguate it.
 */
export function classifyArtifact(filename) {
  const lower = filename.toLowerCase()
  const ext = path.extname(lower)

  let rule = KIND_RULES.find(candidate => candidate.ext === ext)
  if (!rule && ext === '.zip') {
    rule = { ext: '.zip', platform: lower.includes('mac') ? 'mac' : null, kind: 'zip', signable: false }
  }

  if (!rule) {
    return null
  }

  return {
    platform: rule.platform ?? detectPlatform(lower),
    arch: detectArch(lower),
    kind: rule.kind,
    signable: rule.signable
  }
}

function detectPlatform(lower) {
  if (lower.includes('win')) return 'win'
  if (lower.includes('mac') || lower.includes('darwin')) return 'mac'
  if (lower.includes('linux')) return 'linux'

  return null
}

/**
 * arm64 is checked before x64 on purpose: electron-builder's universal mac
 * artifacts carry both tokens, and the arm64 slice is the one whose absence
 * users notice (every Mac sold since 2020).
 */
export function detectArch(filename) {
  const lower = filename.toLowerCase()
  if (lower.includes('universal')) return 'universal'
  if (lower.includes('arm64') || lower.includes('aarch64')) return 'arm64'
  if (lower.includes('x64') || lower.includes('x86_64') || lower.includes('amd64')) return 'x64'
  if (lower.includes('ia32') || lower.includes('i386')) return 'ia32'

  return null
}

export function sha256File(file, readFile = fs.readFileSync) {
  return createHash('sha256').update(readFile(file)).digest('hex')
}

/** Both Mac builds produce latest-mac.yml. Rebuild it from the packaged files
 * after downloading the two legs, before calculating the published checksums. */
export async function writeMacUpdateIndex(dir, version, now = new Date()) {
  const names = fs.readdirSync(dir)
  const files = []
  for (const arch of ['x64', 'arm64']) {
    for (const extension of ['zip', 'dmg']) {
      const suffix = `-${version}-mac-${arch}.${extension}`
      const matches = names.filter(name => name.endsWith(suffix))
      if (matches.length !== 1) throw new Error(`Expected one macOS package ending in ${suffix}, found ${matches.length}`)
      const [url] = matches
      const source = path.join(dir, url)
      const hash = createHash('sha512')
      for await (const chunk of fs.createReadStream(source)) hash.update(chunk)
      files.push({ url, sha512: hash.digest('base64'), size: fs.statSync(source).size })
    }
  }

  // Older clients use the Intel ZIP in path. Current clients select the
  // architecture-specific ZIP from files. JSON is also valid YAML.
  const { url, sha512 } = files[0]
  const index = { version, files, path: url, sha512, releaseDate: now.toISOString() }
  fs.writeFileSync(path.join(dir, 'latest-mac.yml'), JSON.stringify(index, null, 2) + '\n')
}

function readNotarizationReport(dir, readFile = fs.readFileSync) {
  try {
    return JSON.parse(readFile(path.join(dir, NOTARIZATION_REPORT_FILENAME), 'utf8'))
  } catch {
    return null
  }
}

/**
 * Build the manifest for `dir`.
 *
 * `version` is recorded so the gate can cross-check it against the git tag —
 * publishing a v0.18.0 tag whose assets were built from 0.17.2 is a real and
 * silent failure mode when the build and tag steps drift apart.
 */
export function buildManifest({ dir, version, commit = '', now = () => new Date() }) {
  const entries = fs
    .readdirSync(dir)
    .filter(name => !NON_ARTIFACT_FILES.has(name))
    .filter(name => {
      try {
        return fs.statSync(path.join(dir, name)).isFile()
      } catch {
        return false
      }
    })
    .sort()

  const signingReport = readSigningReport(dir)
  const notarization = readNotarizationReport(dir)
  const signedWindows = new Set(signingReport?.signed ?? [])
  const notarizedMac = new Set(notarization?.notarized ?? [])

  const artifacts = []
  for (const name of entries) {
    const classified = classifyArtifact(name)
    if (!classified) {
      continue
    }

    const full = path.join(dir, name)
    const signed =
      classified.platform === 'win'
        ? signedWindows.has(name)
        : classified.platform === 'mac'
          ? notarizedMac.has(name)
          : false

    artifacts.push({
      file: name,
      platform: classified.platform,
      arch: classified.arch,
      kind: classified.kind,
      signable: classified.signable,
      signed,
      size: fs.statSync(full).size,
      sha256: sha256File(full)
    })
  }

  return {
    schemaVersion: 1,
    product: 'AI Evolution Jarvis',
    version,
    commit,
    generatedAt: now().toISOString(),
    signing: {
      windows: signingReport?.mode ?? 'none',
      macos: notarization?.mode ?? 'none'
    },
    artifacts
  }
}

/** `sha256sum -c SHA256SUMS.txt` must accept this verbatim. */
export function renderChecksums(manifest) {
  return `${manifest.artifacts.map(artifact => `${artifact.sha256}  ${artifact.file}`).join('\n')}\n`
}

export function writeManifest(dir, manifest) {
  fs.writeFileSync(path.join(dir, MANIFEST_FILENAME), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  fs.writeFileSync(path.join(dir, CHECKSUMS_FILENAME), renderChecksums(manifest), 'utf8')
}

function parseArgs(argv) {
  const args = { dir: 'release', version: '', commit: process.env.GITHUB_SHA || '' }
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--dir' && argv[i + 1]) {
      args.dir = argv[i + 1]
      i += 1
    } else if (argv[i] === '--version' && argv[i + 1]) {
      args.version = argv[i + 1]
      i += 1
    } else if (argv[i] === '--commit' && argv[i + 1]) {
      args.commit = argv[i + 1]
      i += 1
    }
  }

  return args
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const dir = path.resolve(args.dir)

  let version = args.version
  if (!version) {
    const pkg = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '..', 'package.json'), 'utf8'))
    version = pkg.version
  }

  if (process.argv.includes('--mac-update-index')) await writeMacUpdateIndex(dir, version)
  const manifest = buildManifest({ dir, version, commit: args.commit })
  writeManifest(dir, manifest)

  console.log(`[release-manifest] ${manifest.artifacts.length} artifact(s) for v${version}`)
  for (const artifact of manifest.artifacts) {
    const mark = artifact.signable ? (artifact.signed ? 'signed  ' : 'UNSIGNED') : '—       '
    console.log(`  ${mark} ${artifact.file} (${artifact.sha256.slice(0, 12)}…)`)
  }
}

if (isMain(import.meta.url)) {
  await main()
}
