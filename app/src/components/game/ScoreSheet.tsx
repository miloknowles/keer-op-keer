'use client'

import { cn } from '@/lib/utils'
import type { BoardConfig, Color } from '@/types/game'

const COLOR_BG: Record<Color, string> = {
  p: 'bg-kok-pink',
  o: 'bg-kok-orange',
  y: 'bg-kok-yellow',
  g: 'bg-kok-green',
  b: 'bg-kok-blue',
}

// JSON stores specials as flat booleans; types use special?: "star"|"box"
type RawCell = { color: Color; star?: boolean; box?: boolean; special?: string }

interface ScoreSheetProps {
  config: BoardConfig
  crossedCells: string[]
  selectedCells?: string[]
  onCellClick?: (cellKey: string) => void
}

export function ScoreSheet({ config, crossedCells, selectedCells = [], onCellClick }: ScoreSheetProps) {
  const { grid, scoring } = config
  const cells = config.cells as unknown as Record<string, RawCell>
  const crossedSet = new Set(crossedCells)
  const selectedSet = new Set(selectedCells)

  return (
    <div className="select-none">
      {/* Column labels */}
      <div className="flex gap-0.5 mb-0.5 ml-6">
        {grid.columns.map(col => (
          <div key={col} className="w-8 text-center text-[10px] font-bold text-gray-500 shrink-0">
            {col}
          </div>
        ))}
        <div className="w-8 shrink-0" /> {/* row item spacer */}
      </div>

      {/* Rows */}
      <div className="flex flex-col gap-0.5">
        {grid.rows.map(row => {
          const rowItem = (scoring.rowItems as Record<string, string>)[row]
          return (
            <div key={row} className="flex items-center gap-0.5">
              {/* Row label */}
              <div className="w-6 text-center text-[10px] font-bold text-gray-500 shrink-0">{row}</div>

              {/* Cells */}
              {grid.columns.map(col => {
                const key = `${col}-${row}`
                const cell = cells[key]

                if (!cell) {
                  return <div key={key} className="w-8 h-8 shrink-0 rounded bg-gray-50" />
                }

                const color = cell.color
                const isStar = cell.star === true || cell.special === 'star'
                const isBox = cell.box === true || cell.special === 'box'
                const isCrossed = crossedSet.has(key)
                const isSelected = selectedSet.has(key)

                return (
                  <button
                    key={key}
                    onClick={() => onCellClick?.(key)}
                    className={cn(
                      'w-8 h-8 shrink-0 rounded relative flex items-center justify-center transition-all',
                      COLOR_BG[color],
                      isCrossed && 'brightness-90',
                      isSelected && 'ring-2 ring-inset ring-black/70',
                      onCellClick && !isCrossed && 'hover:brightness-110 cursor-pointer',
                      !onCellClick && 'cursor-default',
                    )}
                  >
                    {!isCrossed && isStar && (
                      <span className="absolute top-0.5 right-0.5 text-white/80 text-[8px] leading-none">★</span>
                    )}
                    {!isCrossed && isBox && (
                      <span className="absolute top-0.5 right-0.5 text-white/80 text-[8px] leading-none">◈</span>
                    )}
                    {isCrossed && (
                      <span className="text-white font-black text-sm leading-none pointer-events-none">✕</span>
                    )}
                  </button>
                )
              })}

              {/* Row item reward */}
              <div className="w-8 h-8 shrink-0 flex items-center justify-center text-base ml-1">
                {rowItem === 'heart' && <span className="text-red-500">♥</span>}
                {rowItem === 'box' && <span className="text-gray-500 text-xs font-bold">BOX</span>}
                {rowItem === 'bomb' && <span>💣</span>}
              </div>
            </div>
          )
        })}
      </div>

      {/* Column bonus footer */}
      <div className="flex gap-0.5 mt-1 ml-6">
        {grid.columns.map(col => {
          const bonus = (scoring.columnBonuses as Record<string, { first: number; subsequent: number }>)[col]
          return (
            <div key={col} className="w-8 text-center shrink-0">
              <div className="text-[10px] font-bold text-gray-700 leading-tight">{bonus?.first}</div>
              <div className="text-[9px] text-gray-400 leading-tight">{bonus?.subsequent}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
