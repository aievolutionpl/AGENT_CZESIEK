/**
 * The voice agent's hands on the work board and its eyes on the screen.
 *
 * `assign_work`, `work_status` and `steer_work` talk to the kanban board through the backend, which is the
 * only authority on what a job's state is: the model is told what the board confirms and nothing more.
 * `look_at_screen` captures the screen only when called, sends that one picture to the vision model and
 * says so on screen, so a look is never silent.
 */

import {
  cancelVoiceTask,
  describeScreen,
  type DeskLang,
  dispatchVoiceWork,
  getVoiceDesk,
  getVoiceTask,
  steerVoiceTask
} from '@/api/voice-desk'

import type { VoiceToolArgs } from './tools'

const COPY = {
  en: {
    blind: 'I cannot see the screen right now: screen capture is unavailable or not allowed on this computer.',
    cancelled: (id: string) => `Task ${id} was stopped; the board confirms it is closed.`,
    alreadyClosed: (id: string, status: string) => `Task ${id} is already ${status}; nothing to stop.`,
    needsId: 'Which task? I need its id; ask for the board status first.',
    needsText: 'What should the colleague do differently? I need the new direction.',
    steered: (id: string, resumed: boolean) =>
      `Direction passed to task ${id}${resumed ? ' and the task was resumed' : ''}. Delivery is confirmed only when the board changes.`
  },
  pl: {
    blind: 'Nie widzę teraz ekranu: przechwytywanie ekranu jest niedostępne albo zablokowane na tym komputerze.',
    cancelled: (id: string) => `Zadanie ${id} zatrzymane; tablica potwierdza, że jest zamknięte.`,
    alreadyClosed: (id: string, status: string) =>
      `Zadanie ${id} jest już w stanie ${status}; nie ma czego zatrzymywać.`,
    needsId: 'Które zadanie? Potrzebuję jego id; najpierw zapytaj o stan tablicy.',
    needsText: 'Co współpracownik ma zrobić inaczej? Potrzebuję nowego kierunku.',
    steered: (id: string, resumed: boolean) =>
      `Kierunek przekazany do zadania ${id}${resumed ? ', zadanie wznowione' : ''}. Dostarczenie potwierdzi dopiero zmiana na tablicy.`
  }
} as const

export interface DeskToolDeps {
  /** A screenshot as a data URL, or null when capture is unavailable or denied. */
  capture?: () => Promise<null | string>
  lang: () => DeskLang
  /** Called right before the screen is captured, so the user sees that a look is happening. */
  onLook?: () => void
  sessionId: () => null | string
}

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '')

/** `onTool` for the Live providers: one handler per desk tool, each answering with text for the model. */
export function createDeskTools({ capture, lang, onLook, sessionId }: DeskToolDeps) {
  const handlers: Record<string, (args: VoiceToolArgs) => Promise<string>> = {
    assign_work: async args => {
      const priority = Number(args.priority)

      const result = await dispatchVoiceWork({
        assignee: text(args.assignee) || undefined,
        details: text(args.details),
        lang: lang(),
        priority: Number.isFinite(priority) ? priority : 0,
        session_id: sessionId(),
        title: text(args.title)
      })

      return result.text
    },
    look_at_screen: async args => {
      if (!capture) {
        return COPY[lang()].blind
      }

      onLook?.()

      const image = await capture()

      return image ? (await describeScreen(image, text(args.question), lang())).text : COPY[lang()].blind
    },
    steer_work: async args => {
      const id = text(args.task_id)
      const words = COPY[lang()]

      if (!id) {
        return words.needsId
      }

      if (args.stop === true) {
        const stopped = await cancelVoiceTask(id)

        return stopped.cancelled ? words.cancelled(id) : words.alreadyClosed(id, stopped.status)
      }

      const instruction = text(args.instruction)

      return instruction ? words.steered(id, (await steerVoiceTask(id, instruction)).resumed) : words.needsText
    },
    work_status: async args => {
      const id = text(args.task_id)

      return (id ? await getVoiceTask(id, lang()) : await getVoiceDesk(lang())).text
    }
  }

  return async (name: string, args: VoiceToolArgs): Promise<string> => {
    const run = Object.hasOwn(handlers, name) ? handlers[name] : undefined

    return run ? run(args) : `Unknown tool: ${name}`
  }
}
