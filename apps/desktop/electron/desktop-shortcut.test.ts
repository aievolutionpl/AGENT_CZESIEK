import assert from 'node:assert/strict'
import path from 'node:path'

import { test } from 'vitest'

import {
  desktopShortcutFileName,
  type DesktopShortcutIo,
  desktopShortcutKind,
  ensureDesktopShortcut,
  quoteDesktopExecArg,
  renderDesktopEntry,
  resolveLaunchTarget,
  shouldAutoCreateDesktopShortcut
} from './desktop-shortcut'

function recordingIo(
  present: string[] = ['/home/ada/Pulpit', '/home/ada/Desktop', 'C:\\Users\\Ada\\Desktop', '/read-only/Desktop']
) {
  const files = new Map<string, string>()
  const chmods = new Map<string, number>()
  const links = new Map<string, { cwd: string; description: string; icon?: string; target: string }>()
  const symlinks = new Map<string, string>()
  const existing = new Set(present)

  const io: DesktopShortcutIo = {
    chmod: (filePath, mode) => void chmods.set(filePath, mode),
    exists: filePath => existing.has(filePath) || files.has(filePath) || links.has(filePath) || symlinks.has(filePath),
    symlink: (target, linkPath) => void symlinks.set(linkPath, target),
    writeFile: (filePath, contents) => void files.set(filePath, contents),
    writeLink: (linkPath, options) => {
      links.set(linkPath, options)

      return true
    }
  }

  return { chmods, files, io, links, symlinks }
}

test('an AppImage shortcut points at the downloaded file, not the temporary mount', () => {
  const target = resolveLaunchTarget({
    env: { APPIMAGE: '/home/ada/Apps/AI-Evolution-Jarvis.AppImage' },
    execPath: '/tmp/.mount_AI-Evo7Xk2/ai-evolution-jarvis',
    platform: 'linux'
  })

  assert.equal(target.exec, '/home/ada/Apps/AI-Evolution-Jarvis.AppImage')
  assert.equal(target.workingDirectory, '/home/ada/Apps')
})

test('a macOS shortcut points at the bundle, not the binary inside it', () => {
  const target = resolveLaunchTarget({
    env: {},
    execPath: '/Applications/AI Evolution Jarvis.app/Contents/MacOS/AI Evolution Jarvis',
    platform: 'darwin'
  })

  assert.equal(target.exec, '/Applications/AI Evolution Jarvis.app')
})

test('an ordinary install points at the running executable', () => {
  const target = resolveLaunchTarget({
    env: {},
    execPath: '/opt/AI Evolution Jarvis/ai-evolution-jarvis',
    platform: 'linux'
  })

  assert.equal(target.exec, '/opt/AI Evolution Jarvis/ai-evolution-jarvis')
  assert.equal(target.workingDirectory, '/opt/AI Evolution Jarvis')
})

test('file names follow each platform’s convention', () => {
  assert.equal(desktopShortcutKind('win32'), 'lnk')
  assert.equal(desktopShortcutKind('darwin'), 'alias')
  assert.equal(desktopShortcutKind('linux'), 'desktop-entry')
  assert.equal(desktopShortcutFileName('AI Evolution Jarvis', 'lnk'), 'AI Evolution Jarvis.lnk')
  assert.equal(desktopShortcutFileName('AI Evolution Jarvis', 'desktop-entry'), 'ai-evolution-jarvis.desktop')
  assert.equal(desktopShortcutFileName('  ', 'desktop-entry'), 'jarvis.desktop')
})

test('a desktop entry quotes an exec path with spaces so the launcher survives it', () => {
  assert.equal(quoteDesktopExecArg('/opt/plain/app'), '/opt/plain/app')

  const entry = renderDesktopEntry({
    comment: 'Asystent AI',
    exec: '/opt/AI Evolution Jarvis/ai-evolution-jarvis',
    icon: 'ai-evolution-jarvis',
    name: 'AI Evolution Jarvis',
    wmClass: 'AI Evolution Jarvis'
  })

  assert.ok(entry.startsWith('[Desktop Entry]\n'))
  assert.ok(entry.includes('Exec="/opt/AI Evolution Jarvis/ai-evolution-jarvis" %U'))
  assert.ok(entry.includes('StartupWMClass=AI Evolution Jarvis'))
  assert.ok(entry.endsWith('\n'))
})

