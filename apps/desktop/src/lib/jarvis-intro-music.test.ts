import { afterEach, expect, it, vi } from 'vitest'

afterEach(() => vi.unstubAllGlobals())

it('plays once on startup and allows a new phrase playback only after the current track ends', async () => {
  vi.resetModules()
  const store = new Map<string, string>()
  const players: Array<{ currentTime: number; ended: boolean; paused: boolean; loop: boolean; volume: number }> = []
  const play = vi.fn().mockResolvedValue(undefined)
  vi.stubGlobal('window', { sessionStorage: {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value)
  } })
  vi.stubGlobal('Audio', class {
    currentTime = 0
    ended = false
    paused = true
    loop = true
    volume = 1
    play = play
    pause = vi.fn()
    constructor(public src: string) { players.push(this) }
  })
  const music = await import('./jarvis-intro-music')
  music.playJarvisIntroOnStartup()
  music.playJarvisIntroOnStartup()
  music.startJarvisIntroMusic(true)
  expect(play).toHaveBeenCalledOnce()
  expect(players[0]).toMatchObject({ loop: false, volume: 0.3 })
  await vi.waitFor(() => { expect(music.isJarvisIntroMusicPlaying()).toBe(false) })
  players[0].paused = false
  players[0].currentTime = 12
  music.startJarvisIntroMusic(true)
  expect(play).toHaveBeenCalledOnce()
  expect(players[0].currentTime).toBe(12)
  players[0].ended = true
  players[0].paused = true
  music.startJarvisIntroMusic(true)
  expect(play).toHaveBeenCalledTimes(2)
  expect(players[0].currentTime).toBe(0)
  expect(music.isJarvisMusicPhrase('Hej, tatuś wrócił!')).toBe(true)
  expect(music.isJarvisMusicPhrase('TATUS WROCIL')).toBe(true)
  for (const text of ['tatuś w domu', 'tatuś wróciłby', 'Witaj, Cześku']) {
    expect(music.isJarvisMusicPhrase(text)).toBe(false)
  }
  vi.resetModules()
  const reloaded = await import('./jarvis-intro-music')
  reloaded.playJarvisIntroOnStartup()
  expect(play).toHaveBeenCalledTimes(2)
  vi.resetModules()
  vi.stubGlobal('window', { get sessionStorage() { throw new Error('Storage unavailable') } })
  const withoutStorage = await import('./jarvis-intro-music')
  withoutStorage.playJarvisIntroOnStartup()
  withoutStorage.playJarvisIntroOnStartup()
  expect(play).toHaveBeenCalledTimes(3)
})
