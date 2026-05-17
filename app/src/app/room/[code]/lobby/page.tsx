"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSound } from "react-sounds";
import { useRoomContext } from "@/lib/context/room";
import { createClient } from "@/lib/supabase/client";
import { NAME_KEY } from "@/lib/utils";
import { DEV_MULTI_SEAT } from "@/lib/devFlags";
import { MAX_PLAYERS } from "@/lib/constants";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { SettingsDialog } from "./settings-dialog";

export default function LobbyPage() {
  const router = useRouter();
  const { room, players, me, isHost } = useRoomContext();
  const supabase = useRef(createClient()).current;

  const { play: playJoinSound } = useSound("system/device_connect", { volume: 0.6 });
  const prevPlayerCountRef = useRef<number | null>(null);
  useEffect(() => {
    if (prevPlayerCountRef.current === null) {
      prevPlayerCountRef.current = players.length;
      return;
    }
    if (players.length > prevPlayerCountRef.current) playJoinSound();
    prevPlayerCountRef.current = players.length;
  }, [players.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const [copied, setCopied] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [addingPlayer, setAddingPlayer] = useState(false);
  const [addingBot, setAddingBot] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleCopy() {
    navigator.clipboard.writeText(room.code.toUpperCase());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function startEditing(id: string, currentName: string) {
    setEditingId(id);
    setDraft(currentName);
    setTimeout(() => inputRef.current?.select(), 0);
  }

  async function commitEdit() {
    const trimmed = draft.trim();
    if (trimmed && editingId === me.id) {
      await supabase
        .from("room_players")
        .update({ display_name: trimmed })
        .eq("id", me.id);
      localStorage.setItem(NAME_KEY, trimmed);
      // Realtime UPDATE event updates the context for all clients
    }
    setEditingId(null);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") commitEdit();
    if (e.key === "Escape") setEditingId(null);
  }

  async function handleStart() {
    setStarting(true);
    setStartError(null);
    const res = await fetch(`/api/rooms/${room.code}/start`, {
      method: "POST",
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setStartError(body.error ?? "Failed to start");
      setStarting(false);
    }
    // On success, Realtime rooms UPDATE triggers router.replace('/game') in context
  }

  async function handleKick(playerId: string) {
    await fetch(`/api/rooms/${room.code}/players/${playerId}`, {
      method: "DELETE",
    });
    // Realtime DELETE event removes the player from context for everyone
  }

  async function handleAddBot() {
    setAddingBot(true);
    await fetch(`/api/rooms/${room.code}/add-bot`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bot_type: "greedy" }),
    });
    setAddingBot(false);
  }

  async function handleAddTestPlayer() {
    setAddingPlayer(true);
    const testPlayerNum = players.filter((p) => p.user_id === me.user_id).length + 1;
    await fetch(`/api/rooms/${room.code}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ display_name: `Test Player ${testPlayerNum}` }),
    });
    setAddingPlayer(false);
    // Realtime INSERT event adds the new player to context for everyone
  }

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center gap-8 bg-gray-200 min-h-screen px-4 py-12">
      <div className="absolute top-4 right-4">
        <SettingsDialog isHost={isHost} />
      </div>
      {/* Room code */}
      <div className="flex flex-col items-center gap-1.5">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
          Room Code
        </p>
        <div className="flex items-center gap-3">
          <span className="text-5xl font-bold tracking-widest text-gray-800 select-all">
            {room.code.toUpperCase()}
          </span>
          <button
            onClick={handleCopy}
            className="text-sm font-semibold px-3 py-1.5 rounded-lg bg-white shadow-sm border border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-50 active:scale-95 transition-all"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>

      {/* Players */}
      <div className="w-full max-w-xs flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
            Players
          </p>
          <p className="text-xs text-gray-400">
            {players.length} / {MAX_PLAYERS}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          {players.map((player) => {
            const isMe = player.id === me.id;
            const isPlayerHost = player.id === room.host_id;

            return (
              <div
                key={player.id}
                className="flex items-center gap-3 bg-white rounded-2xl px-4 py-3 shadow-sm"
              >
                <div className="shrink-0 rounded-full overflow-hidden shadow-sm">
                  <PlayerAvatar name={player.display_name} seatIndex={player.seat_index} size={36} />
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
                  <span className="font-semibold text-gray-800 flex-1">
                    {player.display_name}
                  </span>
                )}

                {isMe && editingId !== player.id && (
                  <button
                    onClick={() => startEditing(player.id, player.display_name)}
                    className="text-xs text-gray-400 hover:text-kok-blue transition-colors shrink-0 flex items-center gap-1"
                    title="Edit your name"
                  >
                    <span>✎</span>
                  </button>
                )}
                {player.is_bot && (
                  <span className="text-xs font-bold text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">
                    BOT
                  </span>
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
            );
          })}
        </div>

        {players.length < MAX_PLAYERS && (
          <p className="text-center text-xs text-gray-400 italic pt-1">
            Share the room code to invite more players
          </p>
        )}

        {isHost && players.length < MAX_PLAYERS && (
          <button
            onClick={handleAddBot}
            disabled={addingBot}
            className="w-full mt-1 text-xs font-semibold px-3 py-2 rounded-lg bg-gray-200 text-gray-600 hover:bg-gray-300 disabled:opacity-40 disabled:pointer-events-none transition-all"
          >
            {addingBot ? "Adding…" : "+ Add Bot"}
          </button>
        )}

        {DEV_MULTI_SEAT && (
          <button
            onClick={handleAddTestPlayer}
            disabled={addingPlayer || players.length >= MAX_PLAYERS}
            className="w-full mt-2 text-xs font-semibold px-3 py-2 rounded-lg bg-gray-300 text-gray-700 hover:bg-gray-400 disabled:opacity-40 disabled:pointer-events-none transition-all"
          >
            {addingPlayer ? "Adding…" : "+ Add test player"}
          </button>
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
              {starting ? "Starting…" : "Start Game"}
            </button>
            {startError && <p className="text-xs text-red-500">{startError}</p>}
          </>
        ) : (
          <p className="text-gray-500 font-medium text-sm">
            Waiting for host to start&hellip;
          </p>
        )}
        <button
          onClick={async () => {
            await fetch(`/api/rooms/${room.code}/players/${me.id}`, {
              method: "DELETE",
            });
            router.replace("/");
          }}
          className="text-sm text-gray-400 hover:text-gray-600 underline underline-offset-2 transition-colors"
        >
          Leave room
        </button>
      </div>
    </div>
  );
}
