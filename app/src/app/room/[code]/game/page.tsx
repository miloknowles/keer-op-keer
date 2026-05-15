'use client'

import { useState } from 'react'
import { ScoreSheet } from '@/components/game/ScoreSheet'
import { GameDice } from '@/components/game/GameDice'
import { ResourceTracks } from '@/components/game/ResourceTracks'
import { ChatWindow } from '@/components/game/ChatWindow'
import { useRoomContext } from '@/lib/context/room'
import type { DiceColorFace, DiceNumberFace, DiceSpecialFace, BoardConfig } from '@/types/game'
import rawBoard from '@/lib/kok2-standard.json'

const boardConfig = rawBoard as unknown as BoardConfig

type MockPlayer = {
  id: string
  name: string
  crossedCells: string[]
  hearts: number
  boxesUnlocked: number
  boxesSpent: number
  wildcards: number
  score: number
  isCurrentUser: boolean
  isActive: boolean
}

const MOCK_PLAYERS: MockPlayer[] = [
  {
    id: '1',
    name: 'Alice',
    crossedCells: ['H-P', 'H-Q', 'H-R', 'G-R', 'I-R', 'H-S', 'H-T', 'G-Q', 'I-Q', 'G-S'],
    hearts: 2,
    boxesUnlocked: 2,
    boxesSpent: 1,
    wildcards: 5,
    score: 12,
    isCurrentUser: true,
    isActive: true,
  },
  {
    id: '2',
    name: 'Bob',
    crossedCells: ['H-P', 'H-Q', 'G-Q', 'I-Q', 'H-R', 'H-S'],
    hearts: 1,
    boxesUnlocked: 1,
    boxesSpent: 0,
    wildcards: 4,
    score: 8,
    isCurrentUser: false,
    isActive: false,
  },
  {
    id: '3',
    name: 'Carol',
    crossedCells: ['H-P', 'H-Q', 'H-R', 'I-R', 'I-S', 'I-T', 'J-T', 'K-T', 'H-S', 'I-Q', 'J-Q'],
    hearts: 3,
    boxesUnlocked: 3,
    boxesSpent: 1,
    wildcards: 3,
    score: 15,
    isCurrentUser: false,
    isActive: false,
  },
]

const MOCK_DICE = {
  colors: ['p', 'g', 'b'] as [DiceColorFace, DiceColorFace, DiceColorFace],
  numbers: ['3', '1', '?'] as [DiceNumberFace, DiceNumberFace, DiceNumberFace],
  special: 'heart' as DiceSpecialFace,
}