test('a Linux desktop entry is written executable, or no launcher will offer it', () => {
  const { chmods, files, io } = recordingIo()

  const result = ensureDesktopShortcut(
    {
      comment: 'Asystent AI',
      desktopDir: '/home/ada/Pulpit',
      productName: 'AI Evolution Jarvis',
      target: { exec: '/opt/jarvis/jarvis', workingDirectory: '/opt/jarvis' }
    },
    io,
    'linux'
  )

  const expected = path.join('/home/ada/Pulpit', 'ai-evolution-jarvis.desktop')
  assert.equal(result.status, 'created')
  assert.equal(result.path, expected)
  assert.equal(chmods.get(expected), 0o755)
  assert.ok(files.get(expected)?.includes('Exec=/opt/jarvis/jarvis %U'))
})

test('an existing shortcut is left alone unless the user asks for a new one', () => {
  const existing = path.join('/home/ada/Desktop', 'ai-evolution-jarvis.desktop')
  const { files, io } = recordingIo(['/home/ada/Desktop', existing])

  const untouched = ensureDesktopShortcut(
    {
      comment: 'Asystent AI',
      desktopDir: '/home/ada/Desktop',
      productName: 'AI Evolution Jarvis',
      target: { exec: '/opt/jarvis/jarvis', workingDirectory: '/opt/jarvis' }
    },
    io,
    'linux'
  )

  assert.equal(untouched.status, 'exists')
  assert.equal(files.size, 0, 'nothing was rewritten')

  const forced = ensureDesktopShortcut(
    {
      comment: 'Asystent AI',
      desktopDir: '/home/ada/Desktop',
      force: true,
      productName: 'AI Evolution Jarvis',
      target: { exec: '/opt/jarvis/jarvis', workingDirectory: '/opt/jarvis' }
    },
    io,
    'linux'
  )

  assert.equal(forced.status, 'replaced')
  assert.equal(files.size, 1)
})

test('Windows writes a real .lnk through the shell API and reports a refusal', () => {
  const { io, links } = recordingIo()

  const created = ensureDesktopShortcut(
    {
      comment: 'Asystent AI',
      desktopDir: 'C:\\Users\\Ada\\Desktop',
      iconPath: 'C:\\Program Files\\Jarvis\\resources\\icon.ico',
      productName: 'AI Evolution Jarvis',
      target: { exec: 'C:\\Program Files\\Jarvis\\Jarvis.exe', workingDirectory: 'C:\\Program Files\\Jarvis' }
    },
    io,
    'win32'
  )

  assert.equal(created.status, 'created')
  assert.equal(links.size, 1)
  assert.equal([...links.values()][0].icon, 'C:\\Program Files\\Jarvis\\resources\\icon.ico')

  const refused = ensureDesktopShortcut(
    {
      comment: 'Asystent AI',
      desktopDir: 'C:\\Users\\Ada\\Desktop',
      force: true,
      productName: 'AI Evolution Jarvis',
      target: { exec: 'C:\\Program Files\\Jarvis\\Jarvis.exe', workingDirectory: 'C:\\Program Files\\Jarvis' }
    },
    { ...io, writeLink: () => false },
    'win32'
  )

  assert.equal(refused.status, 'failed')
  assert.equal(refused.reason, 'shell-refused')
})

test('a machine with no desktop directory is told so, not given an invented folder', () => {
  const { files, io } = recordingIo([])

  const result = ensureDesktopShortcut(
    {
      comment: 'Asystent AI',
      desktopDir: '/home/ada/Desktop',
      productName: 'AI Evolution Jarvis',
      target: { exec: '/opt/jarvis/jarvis', workingDirectory: '/opt/jarvis' }
    },
    io,
    'linux'
  )

  assert.equal(result.status, 'unsupported')
  assert.equal(result.reason, 'no-desktop-dir')
  assert.equal(files.size, 0)
})

test('a filesystem that refuses the write is reported, never thrown at the caller', () => {
  const { io } = recordingIo()

  const result = ensureDesktopShortcut(
    {
      comment: 'Asystent AI',
      desktopDir: '/read-only/Desktop',
      productName: 'AI Evolution Jarvis',
      target: { exec: '/opt/jarvis/jarvis', workingDirectory: '/opt/jarvis' }
    },
    {
      ...io,
      writeFile: () => {
        throw new Error('EROFS: read-only file system')
      }
    },
    'linux'
  )

  assert.equal(result.status, 'failed')
  assert.match(result.reason ?? '', /EROFS/)
})

test('first run creates the icon once, and never on macOS', () => {
  assert.equal(shouldAutoCreateDesktopShortcut({ attempted: false, platform: 'linux' }), true)
  assert.equal(shouldAutoCreateDesktopShortcut({ attempted: false, platform: 'win32' }), true)
  assert.equal(shouldAutoCreateDesktopShortcut({ attempted: true, platform: 'win32' }), false)
  assert.equal(shouldAutoCreateDesktopShortcut({ attempted: false, platform: 'darwin' }), false)
})
