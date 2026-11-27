import type { IpcMainEvent, IpcMainInvokeEvent } from 'electron'

/** Only the app entry document may retain the privileged preload bridge. */
export function isTrustedRendererUrl(candidate: string, rendererUrl: string): boolean {
  try {
    const actual = new URL(candidate)
    const expected = new URL(rendererUrl)
    actual.search = ''
    actual.hash = ''
    expected.search = ''
    expected.hash = ''

    return actual.href === expected.href
  } catch {
    return false
  }
}

export function assertTrustedRendererSender(event: IpcMainEvent | IpcMainInvokeEvent, rendererUrl: string): void {
  if (
    event.senderFrame !== event.sender.mainFrame ||
    !isTrustedRendererUrl(event.senderFrame?.url || '', rendererUrl)
  ) {
    throw new Error('IPC is only available to the desktop renderer')
  }
}
