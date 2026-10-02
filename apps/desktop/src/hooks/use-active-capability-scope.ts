import { useStore } from '@nanostores/react'
import { useMemo } from 'react'

import { profileScopeKey } from '@/api/client'
import { $activeConnectionId } from '@/store/connections'
import { $activeGatewayProfile } from '@/store/profile'

/** Pin both requests and cache entries to the backend currently shown. */
export function useActiveCapabilityScope() {
  const connectionId = useStore($activeConnectionId)
  const profile = useStore($activeGatewayProfile)
  const scope = useMemo(() => ({ connectionId, profile }), [connectionId, profile])

  return { scope, scopeKey: profileScopeKey(scope) }
}
