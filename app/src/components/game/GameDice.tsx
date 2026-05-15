'use client'

import { cn } from '@/lib/utils'
import type { DiceColorFace, DiceNumberFace, DiceSpecialFace } from '@/types/game'

const SPECIAL_LABEL: Record<DiceSpecialFace, string> = {
  heart: '♥',
  fill: '≋',
  three_in_a_row: '|||',
  bomb: '💣',
  two_stars: '★★',
}

const SPECIAL_DESCRIPTION: Record<DiceSpecialFace, string> = {
  heart: 'Heart (+1 heart track)',
  fill: 'Fill (connected section)',
  three_in_a_row: '3-in-a-row',
  bomb: 'Bomb (any 2×2)',
  two_stars: 'Two stars (any 2 ★)',
}

const COLOR_FACE_BG: Record<DiceColorFace, string> = {
  p: 'bg-kok-pink text-white',
  o: 'bg-kok-orange text-white',
  y: 'bg-kok-yellow text-white',
  g: 'bg-kok-green text-white',
  b: 'bg-kok-blue text-white',
  '✕': 'bg-gray-800 text-white',
}

const COLOR_FACE_LABEL: Record<DiceColorFace, string> = {
  p: 'P',
  o: 'O',
  y: 'Y',
  g: 'G',
  b: 'B',
  '✕': '✕',
}

interface GameDiceProps {
  colors: [DiceColorFace, DiceColorFace, DiceColorFace]
  numbers: [DiceNumberFace, DiceNumberFace, DiceNumberFace]
  special: DiceSpecialFace
  selectedColor?: 0 | 1 | 2
  selectedNumber?: 0 | 1 | 2
  onSelectColor?: (i: 0 | 1 | 2) => void
  onSelectNumber?: (i: 0 | 1 | 2) => void
}

export function GameDice({
  colors,
  numbers,
  special,
  selectedColor,
  selectedNumber,
  onSelectColor,
  onSelectNumber,
}: GameDiceProps) {
  return (
    <div className="flex flex-col gap-3">
      {/* Color dice */}
      <div>
        <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Color</div>
        <div className="flex gap-1.5">
          {colors.map((face, i) => (
            <button
              key={i}
              onClick={() => onSelectColor?.(i as 0 | 1 | 2)}
              className={cn(
                'w-11 h-11 rounded-lg flex items-center justify-center font-bold text-xs shadow',
                COLOR_FACE_BG[face],
                selectedColor === i
                  ? 'ring-2 ring-offset-2 ring-black scale-110 shadow-lg'
                  : onSelectColor && 'hover:scale-105 hover:shadow-md cursor-pointer',
                'transition-transform',
              )}
            >
              {COLOR_FACE_LABEL[face]}
            </button>
          ))}
        </div>
      </div>

      {/* Number dice */}
      <div>
        <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Number</div>
        <div className="flex gap-1.5">
          {numbers.map((face, i) => (
            <button
              key={i}
              onClick={() => onSelectNumber?.(i as 0 | 1 | 2)}
              className={cn(
                'w-11 h-11 rounded-lg flex items-center justify-center font-black text-lg shadow',
                'bg-white border-2 text-gray-800',
                face === '?' ? 'text-gray-400 border-gray-200' : 'border-gray-300',
                selectedNumber === i
                  ? 'ring-2 ring-offset-2 ring-black scale-110 shadow-lg border-gray-800'
                  : onSelectNumber && 'hover:scale-105 hover:shadow-md cursor-pointer',
                'transition-transform',
              )}
            >
              {face}
            </button>
          ))}
        </div>
      </div>

      {/* Special die */}
      <div>
        <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Special</div>
        <div className="flex items-center gap-2">
          <div className="w-11 h-11 rounded-lg flex items-center justify-center text-lg bg-amber-50 border-2 border-amber-300 shadow shrink-0">
            {SPECIAL_LABEL[special]}
          </div>
          <span className="text-xs text-gray-500">{SPECIAL_DESCRIPTION[special]}</span>
        </div>
      </div>
    </div>
  )
}
