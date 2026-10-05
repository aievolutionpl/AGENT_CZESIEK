interface VoiceReport {
  attempts: number
  sentAt: number | null
  text: string
  onSpoken?: () => void
  progress: boolean
}

/** A sent report remains pending until voice output starts. Silent turns retry. */
export class VoiceReportQueue {
  private reports: VoiceReport[] = []

  constructor(private readonly failed: (text: string) => void) {}

  push(text: string, onSpoken?: () => void, progress = false) {
    if (!progress) {
      this.reports = this.reports.filter(report => !report.progress)
    }

    if (!this.reports.some(report => report.text === text)) {
      this.reports.push({ attempts: 0, sentAt: null, text, onSpoken, progress })
    }
  }

  clear() {
    this.reports = []
  }

  get pending() {
    return this.reports.length > 0
  }

  spoken() {
    const report = this.reports[0]

    if (report && report.sentAt !== null) {
      this.reports.shift()
      report.onSpoken?.()
    }
  }

  drain(notify: (text: string) => boolean, now: number) {
    const report = this.reports[0]

    if (!report || (report.sentAt !== null && now - report.sentAt < 12_000)) {
      return
    }

    if (report.attempts >= 3) {
      this.reports.shift()

      if (!report.progress) {
        this.failed(report.text)
      }

      return
    }

    if (notify(report.text)) {
      report.attempts += 1
      report.sentAt = now
    }
  }
}
