import { capabilityScoped, type ProfileScope } from './client'

export interface GoogleStatus {
  can_send_mail: boolean
  client_secret: boolean
  connected: boolean
  services: string[]
  token: boolean
}

export interface GoogleVerifyResult {
  checked_at?: string
  drive_ok?: boolean
  services?: Partial<
    Record<
      'gmail' | 'calendar' | 'drive',
      { state: 'connected' | 'reauthorize' | 'permission' | 'rate_limit' | 'unavailable' | 'unconfigured' }
    >
  >
  calendar_ok?: boolean
  events?: { start: string; summary: string }[]
  gmail_ok?: boolean
  ok: boolean
  reason?: string
  unread?: { from: string; subject: string }[]
}

const call = <T>(profile: ProfileScope | undefined, path: string, body?: unknown) =>
  window.hermesDesktop.api<T>({
    ...capabilityScoped(profile),
    body,
    method: body === undefined ? undefined : 'POST',
    path
  })

export const getGoogleStatus = (profile?: ProfileScope) => call<GoogleStatus>(profile, '/api/google/status')

export const uploadGoogleClientSecret = (content: string, profile?: ProfileScope) =>
  call<{ ok: boolean }>(profile, '/api/google/client-secret', { content })

export const getGoogleAuthUrl = (profile?: ProfileScope) => call<{ url: string }>(profile, '/api/google/auth-url', {})

export const submitGoogleAuthCode = (code: string, profile?: ProfileScope) =>
  call<{ ok: boolean; warning: null | string }>(profile, '/api/google/auth-code', { code })

export const verifyGoogle = (profile?: ProfileScope) =>
  window.hermesDesktop.api<GoogleVerifyResult>({
    ...capabilityScoped(profile),
    path: '/api/google/verify',
    method: 'POST',
    body: {},
    timeoutMs: 90_000
  })

export const revokeGoogle = (profile?: ProfileScope) => call<{ ok: boolean }>(profile, '/api/google/revoke', {})
