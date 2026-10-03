import './office-team.css'

import { cn } from '@/lib/utils'

export const CHARACTER_AVATARS = [
  { id: 'maja', name: 'Maja', position: '0% 0%' },
  { id: 'kuba', name: 'Kuba', position: '50% 0%' },
  { id: 'iga', name: 'Iga', position: '100% 0%' },
  { id: 'ola', name: 'Ola', position: '0% 100%' },
  { id: 'bartek', name: 'Bartek', position: '50% 100%' },
  { id: 'lena', name: 'Lena', position: '100% 100%' }
] as const

interface CharacterAvatarProps {
  avatar?: string
  name: string
  className?: string
}

export function CharacterAvatar({ avatar, name, className }: CharacterAvatarProps) {
  const character = CHARACTER_AVATARS.find(item => item.id === avatar)

  return (
    <span
      aria-hidden="true"
      className={cn('office-avatar', character && 'office-avatar-portrait', className)}
      style={character ? { backgroundPosition: character.position } : undefined}
    >
      {character ? null : name.trim().slice(0, 1).toLocaleUpperCase('pl') || 'C'}
    </span>
  )
}
