/**
 * desktop-shortcut.ts
 *
 * The icon on the user's desktop — the one thing every non-technical install
 * is judged by, and the one thing no single install channel can guarantee.
 * The Windows installer makes one; a portable zip, an AppImage, a DMG drag and
 * a locally built tree make none. So the app owns it: on first run it puts the
 * icon where the user expects it, and Settings can put it back later.
 *
 * Electron-free on purpose (same rule as desktop-uninstall.ts / app-icon.ts):
 * everything that decides WHAT gets written lives here and is unit-testable
 * without booting Electron; main.ts injects the real filesystem and, on
 * Windows, Electron's own `shell.writeShortcutLink`.
 *
 * Per platform, what "an icon on the desktop" actually means:
 *   - win32  → a real `.lnk`, written by the Windows shell API, pointing at
 *              the running exe with the sidecar `icon.ico` for its face.
 *   - linux  → an XDG `.desktop` launcher in the desktop directory, marked
 *              executable (several shells refuse to offer a non-executable
 *              one) and AppImage-aware: `process.execPath` inside an AppImage
 *              points into a temporary mount that will not exist tomorrow.
 *   - darwin → a symlink to the `.app` bundle. macOS convention is
 *              /Applications plus the Dock, so this is never created on its
 *              own — only when the user asks for it.
 */

import path from 'node:path'

export type DesktopShortcutKind = 'alias' | 'desktop-entry' | 'lnk'

export type DesktopShortcutStatus = 'created' | 'exists' | 'failed' | 'replaced' | 'unsupported'

export interface DesktopShortcutResult {
  /** Absolute path of the shortcut, when one was located or written. */
  path?: string
  /** Machine-readable cause when `status` is 'failed'. Never shown raw. */
  reason?: string
  status: DesktopShortcutStatus
}

/** Platforms whose desktop icon is created without being asked. */
const AUTO_CREATE_KINDS: readonly DesktopShortcutKind[] = ['desktop-entry', 'lnk']

export function desktopShortcutKind(platform: NodeJS.Platform): DesktopShortcutKind {
  if (platform === 'win32') {
    return 'lnk'
  }

  return platform === 'darwin' ? 'alias' : 'desktop-entry'
}

/** A file name from the product name: readable on Windows/macOS, slugged for XDG. */
export function desktopShortcutFileName(productName: string, kind: DesktopShortcutKind): string {
  const name = productName.trim() || 'Jarvis'

  if (kind === 'lnk') {
    return `${name}.lnk`
  }

  if (kind === 'alias') {
    return `${name}.app`
  }

  const slug =
    name
      .toLocaleLowerCase('en-US')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'jarvis'

  return `${slug}.desktop`
}

export interface LaunchTargetInput {
  /** `process.env` — read for AppImage's own path. */
  env: Record<string, string | undefined>
  /** `process.execPath`. */
  execPath: string
  platform: NodeJS.Platform
}

export interface LaunchTarget {
  /** What the shortcut launches. */
  exec: string
  /** Directory the launched process starts in. */
  workingDirectory: string
}

/**
 * What the shortcut should point at.
 *
 * An AppImage runs from a temporary mount (`/tmp/.mount_XXXX/…`) that is gone
 * the moment the app exits, so a shortcut aimed at `execPath` would be dead on
 * the first reboot. `APPIMAGE` carries the real file the user downloaded.
 *
 * On macOS the executable lives at `Foo.app/Contents/MacOS/Foo`; the thing
 * worth linking to is the bundle three levels up, not the inner binary.
 */
export function resolveLaunchTarget({ env, execPath, platform }: LaunchTargetInput): LaunchTarget {
  const appImage = String(env.APPIMAGE ?? '').trim()

  if (platform === 'linux' && appImage) {
    return { exec: appImage, workingDirectory: path.dirname(appImage) }
  }

  if (platform === 'darwin') {
    const marker = `${path.sep}Contents${path.sep}MacOS${path.sep}`
    const index = execPath.lastIndexOf(marker)
    const bundle = index > 0 ? execPath.slice(0, index) : execPath

    return { exec: bundle, workingDirectory: path.dirname(bundle) }
  }

  return { exec: execPath, workingDirectory: path.dirname(execPath) }
}

