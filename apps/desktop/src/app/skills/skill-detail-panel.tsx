import { useQuery } from '@tanstack/react-query'
import type * as React from 'react'
import { useMemo } from 'react'

import { PanelPill } from '@/app/overlays/panel'
import { asText, prettyName } from '@/app/settings/helpers'
import { Button } from '@/components/ui/button'
import { CountSkeleton } from '@/components/ui/skeleton'
import { getSkillContent, previewSkillHub, type ProfileScope, profileScopeKey } from '@/hermes'
import { useI18n } from '@/i18n'
import { Loader2 } from '@/lib/icons'
import type { OfficialSkillInfo, SkillInfo } from '@/types/hermes'

function detailHeader({
  description,
  pills,
  title
}: {
  description: React.ReactNode
  pills?: React.ReactNode
  title: string
}) {
  return (
    <header>
      <div className="flex min-h-6 flex-wrap items-center gap-2">
        <h3 className="min-w-0 truncate text-[0.9375rem] font-semibold tracking-tight">{title}</h3>
        {pills}
      </div>
      <p className="mt-1 text-[length:var(--conversation-caption-font-size)] leading-(--conversation-caption-line-height) text-(--ui-text-tertiary)">
        {description}
      </p>
    </header>
  )
}

function parseFrontmatter(content: string): { body: string; meta: [string, string][] } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(content)

  if (!match) {
    return { body: content, meta: [] }
  }

  const meta: [string, string][] = []
  let currentKey: string | null = null
  let block: string[] = []

  const flush = () => {
    if (currentKey !== null) {
      meta.push([currentKey, block.join('\n').trim()])
    }
    currentKey = null
    block = []
  }

  for (const line of match[1].split(/\r?\n/)) {
    const kv = /^(\w[\w-]*):\s?(.*)$/.exec(line)

    if (kv) {
      flush()
      currentKey = kv[1]
      block = kv[2] ? [kv[2]] : []
    } else if (currentKey !== null) {
      block.push(line.replace(/^ {2}/, ''))
    }
  }

  flush()

  return { body: content.slice(match[0].length), meta }
}

function Metadata({ meta }: { meta: [string, string][] }) {
  return meta.length > 0 ? (
    <div className="grid gap-1 rounded-lg border border-(--ui-stroke-tertiary) bg-(--ui-bg-quinary) p-3">
      {meta.map(([key, value]) => (
        <div className="flex gap-2 text-[0.68rem] leading-4" key={key}>
          <span className="w-24 shrink-0 font-medium text-(--ui-text-tertiary)">{key}</span>
          <span className="min-w-0 whitespace-pre-wrap break-words text-(--ui-text-secondary)">{value}</span>
        </div>
      ))}
    </div>
  ) : null
}

export function SkillDetailPanel({
  onArchive,
  onEdit,
  profile,
  skill
}: {
  onArchive: () => void
  onEdit: () => void
  profile?: ProfileScope
  skill: SkillInfo
}) {
  const { t } = useI18n()
  const editable = skill.provenance === 'agent'

  const contentQuery = useQuery({
    queryKey: ['skill-content', skill.name, profileScopeKey(profile)],
    queryFn: () => getSkillContent(skill.name, profile),
    staleTime: 60_000
  })

  const parsed = useMemo(
    () => (contentQuery.data ? parseFrontmatter(contentQuery.data.content) : null),
    [contentQuery.data]
  )

  return (
    <>
      {detailHeader({
        description: asText(skill.description) || t.skills.noDescription,
        pills: (
          <>
            <PanelPill>{prettyName(skill.category || 'general')}</PanelPill>
            {skill.provenance && skill.provenance !== 'bundled' ? (
              <PanelPill tone={skill.provenance === 'agent' ? 'good' : 'muted'}>
                {t.skills.provenance[skill.provenance]}
              </PanelPill>
            ) : null}
          </>
        ),
        title: prettyName(skill.name)
      })}
      {editable ? (
        <div className="flex items-center gap-2">
          <Button onClick={onEdit} size="xs" variant="text">
            {t.skills.edit}
          </Button>
          <Button className="text-destructive hover:text-destructive" onClick={onArchive} size="xs" variant="text">
            {t.skills.archive}
          </Button>
        </div>
      ) : null}
      {parsed ? <Metadata meta={parsed.meta} /> : null}
      {contentQuery.isLoading ? (
        <CountSkeleton />
      ) : parsed ? (
        <pre
          className="overflow-auto whitespace-pre-wrap wrap-break-word rounded-lg border border-(--ui-stroke-tertiary) bg-(--ui-bg-quinary) p-3 font-mono text-[0.68rem] leading-relaxed"
          data-selectable-text="true"
        >
          {parsed.body.trim() || t.skills.noDescription}
        </pre>
      ) : null}
    </>
  )
}

export function OfficialSkillDetailPanel({
  installing,
  onInstall,
  profile,
  skill
}: {
  installing: boolean
  onInstall: () => void
  profile?: ProfileScope
  skill: OfficialSkillInfo
}) {
  const { t } = useI18n()

  const previewQuery = useQuery({
    queryKey: ['official-skill-preview', skill.identifier, profileScopeKey(profile)],
    queryFn: () => previewSkillHub(skill.identifier, profile),
    staleTime: 5 * 60_000,
    retry: false
  })

  const parsed = useMemo(
    () => (previewQuery.data?.skill_md ? parseFrontmatter(previewQuery.data.skill_md) : null),
    [previewQuery.data]
  )

  return (
    <>
      {detailHeader({
        description: asText(skill.description) || t.skills.noDescription,
        pills: (
          <>
            <PanelPill>{prettyName(skill.category)}</PanelPill>
            <PanelPill tone="muted">{t.skills.officialPill}</PanelPill>
          </>
        ),
        title: prettyName(skill.name)
      })}
      <div className="flex items-center gap-2">
        <Button disabled={installing} onClick={onInstall} size="xs" variant="textStrong">
          {installing ? <Loader2 className="size-3 animate-spin" /> : null}
          {installing ? t.skills.hub.installing : t.skills.hub.install}
        </Button>
      </div>
      {parsed ? <Metadata meta={parsed.meta} /> : null}
      {previewQuery.isLoading ? (
        <CountSkeleton />
      ) : parsed ? (
        <pre
          className="overflow-auto whitespace-pre-wrap wrap-break-word rounded-lg border border-(--ui-stroke-tertiary) bg-(--ui-bg-quinary) p-3 font-mono text-[0.68rem] leading-relaxed"
          data-selectable-text="true"
        >
          {parsed.body.trim() || t.skills.noDescription}
        </pre>
      ) : null}
    </>
  )
}
