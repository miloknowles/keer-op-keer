'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Avatar from 'boring-avatars'
import { useRoomContext } from '@/lib/context/room'
import { createClient } from '@/lib/supabase/client'

const SEAT_COLORS: [string, string][] = [
  ['#E8437C', '#ffffff'], // pink
  ['#4264D4', '#ffffff'], // blue
  ['#E8C43A', '#ffffff'], // yellow
  ['#2FAD50', '#ffffff'], // green
  ['#E87820', '#ffffff'], // orange
]

const MAX_PLAYERS = 6

export default function LobbyPage() {
  const router = useRouter()
  const { room, players, me, isHost } = useRoomContext()
  const supabase = useRef(createClient()).current

  const [copied, setCopied] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleCopy() {
    navigator.clipboard.writeText(room.code.toUpperCase())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function startEditing(id: string, currentName: string) {
    setEditingId(id)
    setDraft(currentName)
    setTimeout(() => inputRef.current?.select(), 0)
  }

  async function commitEdit() {
    const trimmed = draft.trim()
    if (trimmed && editingId === me.id) {
      await supabase
        .from('room_players')
        .update({ display_name: trimmed })
        .eq('id', me.id)
      // Realtime UPDATE event updates the context for all clients
    }
    setEditingId(null)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') commitEdit()
    if (e.key === 'Escape') setEditingId(null)
  }

  async function handleStart() {
    setStarting(true)
    setStartError(null)
    const res = await fetch(`/api/rooms/${room.code}/start`, { method: 'POST' })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setStartError(body.error ?? 'Failed to start')
      setStarting(false)
    }
    // On success, Realtime rooms UPDATE triggers router.replace('/game') in context
  }

  async function handleKick(playerId: string) {
    await fetch(`/api/rooms/${room.code}/players/${playerId}`, { method: 'DELETE' })
    // Realtime DELETE event removes the player from context for everyone
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 bg-gray-200 min-h-screen px-4 py-12">
      {/* Room code */}
      <div className="flex flex-col items-center gap-1.5">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Room Code</p>
        <div className="flex items-center gap-3">
          <span className="text-5xl font-bold tracking-widest text-gray-800 select-all">
            {room.code.toUpperCase()}
          </span>
          <button
            onClick={handleCopy}
            className="text-sm font-semibold px-3 py-1.5 rounded-lg bg-white shadow-sm border border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-50 active:scale-95 transition-all"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Players */}
      <div className="w-full max-w-xs flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Players</p>
          <p className="text-xs text-gray-400">{players.length} / {MAX_PLAYERS}</p>
        </div>

        <div className="flex flex-col gap-2">
          {players.map((player) => {
            const isMe = player.id === me.id
            const isPlayerHost = player.id === room.host_id

            return (
              <div
                key={player.id}
                className="flex items-center gap-3 bg-white rounded-2xl px-4 py-3 shadow-sm"
              >
                <div className="shrink-0 rounded-full overflow-hidden shadow-sm">
                  <Avatar
                    name={player.display_name}
                    variant="beam"
                    size={36}
                    colors={SEAT_COLORS[player.seat_index % SEAT_COLORS.length]}
                  />
                </div>

                {isMe && editingId === player.id ? (
                  <input
                    ref={inputRef}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={commitEdit}
                    onKeyDown={handleKeyDown}
                    maxLength={20}
                    className="flex-1 min-w-0 font-semibold text-gray-800 bg-transparent border-b-2 border-kok-blue outline-none"
                  />
                ) : (
                  <span
                    className={`font-semibold text-gray-800 flex-1 ${isMe ? 'cursor-pointer hover:text-kok-blue transition-colors' : ''}`}
                    onClick={() => isMe && startEditing(player.id, player.display_name)}
                  >
                    {player.display_name}
                  </span>
                )}

                {isMe && editingId !== player.id && (
                  <span className="text-xs text-gray-400 font-medium">(you)</span>
                )}
                {isPlayerHost && (
                  <span className="text-xs font-bold text-kok-orange bg-kok-orange/10 px-2 py-0.5 rounded-full">
                    HOST
                  </span>
                )}
                {isHost && !isMe && editingId !== player.id && (
                  <button
                    onClick={() => handleKick(player.id)}
                    className="text-gray-300 hover:text-red-400 transition-colors shrink-0"
                    title="Remove player"
                  >
                    ✕
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {players.length < MAX_PLAYERS && (
          <p className="text-center text-xs text-gray-400 italic pt-1">
            Share the room code to invite more players
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col items-center gap-3 w-full max-w-xs">
        {isHost ? (
          <>
            <button
              onClick={handleStart}
              disabled={starting || players.length < 2}
              className="w-full bg-kok-green hover:brightness-110 hover:-translate-y-1 hover:shadow-lg active:translate-y-0.5 disabled:opacity-40 disabled:pointer-events-none text-white font-bold text-xl uppercase py-3.5 rounded-2xl shadow-md transition-all select-none"
            >
              {starting ? 'Starting…' : 'Start Game'}
            </button>
            {startError && (
              <p className="text-xs text-red-500">{startError}</p>
            )}
          </>
        ) : (
          <p className="text-gray-500 font-medium text-sm">
            Waiting for host to start&hellip;
          </p>
        )}
        <button
          onClick={() => router.replace('/')}
          className="text-sm text-gray-400 hover:text-gray-600 underline underline-offset-2 transition-colors"
        >
          Leave room
        </button>
      </div>
    </div>
  )
}
