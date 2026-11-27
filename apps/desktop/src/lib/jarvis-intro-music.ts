const INTRO_MUSIC_URL = '/audio/jarvis-intro.mp3'
const INTRO_MUSIC_VOLUME = 0.3

let player: HTMLAudioElement | null = null
let playPending = false
let startupPlayed = false

function introPlayer(): HTMLAudioElement {
  if (!player) {
    player = new Audio(INTRO_MUSIC_URL)
    player.loop = false
    player.volume = INTRO_MUSIC_VOLUME
  }

  return player
}

export function startJarvisIntroMusic(restart = false): void {
  // Live transcripts can repeat the same phrase while it is being recognized.
  if (isJarvisIntroMusicPlaying()) {
    return
  }

  const audio = introPlayer()

  if (restart) {
    audio.currentTime = 0
  }

  playPending = true
  void audio
    .play()
    .catch(() => undefined)
    .finally(() => {
      playPending = false
    })
}

const STARTUP_PLAYED_KEY = 'jarvis-intro-startup-played'

/** The intro once per app launch (a window reload is not a new launch). Later plays come from the phrase only. */
export function playJarvisIntroOnStartup(): void {
  if (startupPlayed) {
    return
  }

  startupPlayed = true

  try {
    if (window.sessionStorage.getItem(STARTUP_PLAYED_KEY)) {
      return
    }

    window.sessionStorage.setItem(STARTUP_PLAYED_KEY, '1')
  } catch {
    // The in-memory sentinel still prevents replays when storage is unavailable.
  }

  startJarvisIntroMusic(true)
}

export function stopJarvisIntroMusic(): void {
  if (player) {
    player.pause()
    player.currentTime = 0
  }
}

export function isJarvisIntroMusicPlaying(): boolean {
  return playPending || Boolean(player && !player.paused && !player.ended)
}

export function isJarvisMusicPhrase(text: string): boolean {
  return (
    text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('pl')
      .replace(/ł/g, 'l')
      .replace(/[^a-z\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .match(/\btatus wrocil\b/) !== null
  )
}
