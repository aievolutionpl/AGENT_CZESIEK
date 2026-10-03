import { useQuery } from '@tanstack/react-query'

import { Button } from '@/components/ui/button'
import { getSkills } from '@/hermes'
import { useI18n } from '@/i18n'
import { prettyName } from '@/lib/text'
import type { SkillInfo } from '@/types/hermes'

function displayName(name: string): string {
  return prettyName(name.replace(/-/g, '_'))
}

export interface SkillsSummaryProps {
  scope: { connectionId: string; profile: string }
  onManageSkills: () => void
}

/** Compact dashboard access point; backend skill state remains authoritative. */
export function SkillsSummary({ scope, onManageSkills }: SkillsSummaryProps) {
  const { t } = useI18n()

  const query = useQuery({
    queryKey: ['jarvis-skills-summary', scope.connectionId, scope.profile],
    queryFn: () => getSkills(scope),
    staleTime: 30_000
  })

  const skills = query.data ?? []

  const recent = [...skills]
    .filter(skill => skill.enabled && (skill.usage ?? 0) > 0)
    .sort((a, b) => (b.usage ?? 0) - (a.usage ?? 0))
    .slice(0, 3)

  const available = skills.filter(skill => skill.enabled).length

  return (
    <section aria-label={t.skills.tabSkills} className="jarvis-glass grid gap-3 rounded-2xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-(--ui-text-primary)">{t.skills.tabSkills}</h2>
          <p className="mt-1 text-xs text-(--ui-text-tertiary)">
            {t.settings.desktop.skills.available}: {available} · {t.settings.desktop.skills.installed}: {skills.length}
          </p>
        </div>
        <Button onClick={onManageSkills} size="xs" variant="secondary">
          {t.settings.desktop.skills.manage}
        </Button>
      </div>
      {query.isPending ? <p className="text-xs text-(--ui-text-tertiary)">{t.skills.loading}</p> : null}
      {!query.isPending && recent.length > 0 ? (
        <ul aria-label={t.settings.desktop.skills.recent} className="grid gap-1">
          {recent.map((skill: SkillInfo) => (
            <li className="flex items-center justify-between gap-2 text-xs" key={skill.name}>
              <span className="truncate text-(--ui-text-secondary)">{displayName(skill.name)}</span>
              <span className="shrink-0 text-(--ui-text-tertiary)">×{skill.usage}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {!query.isPending && query.isError ? (
        <p className="text-xs text-destructive">{t.skills.skillsLoadFailed}</p>
      ) : null}
    </section>
  )
}
