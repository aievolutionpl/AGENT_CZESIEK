import { useI18n } from '@/i18n'
import { ExternalLink } from '@/lib/icons'

/** Shared by the first-run wizard and the provider picker. */
export function ChatGptLoginGuide() {
  const { t } = useI18n()
  const copy = t.onboarding.chatGptLoginGuide

  return (
    <aside className="grid gap-2 text-sm leading-6 text-(--ui-text-secondary)" data-testid="chatgpt-login-guide">
      <p className="font-semibold text-(--ui-text-primary)">{copy.title}</p>
      <ol className="list-decimal space-y-1 pl-5">
        {copy.steps.map(step => <li key={step}>{step}</li>)}
      </ol>
      <p className="text-xs leading-5 text-(--ui-text-tertiary)">{copy.safety}</p>
      <a
        className="inline-flex w-fit items-center gap-1 text-(--ui-accent) underline-offset-4 hover:underline"
        href="https://developers.openai.com/codex/auth/#preferred-device-code-authentication-beta"
        rel="noreferrer"
        target="_blank"
      >
        {copy.docs}<ExternalLink aria-hidden="true" className="size-3.5" />
      </a>
    </aside>
  )
}
