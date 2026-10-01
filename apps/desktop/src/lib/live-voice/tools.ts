/**
 * One place that turns a Live provider's function call into the string that goes back to the model.
 *
 * OpenAI Realtime and Gemini Live differ in how a call arrives and how the answer is sent, not in what
 * the tools are — so both hand `(name, args)` here. `ask_jarvis` and `delegate_to_hermes` run a turn in
 * the current chat; the desk tools (`assign_work`, `work_status`, `steer_work`, `look_at_screen`) go to
 * `onTool`, which talks to the kanban board and the screen.
 */

export type VoiceToolArgs = Record<string, unknown>

export interface VoiceToolHandlers {
  /** Run a short request through the agent and wait for its text answer. */
  onAsk: (request: string) => Promise<string>
  /** Queue substantial work and return an acknowledgement without waiting for completion. */
  onDelegate: (request: string) => Promise<string>
  /** Board and screen tools; absent on a surface that has neither. */
  onTool?: (name: string, args: VoiceToolArgs) => Promise<string>
}

type ToolRun = (args: VoiceToolArgs, handlers: VoiceToolHandlers) => Promise<string>

const text = (value: unknown) => (typeof value === 'string' ? value : '')

const viaChat =
  (pick: (handlers: VoiceToolHandlers) => (request: string) => Promise<string>): ToolRun =>
  async (args, handlers) => {
    const request = text(args.request).trim()

    return request ? pick(handlers)(request) : 'The request was empty.'
  }

const viaDesk =
  (name: string): ToolRun =>
  async (args, { onTool }) =>
    onTool ? onTool(name, args) : `Unknown tool: ${name}`

const TOOLS: Record<string, ToolRun> = {
  ask_jarvis: viaChat(handlers => handlers.onAsk),
  assign_work: viaDesk('assign_work'),
  delegate_to_hermes: viaChat(handlers => handlers.onDelegate),
  look_at_screen: viaDesk('look_at_screen'),
  steer_work: viaDesk('steer_work'),
  work_status: viaDesk('work_status')
}

export const isVoiceTool = (name: string) => Object.hasOwn(TOOLS, name)

/** Arguments of an OpenAI function call arrive as a JSON string; a malformed one is an empty call. */
export function parseToolArguments(raw: unknown): VoiceToolArgs {
  try {
    const parsed: unknown = JSON.parse(text(raw) || '{}')

    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as VoiceToolArgs) : {}
  } catch {
    return {}
  }
}

export async function runVoiceTool(name: string, args: VoiceToolArgs, handlers: VoiceToolHandlers): Promise<string> {
  const run = Object.hasOwn(TOOLS, name) ? TOOLS[name] : undefined

  if (!run) {
    return `Unknown tool: ${name || '(none)'}`
  }

  try {
    return (await run(args, handlers)).trim() || 'Done.'
  } catch (error) {
    return `Jarvis could not finish that: ${error instanceof Error ? error.message : String(error)}`
  }
}
