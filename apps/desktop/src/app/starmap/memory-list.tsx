import { useState } from 'react'

import { getLearningNode } from '@/hermes'
import { useI18n } from '@/i18n'
import { loadStarmapGraph } from '@/store/starmap'

import { NodeContextMenu, type NodeMenuTarget } from './node-context-menu'
import type { MemoryGraphSource } from './types'

export function MemoryList({ source }: { source: MemoryGraphSource }) {
  const { locale, t } = useI18n()
  const polish = locale === 'pl'
  const [query, setQuery] = useState('')
  const [detail, setDetail] = useState<{ content: string; id: string; label: string } | null>(null)
  const [target, setTarget] = useState<NodeMenuTarget | null>(null)

  const nodes = source.graph.nodes.filter(node => {
    const value = `${node.label} ${node.kind}`.toLocaleLowerCase()

    return value.includes(query.toLocaleLowerCase())
  })

  const inspect = async (id: string, label: string) => {
    if (source.kind !== 'owned') {
      setDetail({ content: 'Imported memory is read-only; details are not available from this map.', id, label })

      return
    }

    try {
      const result = await getLearningNode(id, source.owner)
      setDetail({ content: result.content, id, label })
    } catch (error) {
      setDetail({ content: error instanceof Error ? error.message : String(error), id, label })
    }
  }

  return (
    <section aria-label={t.starmap.memory} className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-4">
      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>
          {t.starmap.memory}: {nodes.length} / {source.graph.nodes.length}
        </span>
        {source.kind === 'owned' ? (
          <button
            className="rounded border px-2 py-1 hover:text-foreground"
            onClick={() => void loadStarmapGraph(true)}
            type="button"
          >
            {t.starmap.refresh}
          </button>
        ) : null}
      </div>
      <label className="text-xs text-muted-foreground">
        {polish ? 'Szukaj w pamięci' : 'Search memory'}
        <input
          aria-label={polish ? 'Szukaj w pamięci' : 'Search memory'}
          className="mt-1 w-full rounded border bg-transparent px-2 py-1 text-sm"
          onChange={event => setQuery(event.target.value)}
          value={query}
        />
      </label>
      <div className="min-h-0 overflow-auto" role="list">
        {nodes.map(node => (
          <div className="flex items-center gap-2 border-b py-2" key={node.id} role="listitem">
            <button
              className="min-w-0 flex-1 truncate text-left text-sm hover:underline"
              onClick={() => void inspect(node.id, node.label)}
              type="button"
            >
              {node.label}
            </button>
            <span className="rounded-full border px-2 py-0.5 text-[0.7rem] text-muted-foreground">{node.kind}</span>
            <button
              aria-label={`${polish ? 'Edytuj' : 'Edit'} ${node.label}`}
              className="rounded border px-2 py-1 text-xs"
              disabled={source.kind !== 'owned'}
              onClick={event =>
                setTarget({ id: node.id, kind: node.kind, label: node.label, x: event.clientX, y: event.clientY })
              }
              type="button"
            >
              {polish ? 'Edytuj' : 'Edit'}
            </button>
            <button
              aria-label={`${polish ? 'Usuń' : 'Delete'} ${node.label}`}
              className="rounded border px-2 py-1 text-xs"
              disabled={source.kind !== 'owned'}
              onClick={event =>
                setTarget({ id: node.id, kind: node.kind, label: node.label, x: event.clientX, y: event.clientY })
              }
              type="button"
            >
              {polish ? 'Usuń' : 'Delete'}
            </button>
          </div>
        ))}
      </div>
      {detail ? (
        <article
          aria-label={`${polish ? 'Szczegóły pamięci' : 'Memory details for'} ${detail.label}`}
          className="max-h-72 overflow-auto rounded border p-3 text-sm"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="font-medium">{detail.label}</h2>
            <button
              aria-label={polish ? 'Zamknij szczegóły pamięci' : 'Close memory details'}
              onClick={() => setDetail(null)}
              type="button"
            >
              ×
            </button>
          </div>
          <p className="whitespace-pre-wrap text-muted-foreground">{detail.content}</p>
        </article>
      ) : null}
      <NodeContextMenu
        onClose={() => setTarget(null)}
        onNodeRemoved={() => setTarget(null)}
        source={source}
        target={target}
      />
    </section>
  )
}
