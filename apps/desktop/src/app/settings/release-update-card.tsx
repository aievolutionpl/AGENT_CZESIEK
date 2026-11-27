import { useCallback, useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import type { DesktopReleaseCheck, DesktopReleaseDownloadProgress } from '@/global'
import { useI18n } from '@/i18n'
import { CheckCircle2, Download, ExternalLink, Loader2, RefreshCw } from '@/lib/icons'
import { cn } from '@/lib/utils'

const COPY = {
  en: {
    check: 'Check for updates',
    checking: 'Checking…',
    download: 'Download installer',
    downloadAndInstall: 'Download & install',
    downloading: (pct: number) => (pct > 0 ? `Downloading installer (${pct}%)…` : 'Downloading installer…'),
    verifying: 'Verifying SHA-256 checksum…',
    launching: 'Creating backup & starting installer…',
    launched: 'Installer opened — follow the on-screen steps. Your profile and data stay intact.',
    downloadFailed: (err: string) => `In-app download failed (${err}). You can still open the release page.`,
    latest: (v: string) => `You have the latest version (${v}).`,
    notes: 'See what changed',
    noRelease: 'No published release was found. The repository may be private or have no release yet.',
    openPage: 'Open releases page',
    retry: 'Could not check for updates. Check your connection and try again.',
    title: 'Updates for this installed app',
    available: (latest: string, current: string) => `Version ${latest} is available (you have ${current}).`,
    hint: 'Installed builds update by installing a newer installer; your profile and data stay.'
  },
  pl: {
    check: 'Sprawdź aktualizacje',
    checking: 'Sprawdzam…',
    download: 'Pobierz instalator',
    downloadAndInstall: 'Pobierz i zainstaluj',
    downloading: (pct: number) => (pct > 0 ? `Pobieram instalator (${pct}%)…` : 'Pobieram instalator…'),
    verifying: 'Weryfikuję sumę kontrolną SHA-256…',
    launching: 'Tworzę kopię bezpieczeństwa i uruchamiam instalator…',
    launched: 'Instalator został uruchomiony — dokończ aktualizację w jego oknie. Profil i dane zostają.',
    downloadFailed: (err: string) => `Nie udało się pobrać w aplikacji (${err}). Możesz otworzyć stronę wydania.`,
    latest: (v: string) => `Masz najnowszą wersję (${v}).`,
    notes: 'Zobacz, co się zmieniło',
    noRelease: 'Nie znaleziono opublikowanego wydania. Repozytorium może być prywatne albo nie ma jeszcze wydania.',
    openPage: 'Otwórz stronę wydań',
    retry: 'Nie udało się sprawdzić aktualizacji. Sprawdź połączenie i spróbuj ponownie.',
    title: 'Aktualizacje zainstalowanej aplikacji',
    available: (latest: string, current: string) => `Dostępna jest wersja ${latest} (masz ${current}).`,
    hint: 'Zainstalowana aplikacja aktualizuje się przez nowszy instalator; profil i dane zostają.'
  }
} as const

const open = (url: string) => void window.hermesDesktop?.openExternal?.(url)

/**
 * The update card for installed builds (no git checkout to pull from): reads
 * the distribution repository's latest GitHub Release and offers one-click
 * in-app download + SHA-256 verification + installer launch (with browser fallback).
 */
export function ReleaseUpdateCard() {
  const { locale } = useI18n()
  const copy = locale === 'pl' ? COPY.pl : COPY.en
  const [result, setResult] = useState<DesktopReleaseCheck | null>(null)
  const [checking, setChecking] = useState(false)
  const [progress, setProgress] = useState<DesktopReleaseDownloadProgress | null>(null)
  const [busyInstall, setBusyInstall] = useState(false)
  const [installMessage, setInstallMessage] = useState<string | null>(null)
  const [installError, setInstallError] = useState<string | null>(null)

  const run = useCallback(async () => {
    const check = window.hermesDesktop?.updates?.releaseCheck

    if (!check) {
      return
    }

    setChecking(true)
    setInstallError(null)

    try {
      setResult(await check())
    } finally {
      setChecking(false)
    }
  }, [])

  useEffect(() => {
    void run()
  }, [run])

  useEffect(() => {
    const subscribe = window.hermesDesktop?.updates?.onReleaseProgress

    if (!subscribe) {
      return
    }

    return subscribe(next => {
      setProgress(next)
    })
  }, [])

  const available = result?.ok === true && result.updateAvailable
  const failed = result !== null && !result.ok

  const canInAppDownload = Boolean(
    result?.ok === true &&
    result.asset &&
    window.hermesDesktop?.updates?.releaseDownload &&
    window.hermesDesktop?.updates?.releaseInstall
  )

  const startInAppUpdate = useCallback(async () => {
    if (result?.ok !== true || !result.asset) {
      return
    }

    const download = window.hermesDesktop?.updates?.releaseDownload
    const install = window.hermesDesktop?.updates?.releaseInstall

    if (!download || !install) {
      open(result.asset.url)

      return
    }

    setBusyInstall(true)
    setInstallError(null)
    setInstallMessage(null)
    setProgress({ stage: 'downloading', receivedBytes: 0, totalBytes: result.asset.size ?? 0, percent: 0 })

    try {
      const dl = await download({
        asset: result.asset,
        checksumsAsset: result.checksumsAsset ?? null
      })

      if (!dl.ok || !dl.filePath) {
        setInstallError(copy.downloadFailed(dl.error || 'unknown error'))

        return
      }

      setProgress({ stage: 'installing', receivedBytes: 1, totalBytes: 1, percent: 100 })
      const launched = await install({ filePath: dl.filePath, prepareRecovery: true })

      if (!launched.ok) {
        setInstallError(copy.downloadFailed(launched.error || 'could not launch installer'))

        return
      }

      setInstallMessage(copy.launched)
    } catch (error) {
      setInstallError(copy.downloadFailed(error instanceof Error ? error.message : String(error)))
    } finally {
      setBusyInstall(false)
    }
  }, [copy, result])

  return (
    <div
      className={cn(
        'rounded-xl px-4 py-3 text-sm',
        available ? 'bg-primary/8 text-foreground' : failed ? 'bg-destructive/6 text-foreground' : 'bg-muted/25'
      )}
      data-testid="release-update-card"
    >
      <p className="text-xs font-medium text-muted-foreground">{copy.title}</p>
      <div className="mt-2 flex items-start gap-2">
        {result?.ok === true && !available ? (
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
        ) : null}
        <p className="font-medium">
          {checking && !result
            ? copy.checking
            : result === null
              ? copy.hint
              : result.ok
                ? available
                  ? copy.available(result.latestVersion, result.currentVersion)
                  : copy.latest(result.currentVersion)
                : result.reason === 'no-release'
                  ? copy.noRelease
                  : copy.retry}
        </p>
      </div>

      {result?.ok === true && available && result.notes ? (
        <p className="mt-2 line-clamp-4 whitespace-pre-line text-xs text-muted-foreground">{result.notes}</p>
      ) : null}

      {busyInstall && progress ? (
        <div className="mt-3 space-y-1.5">
          <p className="text-xs text-muted-foreground">
            {progress.stage === 'verifying'
              ? copy.verifying
              : progress.stage === 'installing'
                ? copy.launching
                : copy.downloading(progress.percent)}
          </p>
          <Progress value={progress.percent} />
        </div>
      ) : null}

      {installMessage ? <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">{installMessage}</p> : null}
      {installError ? <p className="mt-2 text-xs text-destructive">{installError}</p> : null}

      <div className="mt-3 flex flex-wrap items-center gap-4">
        <Button disabled={checking || busyInstall} onClick={() => void run()} size="sm" variant="textStrong">
          {checking ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
          {checking ? copy.checking : copy.check}
        </Button>

        {result?.ok === true && available ? (
          <>
            {canInAppDownload ? (
              <Button disabled={busyInstall} onClick={() => void startInAppUpdate()} size="sm">
                {busyInstall ? <Loader2 className="size-3 animate-spin" /> : <Download className="size-3" />}
                {copy.downloadAndInstall}
              </Button>
            ) : (
              <Button onClick={() => open(result.asset?.url ?? result.pageUrl)} size="sm">
                {copy.download}
              </Button>
            )}
            <Button onClick={() => open(result.pageUrl)} size="sm" variant="textStrong">
              <ExternalLink className="size-3" />
              {copy.notes}
            </Button>
          </>
        ) : null}

        {result && !result.ok && result.reason === 'no-release' ? (
          <Button onClick={() => open(result.pageUrl)} size="sm" variant="textStrong">
            <ExternalLink className="size-3" />
            {copy.openPage}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