/** Quote one `Exec=` argument per the XDG desktop-entry spec. */
export function quoteDesktopExecArg(arg: string): string {
  if (!/[\s"'\\><~|&;$*?#()`]/.test(arg)) {
    return arg
  }

  return `"${arg.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

export interface DesktopEntryInput {
  comment: string
  exec: string
  /** Absolute file, or a themed icon name when no file is available. */
  icon: string
  name: string
  /** Matches the window class so the launcher groups the running window. */
  wmClass: string
}

export function renderDesktopEntry({ comment, exec, icon, name, wmClass }: DesktopEntryInput): string {
  return [
    '[Desktop Entry]',
    'Type=Application',
    'Version=1.0',
    `Name=${name}`,
    `Comment=${comment}`,
    `Exec=${quoteDesktopExecArg(exec)} %U`,
    `Icon=${icon}`,
    'Terminal=false',
    'Categories=Utility;Development;',
    'StartupNotify=true',
    `StartupWMClass=${wmClass}`,
    ''
  ].join('\n')
}

/**
 * The filesystem this module is allowed to touch, injected so every decision
 * above can be proven without writing to a real desktop.
 *
 * `writeLink` is Electron's `shell.writeShortcutLink` on Windows and absent
 * everywhere else; `symlink` is only used for the macOS alias.
 */
export interface DesktopShortcutIo {
  chmod: (filePath: string, mode: number) => void
  exists: (filePath: string) => boolean
  symlink?: (target: string, linkPath: string) => void
  writeFile: (filePath: string, contents: string) => void
  writeLink?: (
    linkPath: string,
    options: { cwd: string; description: string; icon?: string; target: string }
  ) => boolean
}

export interface EnsureDesktopShortcutInput {
  comment: string
  desktopDir: string
  /** Replace a shortcut that is already there (the Settings button). */
  force?: boolean
  /** Absolute icon file; falls back to a themed name on Linux when missing. */
  iconPath?: string
  productName: string
  target: LaunchTarget
  /** Linux window class, so the launcher groups the running window. */
  wmClass?: string
}

/**
 * Put the icon on the desktop, or explain why it is not there.
 *
 * An existing shortcut is left alone unless `force` — a user who moved or
 * renamed theirs has decided where it lives, and a launch is not the moment to
 * overrule them.
 */
export function ensureDesktopShortcut(
  input: EnsureDesktopShortcutInput,
  io: DesktopShortcutIo,
  platform: NodeJS.Platform = process.platform
): DesktopShortcutResult {
  const kind = desktopShortcutKind(platform)
  const shortcutPath = path.join(input.desktopDir, desktopShortcutFileName(input.productName, kind))

  if (!input.force && io.exists(shortcutPath)) {
    return { path: shortcutPath, status: 'exists' }
  }

  // A machine with no desktop directory (a bare tiling WM, a server session)
  // does not get one invented for it — an icon in a folder nobody opens is
  // not an icon, and creating `~/Desktop` is not ours to decide.
  if (!io.exists(input.desktopDir)) {
    return { reason: 'no-desktop-dir', status: 'unsupported' }
  }

  const alreadyThere = io.exists(shortcutPath)

  try {
    if (kind === 'lnk') {
      if (!io.writeLink) {
        return { reason: 'no-shell-api', status: 'unsupported' }
      }

      const written = io.writeLink(shortcutPath, {
        cwd: input.target.workingDirectory,
        description: input.comment,
        icon: input.iconPath,
        target: input.target.exec
      })

      if (!written) {
        return { reason: 'shell-refused', status: 'failed' }
      }
    } else if (kind === 'alias') {
      if (!io.symlink) {
        return { reason: 'no-symlink', status: 'unsupported' }
      }

      io.symlink(input.target.exec, shortcutPath)
    } else {
      io.writeFile(
        shortcutPath,
        renderDesktopEntry({
          comment: input.comment,
          exec: input.target.exec,
          // A themed name keeps working when the icon file moves with an
          // update; an absolute path is only used when we actually have one.
          icon: input.iconPath ?? desktopShortcutFileName(input.productName, 'desktop-entry').replace(/\.desktop$/, ''),
          name: input.productName,
          wmClass: input.wmClass ?? input.productName
        })
      )
      // GNOME, KDE and Xfce all refuse to offer a launcher that is not
      // executable — without this the user gets a text file on their desktop.
      io.chmod(shortcutPath, 0o755)
    }
  } catch (error) {
    return { reason: (error as Error)?.message || 'write-failed', status: 'failed' }
  }

  return { path: shortcutPath, status: alreadyThere ? 'replaced' : 'created' }
}

export interface AutoCreateInput {
  /** True once this installation has had its one automatic attempt. */
  attempted: boolean
  platform: NodeJS.Platform
}

/**
 * Whether first run should create the icon by itself.
 *
 * Exactly once per installation, and never on macOS, where a desktop icon is
 * not the convention (the DMG already points at /Applications). A user who
 * deletes the icon has answered the question — the marker makes sure a later
 * launch does not put it back.
 */
export function shouldAutoCreateDesktopShortcut({ attempted, platform }: AutoCreateInput): boolean {
  return !attempted && AUTO_CREATE_KINDS.includes(desktopShortcutKind(platform))
}
