import type { ProfileScope } from '@/api/client'

import { OpenRouterQuickConnect, type OpenRouterQuickConnectProps } from './openrouter-quick-connect'

export interface OnboardingConnectStepProps {
  deps?: OpenRouterQuickConnectProps['deps']
  onConnected: OpenRouterQuickConnectProps['onConnected']
  scope: ProfileScope
}

/** The connection step is deliberately a thin owner-passing composition. */
export function OnboardingConnectStep({ deps, onConnected, scope }: OnboardingConnectStepProps) {
  return <OpenRouterQuickConnect deps={deps} onConnected={onConnected} scope={scope} tone="dark" />
}
