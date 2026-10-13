import assert from 'node:assert/strict'

import { test, vi } from 'vitest'

import { assertTrustedRendererSender, isTrustedRendererUrl } from './renderer-document-trust'

const handlers = new Map<string, (...args: any[]) => unknown>()

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp', getVersion: () => 'test' },
  ipcMain: { handle: (channel: string, handler: (...args: any[]) => unknown) => handlers.set(channel, handler) },
  shell: { showItemInFolder: vi.fn(), openPath: vi.fn(), trashItem: vi.fn() }
}))
vi.mock('node-pty', () => ({ default: { spawn: vi.fn() } }))

test('only the entry document at the renderer origin keeps desktop privileges', () => {
  const file = 'file:///opt/app/dist/index.html'
  const dev = 'http://127.0.0.1:5173/'

  assert.equal(isTrustedRendererUrl(`${file}?win=quick#/`, file), true)
  assert.equal(isTrustedRendererUrl('file:///tmp/malicious.html', file), false)
  assert.equal(isTrustedRendererUrl('file:///opt/app/dist/index.html.evil', file), false)
  assert.equal(isTrustedRendererUrl('http://127.0.0.1:5173/?win=overlay', dev), true)
  assert.equal(isTrustedRendererUrl('http://127.0.0.1:5173.evil/', dev), false)
  assert.equal(isTrustedRendererUrl('http://127.0.0.1:5173/other', dev), false)
})

test('terminal and filesystem IPC reject foreign and child documents before executing handlers', async () => {
  const rendererUrl = 'file:///opt/app/dist/index.html'
  const { registerFsIpc } = await import('./fs-ipc')
  const { registerTerminalIpc } = await import('./terminal-ipc')

  registerFsIpc({
    rendererUrl,
    hermesHome: '/tmp/hermes',
    readActiveDesktopProfile: () => null,
    expandUserPath: value => value,
    resolveRequestedPathForIpc: value => value,
    directoryExists: () => true,
    resolveGitBinary: () => 'git'
  })
  registerTerminalIpc({
    rendererUrl,
    isWindows: false,
    findOnPath: () => null,
    rememberLog: () => {},
    activeSshTerminalTarget: () => null,
    ensureBackend: async () => {},
    getSshConnectionState: () => undefined
  })

  for (const frameUrl of ['file:///tmp/malicious.html', 'https://example.com/']) {
    const frame = { url: frameUrl }
    const event = { senderFrame: frame, sender: { mainFrame: frame, id: 1 } }

    for (const channel of [
      'hermes:terminal:start',
      'hermes:terminal:write',
      'hermes:fs:readDir',
      'hermes:fs:writeText'
    ]) {
      assert.throws(() => handlers.get(channel)!(event), /desktop renderer/)
    }
  }

  const mainFrame = { url: rendererUrl }
  const childFrame = { url: rendererUrl }
  assert.throws(
    () => assertTrustedRendererSender({ senderFrame: childFrame, sender: { mainFrame } } as any, rendererUrl),
    /desktop renderer/
  )
})
