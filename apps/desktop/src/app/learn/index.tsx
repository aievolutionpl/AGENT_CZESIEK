import { useState } from 'react'
import { useNavigate } from 'react-router'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import { AI_GLOSSARY, AI_LESSONS } from './lessons'

export function LearnView() {
  const navigate = useNavigate()
  const [selected, setSelected] = useState(AI_LESSONS[0].id)
  const [tab, setTab] = useState<'lessons' | 'glossary'>('lessons')
  const [search, setSearch] = useState('')
  const [answerVisible, setAnswerVisible] = useState(false)
  const lesson = AI_LESSONS.find(item => item.id === selected) ?? AI_LESSONS[0]

  const terms = AI_GLOSSARY.filter(item =>
    item.join(' ').toLocaleLowerCase('pl').includes(search.toLocaleLowerCase('pl'))
  )

  return (
    <main className="@container grid h-full min-h-0 grid-rows-[auto_1fr] gap-6 overflow-hidden p-5 md:p-8">
      <header className="grid gap-3">
        <p className="jarvis-brand-signature">AI Evolution Polska · Nauka AI</p>
        <h1 className="text-2xl font-semibold">Zrozum AI. Pracuj pewniej.</h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          Krótkie lekcje, proste pojęcia i przykłady, które możesz od razu wykorzystać z Cześkiem.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            aria-pressed={tab === 'lessons'}
            onClick={() => setTab('lessons')}
            size="sm"
            variant={tab === 'lessons' ? 'default' : 'ghost'}
          >
            Mini-lekcje
          </Button>
          <Button
            aria-pressed={tab === 'glossary'}
            onClick={() => setTab('glossary')}
            size="sm"
            variant={tab === 'glossary' ? 'default' : 'ghost'}
          >
            Słownik AI
          </Button>
          <Button onClick={() => navigate('/agents')} size="sm" variant="ghost">
            Poznaj zespół
          </Button>
          <a
            className="self-center text-sm text-(--ui-accent) underline underline-offset-4"
            href="https://aievolutionpolska.pl"
            rel="noopener noreferrer"
            target="_blank"
          >
            Więcej w AI Evolution Polska ↗
          </a>
        </div>
      </header>
      {tab === 'lessons' ? (
        <div className="grid min-h-0 gap-5 overflow-y-auto @3xl:grid-cols-[220px_1fr]">
          <nav aria-label="Lekcje AI" className="flex flex-col gap-1">
            {AI_LESSONS.map((item, index) => (
              <button
                aria-current={selected === item.id ? 'page' : undefined}
                className={`jarvis-nav-row flex items-center gap-3 rounded-xl px-3 py-3 text-left text-sm ${selected === item.id ? 'jarvis-nav-active' : ''}`}
                key={item.id}
                onClick={() => {
                  setSelected(item.id)
                  setAnswerVisible(false)
                }}
                type="button"
              >
                <span className="text-xs text-muted-foreground">0{index + 1}</span>
                <span className="flex-1">
                  {item.title}
                  <span className="mt-1 block text-xs text-muted-foreground">{item.time}</span>
                </span>
              </button>
            ))}
          </nav>
          <article
            aria-labelledby="lesson-title"
            className="jarvis-panel grid content-start gap-5 p-5 md:p-7"
            key={lesson.id}
          >
            <div>
              <p className="mb-2 text-xs text-muted-foreground">Mini-lekcja · {lesson.time}</p>
              <h2 className="text-xl font-semibold" id="lesson-title">
                {lesson.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{lesson.intro}</p>
            </div>
            {lesson.sections.map(section => (
              <section key={section.title}>
                <h3 className="mb-2 text-base font-semibold">{section.title}</h3>
                <p className="max-w-3xl text-sm leading-7 text-muted-foreground">{section.body}</p>
              </section>
            ))}
            <section className="border-l-2 border-(--ui-accent) pl-4">
              <h3 className="text-sm font-semibold">Przykład z pracy</h3>
              <p className="mt-2 text-sm leading-6">{lesson.example}</p>
            </section>
            <section className="grid gap-3">
              <h3 className="text-sm font-semibold">Sprawdź, czy to już jasne</h3>
              <p className="text-sm">{lesson.question}</p>
              <Button
                className="justify-self-start"
                onClick={() => setAnswerVisible(value => !value)}
                size="sm"
                variant="ghost"
              >
                {answerVisible ? 'Ukryj odpowiedź' : 'Pokaż odpowiedź'}
              </Button>
              {answerVisible ? (
                <p className="text-sm leading-6 text-muted-foreground" role="status">
                  {lesson.answer}
                </p>
              ) : null}
            </section>
          </article>
        </div>
      ) : (
        <section className="grid min-h-0 grid-rows-[auto_1fr] gap-4">
          <Input
            aria-label="Szukaj pojęcia"
            onChange={event => setSearch(event.target.value)}
            placeholder="Np. API, token, pamięć…"
            value={search}
          />
          <dl className="grid content-start gap-4 overflow-y-auto @3xl:grid-cols-2">
            {terms.map(([term, definition]) => (
              <div className="jarvis-panel p-5" key={term}>
                <dt className="mb-2 text-base font-semibold">{term}</dt>
                <dd className="text-sm leading-6 text-muted-foreground">{definition}</dd>
              </div>
            ))}
            {terms.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nie znaleziono pojęcia. Spróbuj krótszej nazwy.</p>
            ) : null}
          </dl>
        </section>
      )}
    </main>
  )
}
