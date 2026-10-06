import type { RailCardId } from './rail-layout'

/** Words of the rail's own controls: dragging, the customise menu and the screen-reader announcements. */
export interface RailCardCopy {
  cards: Record<RailCardId, string>
  customize: string
  customizeHint: string
  down: (name: string) => string
  dragCancelled: (name: string) => string
  dragMoved: (name: string, position: number, total: number) => string
  dragStart: (name: string) => string
  dragDropped: (name: string, position: number, total: number) => string
  grip: (name: string) => string
  presets: Record<'minimal' | 'news' | 'work', string>
  presetsLabel: string
  instructions: string
  reset: string
  show: (name: string) => string
  up: (name: string) => string
}

const pl: RailCardCopy = {
  cards: {
    agents: 'Agenci',
    connect: 'Połącz więcej',
    insights: 'Statystyki',
    memory: 'Pamięć',
    model: 'Model i tryb',
    news: 'Newsy AI',
    'quick-access': 'Szybki dostęp',
    start: 'Zacznij tutaj'
  },
  customize: 'Dostosuj panel',
  customizeHint: 'Przeciągnij kartę za nagłówek albo użyj strzałek. Ukryta karta niczego nie pobiera.',
  down: name => `Przesuń niżej: ${name}`,
  dragCancelled: name => `Anulowano przesuwanie: ${name}.`,
  dragDropped: (name, position, total) => `${name} upuszczona na pozycji ${position} z ${total}.`,
  dragMoved: (name, position, total) => `${name}: pozycja ${position} z ${total}.`,
  dragStart: name => `Podniesiono kartę ${name}.`,
  grip: name => `Przesuń kartę: ${name}`,
  presets: { minimal: 'Minimalny', news: 'Newsy', work: 'Praca' },
  presetsLabel: 'Gotowe układy',
  instructions: 'Spacja podnosi kartę, strzałki w górę i w dół ją przesuwają, spacja upuszcza, Escape anuluje.',
  reset: 'Przywróć domyślny układ',
  show: name => `Pokaż kartę: ${name}`,
  up: name => `Przesuń wyżej: ${name}`
}

const en: RailCardCopy = {
  cards: {
    agents: 'Agents',
    connect: 'Connect more',
    insights: 'Statistics',
    memory: 'Memory',
    model: 'Model and mode',
    news: 'AI news',
    'quick-access': 'Quick access',
    start: 'Start here'
  },
  customize: 'Customize panel',
  customizeHint: 'Drag a card by its header or use the arrows. A hidden card fetches nothing.',
  down: name => `Move down: ${name}`,
  dragCancelled: name => `Moving ${name} cancelled.`,
  dragDropped: (name, position, total) => `${name} dropped at position ${position} of ${total}.`,
  dragMoved: (name, position, total) => `${name}: position ${position} of ${total}.`,
  dragStart: name => `Picked up the ${name} card.`,
  grip: name => `Move card: ${name}`,
  presets: { minimal: 'Minimal', news: 'News', work: 'Work' },
  presetsLabel: 'Ready-made layouts',
  instructions: 'Space picks a card up, the up and down arrows move it, space drops it, Escape cancels.',
  reset: 'Restore the default layout',
  show: name => `Show card: ${name}`,
  up: name => `Move up: ${name}`
}

export const RAIL_CARD_COPY = { en, pl } as const
