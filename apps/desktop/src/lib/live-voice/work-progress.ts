import type { DeskItem } from '@/api/voice-desk'
import type { ChatMessage } from '@/lib/chat-messages/types'
import type { SubagentProgress } from '@/store/subagents'

/** Compact dashboard activity from the board's confirmed verdicts. */
export function describeDeskActivity(items: readonly DeskItem[], lang: 'en' | 'pl') {
  const labels =
    lang === 'pl'
      ? {
          queued: 'w kolejce',
          running: 'w toku',
          retrying: 'ponawianie',
          in_review: 'do przeglądu',
          blocked: 'zablokowane',
          needs_you: 'potrzebna Twoja odpowiedź',
          stalled: 'brak sygnału od pracownika'
        }
      : {
          queued: 'queued',
          running: 'running',
          retrying: 'retrying',
          in_review: 'in review',
          blocked: 'blocked',
          needs_you: 'needs your answer',
          stalled: 'no worker signal'
        }

  const lines = items
    .filter(item => item.verdict in labels)
    .slice(0, 3)
    .map(item => `${item.title}: ${labels[item.verdict as keyof typeof labels]}`)

  return lines.length ? lines.join('\n') : null
}

/** Report observed activity, never tool arguments, private reasoning or invented percentages. */
function toolActivity(name: string, pl: boolean) {
  if (/search|research/i.test(name)) {
    return pl ? 'szuka informacji' : 'is searching for information'
  }

  if (/browser|browse|web|fetch/i.test(name)) {
    return pl ? 'sprawdza strony internetowe' : 'is checking websites'
  }

  if (/write|edit|patch|create_file/i.test(name)) {
    return pl ? 'zapisuje zmiany w plikach' : 'is updating files'
  }

  if (/read|file|directory|list_dir/i.test(name)) {
    return pl ? 'sprawdza pliki' : 'is checking files'
  }

  if (/terminal|shell|exec|command|python/i.test(name)) {
    return pl ? 'wykonuje polecenie' : 'is running a command'
  }

  if (/delegate|subagent/i.test(name)) {
    return pl ? 'koordynuje pracę współpracowników' : 'is coordinating workers'
  }

  return pl ? 'korzysta z narzędzia' : 'is using a tool'
}

export function describeWorkProgress({
  busy,
  pending,
  messages,
  workers,
  lang
}: {
  busy: boolean
  pending: boolean
  messages: readonly Pick<ChatMessage, 'parts' | 'role' | 'pending'>[]
  workers: readonly SubagentProgress[]
  lang: 'en' | 'pl'
}): string | null {
  const pl = lang === 'pl'
  const active = workers.filter(item => item.status === 'running' || item.status === 'queued')

  const lines = active.slice(0, 3).map(item => {
    const activity =
      item.status === 'queued'
        ? pl
          ? 'czeka w kolejce'
          : 'is queued'
        : item.currentTool
          ? toolActivity(item.currentTool, pl)
          : pl
            ? 'pracuje nad zadaniem'
            : 'is working on the task'

    return `${item.goal.slice(0, 160)}: ${activity}.`
  })

  if (busy) {
    const message = messages.findLast(item => item.role === 'assistant' && item.pending)
    const tool = message?.parts.findLast(part => part.type === 'tool-call' && part.result === undefined)
    lines.unshift(
      tool?.type === 'tool-call'
        ? `Hermes ${toolActivity(tool.toolName, pl)}.`
        : pl
          ? 'Zadanie Hermesa nadal trwa; nie mam jeszcze końcowego wyniku.'
          : 'Hermes is still working; no final result yet.'
    )
  } else if (pending && !lines.length) {
    lines.push(
      pl
        ? 'Czekam na potwierdzony wynik Hermesa. Możemy dalej rozmawiać.'
        : 'Waiting for a confirmed result from Hermes. We can keep talking.'
    )
  }

  return lines.length ? lines.join('\n') : null
}
