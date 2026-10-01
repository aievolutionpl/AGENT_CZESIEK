import { hermesApi, profileScoped } from './client'

/** Where a task on the board really stands, as the backend judges it (kanban_voice_desk.verdict_for). */
export type DeskVerdict =
  'blocked' | 'done' | 'done_unreported' | 'in_review' | 'needs_you' | 'queued' | 'retrying' | 'running' | 'stalled'

export type DeskLang = 'en' | 'pl'

export interface DeskItem {
  age_s: number
  assignee: null | string
  attention: boolean
  created_by: null | string
  id: string
  /** Spoken-ready paragraph; worker text inside is fenced as external data. */
  line: string
  reason: string
  session_id: null | string
  status: string
  summary: string
  title: string
  verdict: DeskVerdict
}

export interface DeskDigest {
  agents: string[]
  at: number
  counts: { attention: number; done_recent: number; queued: number; running: number }
  /** `on_demand`: no gateway runs the dispatcher, so tasks only start when nudged. */
  dispatcher: 'on_demand' | 'running' | 'unknown'
  items: DeskItem[]
  text: string
  truncated: boolean
}

export interface DispatchWorkRequest {
  assignee?: string
  details: string
  lang: DeskLang
  priority?: number
  session_id?: null | string
  title: string
}

export interface DispatchWorkResult {
  assignee: string
  dispatcher: DeskDigest['dispatcher']
  started: boolean
  status: string
  task_id: string
  text: string
}

export interface DeskTaskReport extends DeskItem {
  comments: { author: string; body: string }[]
  result: string
  runs: number
  text: string
}

const post = <T>(path: string, body: unknown) => hermesApi<T>({ ...profileScoped(), body, method: 'POST', path })

export const getVoiceDesk = (lang: DeskLang) =>
  hermesApi<DeskDigest>({ ...profileScoped(), path: `/api/voice/desk?lang=${lang}` })

export const getVoiceTask = (taskId: string, lang: DeskLang) =>
  hermesApi<DeskTaskReport>({
    ...profileScoped(),
    path: `/api/voice/desk/tasks/${encodeURIComponent(taskId)}?lang=${lang}`
  })

export const dispatchVoiceWork = (request: DispatchWorkRequest) =>
  post<DispatchWorkResult>('/api/voice/desk/dispatch', request)

export const steerVoiceTask = (taskId: string, instruction: string) =>
  post<{ resumed: boolean; task_id: string }>(`/api/voice/desk/tasks/${encodeURIComponent(taskId)}/steer`, {
    instruction
  })

export const cancelVoiceTask = (taskId: string) =>
  post<{ cancelled: boolean; status: string; task_id: string }>(
    `/api/voice/desk/tasks/${encodeURIComponent(taskId)}/cancel`,
    {}
  )

/** A screenshot the desktop captured on request, described by the vision model; `text` is fenced. */
export const describeScreen = (image: string, question: string, lang: DeskLang) =>
  post<{ text: string }>('/api/voice/vision', { image, lang, question })