export default function GamePage() {
  const { room, me, players } = useRoomContext()
  const [viewingId, setViewingId] = useState('1')
  const [chatOpen, setChatOpen] = useState(false)
  const [selectedColor, setSelectedColor] = useState<0 | 1 | 2 | undefined>()
  const [selectedNumber, setSelectedNumber] = useState<0 | 1 | 2 | undefined>()
  const [selectedCells, setSelectedCells] = useState<string[]>([])

  const viewing = MOCK_PLAYERS.find(p => p.id === viewingId)!
  const mockMe = MOCK_PLAYERS.find(p => p.isCurrentUser)!
  const isMyBoard = viewingId === mockMe.id

  const scoring = boardConfig.scoring

  function handleCellClick(key: string) {
    if (!isMyBoard) return
    setSelectedCells(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
  }

  function handleColorPick(i: 0 | 1 | 2) {
    setSelectedColor(prev => prev === i ? undefined : i)
  }

  function handleNumberPick(i: 0 | 1 | 2) {
    setSelectedNumber(prev => prev === i ? undefined : i)
  }

  function clearPick() {
    setSelectedColor(undefined)
    setSelectedNumber(undefined)
    setSelectedCells([])
  }

  const canConfirm = isMyBoard && selectedColor !== undefined && selectedNumber !== undefined && selectedCells.length > 0

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-5 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-black text-kok-orange tracking-wide uppercase">Keer op Keer 2</span>
          <span className="text-gray-300">|</span>
          <span className="font-mono font-bold text-gray-600 tracking-widest text-sm">XKQZ</span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-gray-500">Round <span className="font-bold text-gray-800">5</span></span>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-kok-green animate-pulse" />
            <span className="font-medium text-kok-green">Alice's turn</span>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Board area */}
        <main className="flex-1 p-5 overflow-auto">
          {/* Player tabs */}
          <div className="flex gap-1.5 mb-4">
            {MOCK_PLAYERS.map(p => (
              <button
                key={p.id}
                onClick={() => setViewingId(p.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                  viewingId === p.id
                    ? 'bg-kok-blue text-white shadow-sm'
                    : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                }`}
              >
                {p.name}{p.isCurrentUser && ' (you)'}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-3 w-fit">
            {/* Score sheet */}
            <div className="bg-white rounded-xl shadow-sm p-4">
              <ScoreSheet
                config={boardConfig}
                crossedCells={viewing.crossedCells}
                selectedCells={isMyBoard ? selectedCells : []}
                onCellClick={isMyBoard ? handleCellClick : undefined}
              />
            </div>

            {/* Resource tracks for viewed player */}
            <div className="bg-white rounded-xl shadow-sm px-4 py-3">
              <ResourceTracks
                hearts={viewing.hearts}
                heartSize={scoring.heartTrack.size}
                boxesUnlocked={viewing.boxesUnlocked}
                boxesSpent={viewing.boxesSpent}
                boxSize={scoring.boxTrack.size}
                wildcards={viewing.wildcards}
                wildcardStart={scoring.wildcardTrack.starting}
              />
            </div>
          </div>
        </main>

        {/* Game actions sidebar */}
        <aside className="w-60 shrink-0 bg-white border-l border-gray-200 flex flex-col overflow-y-auto">
          {/* Players list */}
          <div className="p-4 border-b border-gray-100">
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Players</div>
            <div className="flex flex-col gap-1">
              {MOCK_PLAYERS.map(p => (
                <div
                  key={p.id}
                  className={`flex items-center justify-between px-2.5 py-2 rounded-lg text-sm ${
                    p.isActive ? 'bg-kok-green/10 border border-kok-green/25' : 'bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${p.isActive ? 'bg-kok-green' : 'bg-gray-300'}`} />
                    <span className="font-medium text-gray-800">
                      {p.name}
                      {p.isCurrentUser && <span className="text-gray-400 text-xs font-normal"> (you)</span>}
                    </span>
                  </div>
                  <span className="font-bold text-gray-700 tabular-nums">{p.score}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Dice roll */}
          <div className="p-4 border-b border-gray-100">
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Dice Roll</div>
            <GameDice
              colors={MOCK_DICE.colors}
              numbers={MOCK_DICE.numbers}
              special={MOCK_DICE.special}
              selectedColor={isMyBoard ? selectedColor : undefined}
              selectedNumber={isMyBoard ? selectedNumber : undefined}
              onSelectColor={isMyBoard ? handleColorPick : undefined}
              onSelectNumber={isMyBoard ? handleNumberPick : undefined}
            />
          </div>

          {/* Pick status + actions */}
          {isMyBoard && (
            <div className="p-4 flex flex-col gap-2">
              <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Your Pick</div>
              <div className="text-xs text-gray-500 space-y-0.5">
                <div>
                  Color: {selectedColor !== undefined
                    ? <span className="font-semibold text-gray-700">{MOCK_DICE.colors[selectedColor].toUpperCase()}</span>
                    : <span className="italic">none</span>}
                </div>
                <div>
                  Number: {selectedNumber !== undefined
                    ? <span className="font-semibold text-gray-700">{MOCK_DICE.numbers[selectedNumber]}</span>
                    : <span className="italic">none</span>}
                </div>
                <div>
                  Cells: {selectedCells.length > 0
                    ? <span className="font-semibold text-gray-700">{selectedCells.join(', ')}</span>
                    : <span className="italic">none selected</span>}
                </div>
              </div>
              <button
                disabled={!canConfirm}
                className="mt-1 w-full py-2 rounded-lg bg-kok-blue text-white font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 transition-all"
              >
                Confirm Pick
              </button>
              <button
                onClick={clearPick}
                className="w-full py-1.5 rounded-lg bg-gray-100 text-gray-600 font-medium text-sm hover:bg-gray-200 transition-all"
              >
                Clear
              </button>
            </div>
          )}
        </aside>

        {/* Chat column */}
        {chatOpen && (
          <aside className="w-72 shrink-0 bg-white border-l border-gray-200 flex flex-col overflow-hidden">
            <ChatWindow roomId={room.id} playerId={me.id} players={players} onClose={() => setChatOpen(false)} />
          </aside>
        )}
      </div>

      {/* Floating chat toggle */}
      {!chatOpen && (
        <button
          onClick={() => setChatOpen(true)}
          className="fixed bottom-5 right-5 w-12 h-12 rounded-full bg-kok-blue text-white shadow-lg flex items-center justify-center hover:brightness-110 transition-all"
          aria-label="Open chat"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <path d="M2 4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6l-4 3V4z" />
          </svg>
        </button>
      )}
    </div>
  )
}
