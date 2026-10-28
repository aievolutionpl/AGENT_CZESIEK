import type { InterruptIntent } from './types'

/**
 * Classify a short user utterance that arrives while Jarvis is busy.
 * Returns null for a normal request. Interrupt ≠ cancel: "stop" silences the
 * voice, "anuluj" cancels the task, "nie, jednak X" corrects it.
 */
const CANCEL = /^(anuluj|przerwij zadanie|zatrzymaj zadanie|cancel( (it|that|the task))?|abort)\b/i
const CORRECT =
  /^(nie[,.]?\s+(jednak|lepiej|raczej)\b|nie\s+\S+[,.]\s+tylko\b|nie\s+\S+[,.]\s+\S+|no[,.]?\s+(actually|instead|make it)\b|actually[,]?\s)/i
const STOP_TURN = /^(poczekaj|czekaj|wait|hold on|chwila)\b/i
const STOP_SPEECH = /^(stop|cicho|dość|dosc|zamilcz|be quiet|shut up|enough)\b[.!]?$/i

export function classifyInterrupt(utterance: string): InterruptIntent | null {
  const text = utterance.trim()

  if (!text) {
    return null
  }

  if (CANCEL.test(text)) {
    return 'cancel_task'
  }

  if (STOP_SPEECH.test(text)) {
    return 'stop_speech'
  }

  if (STOP_TURN.test(text)) {
    return 'stop_turn'
  }

  if (CORRECT.test(text)) {
    return 'correct'
  }

  return null
}

/** A result belongs on screen/in speech only if it answers the task's current revision. */
export function isCurrentRevision(current: { revision: number } | undefined, resultRevision: number): boolean {
  return current !== undefined && current.revision === resultRevision
}
