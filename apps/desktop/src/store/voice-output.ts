import { atom } from 'nanostores'

/**
 * Whether the assistant's voice is switched off for the running conversation. It is about what you hear,
 * not what is said: the conversation goes on, the transcript still fills, only the speaker is silent.
 * It resets when the conversation ends, so the next one never starts silent by surprise.
 */
export const $speakerMuted = atom(false)

export const toggleSpeakerMuted = () => $speakerMuted.set(!$speakerMuted.get())
