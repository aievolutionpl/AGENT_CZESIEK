import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'

import { Button } from '@/components/ui/button'
import type { DesktopReleaseCheck } from '@/global'
import { useI18n } from '@/i18n'
import { Download, X } from '@/lib/icons'

const DISMISSED_KEY = 'czesiek.dismissed-release-update.v1'

let startupChecked = false
let cachedStartupRelease: DesktopReleaseCheck | null = null

/**
 * Quiet startup update banner for installed builds: checks GitHub Releases once
 * per app session and shows a dismissible strip when a newer Agent Czesiek is ready.
 */
export function ReleaseUpdateBanner() {
  const { locale } = useI18n()
  const navigate = useNavigate()
  const [release, setRelease] = useState<DesktopReleaseCheck | null>(cachedStartupRelease)

  const [dismissedVersion, setDismissedVersion] = useState<string | null>(() => {
    try {
      return window.localStorage.getItem(DISMISSED_KEY)
    } catch {
      return null
    }
  })

  useEffect(() => {
    if (startupChecked) {
      return
    }

    const check = window.hermesDesktop?.updates?.releaseCheck

    if (!check) {
      return
    }

    startupChecked = true
    let active = true

    void check()
      .then(result => {
        cachedStartupRelease = result

        if (active) {
          setRelease(result)
        }
      })
      .catch(() => {
        // Silent background check — errors are surfaced in Settings -> About.
      })

    return () => {
      active = false
    }
  }, [])

  if (release?.ok !== true || !release.updateAvailable || dismissedVersion === release.latestVersion) {
    return null
  }

  const pl = locale === 'pl'

  const dismiss = () => {
    setDismissedVersion(release.latestVersion)

    try {
      window.localStorage.setItem(DISMISSED_KEY, release.latestVersion)
    } catch {
      // Ignore storage failures
    }
  }

  return (
    <div
      className="mx-3 mt-2 flex items-center justify-between gap-3 rounded-xl border border-primary/25 bg-primary/10 px-3 py-2 text-xs text-foreground backdrop-blur-md"
      data-testid="release-update-banner"
      role="status"
    >
      <div className="flex min-w-0 items-center gap-2">
        <Download className="size-3.5 shrink-0 text-primary" />
        <span className="truncate font-medium">
          {pl
            ? `Dostępna jest nowa wersja Agent Czesiek (${release.latestVersion}).`
            : `A new version of Agent Czesiek (${release.latestVersion}) is available.`}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <Button onClick={() => navigate('/settings?tab=about')} size="sm" variant="default">
          {pl ? 'Aktualizuj' : 'Update'}
        </Button>
        <Button
          aria-label={pl ? 'Ukryj powiadomienie o aktualizacji' : 'Dismiss update notice'}
          onClick={dismiss}
          size="icon-sm"
          variant="ghost"
        >
          <X className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}
