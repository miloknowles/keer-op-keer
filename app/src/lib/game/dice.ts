import type { DiceColorFace, DiceNumberFace, DiceSpecialFace, DiceRoll } from '../../types/game'

export const COLOR_FACES: DiceColorFace[] = ['p', 'o', 'y', 'g', 'b', '✕']
export const NUMBER_FACES: DiceNumberFace[] = ['1', '2', '3', '4', '5', '?']
// heart appears twice to give it 2/6 probability
export const SPECIAL_FACES: DiceSpecialFace[] = ['heart', 'heart', 'fill', 'three_in_a_row', 'bomb', 'two_stars']

function pick<T>(faces: T[]): T {
  return faces[Math.floor(Math.random() * faces.length)]
}

export function rollDice(): DiceRoll {
  return {
    colors: [pick(COLOR_FACES), pick(COLOR_FACES), pick(COLOR_FACES)],
    numbers: [pick(NUMBER_FACES), pick(NUMBER_FACES), pick(NUMBER_FACES)],
    special: pick(SPECIAL_FACES),
  }
}

export function isColorWildcard(face: DiceColorFace): boolean {
  return face === '✕'
}

export function isNumberWildcard(face: DiceNumberFace): boolean {
  return face === '?'
}
