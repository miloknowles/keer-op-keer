"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Avatar from "boring-avatars";

// Hex equivalents of the kok oklch colors, paired with white for duotone beam
const SEAT_COLORS: [string, string][] = [
  ["#E8437C", "#ffffff"], // pink
  ["#4264D4", "#ffffff"], // blue
  ["#E8C43A", "#ffffff"], // yellow
  ["#2FAD50", "#ffffff"], // green
  ["#E87820", "#ffffff"], // orange
];

const INITIAL_PLAYERS = [
  { id: "1", display_name: "Milo", seat_index: 0, is_host: true, is_me: true },
  { id: "2", display_name: "Anna", seat_index: 1, is_host: false, is_me: false },
  { id: "3", display_name: "Tom", seat_index: 2, is_host: false, is_me: false },
];

const IS_HOST = true;
const MAX_PLAYERS = 6;

export function LobbyView({ code }: { code: string }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [players, setPlayers] = useState(INITIAL_PLAYERS);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function startEditing(id: string, currentName: string) {
    setEditingId(id);
    setDraft(currentName);
    setTimeout(() => inputRef.current?.select(), 0);
  }

  function commitEdit() {
    const trimmed = draft.trim();
    if (trimmed && editingId) {
      setPlayers((prev) =>
        prev.map((p) => (p.id === editingId ? { ...p, display_name: trimmed } : p))
      );
    }
    setEditingId(null);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") commitEdit();
    if (e.key === "Escape") setEditingId(null);
  }

  function handleCopy() {
    navigator.clipboard.writeText(code.toUpperCase());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 bg-gray-200 min-h-screen px-4 py-12">
      {/* Room code */}
      <div className="flex flex-col items-center gap-1.5">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Room Code</p>
        <div className="flex items-center gap-3">
          <span className="text-5xl font-bold tracking-widest text-gray-800 select-all">
            {code.toUpperCase()}
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
          {players.map((player) => (
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

              {player.is_me && editingId === player.id ? (
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
                  className={`font-semibold text-gray-800 flex-1 ${player.is_me ? "cursor-pointer hover:text-kok-blue transition-colors" : ""}`}
                  onClick={() => player.is_me && startEditing(player.id, player.display_name)}
                >
                  {player.display_name}
                </span>
              )}

              {player.is_me && editingId !== player.id && (
                <span className="text-xs text-gray-400 font-medium">(you)</span>
              )}
              {player.is_host && (
                <span className="text-xs font-bold text-kok-orange bg-kok-orange/10 px-2 py-0.5 rounded-full">
                  HOST
                </span>
              )}
            </div>
          ))}
        </div>

        {players.length < MAX_PLAYERS && (
          <p className="text-center text-xs text-gray-400 italic pt-1">
            Share the room code to invite more players
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col items-center gap-3 w-full max-w-xs">
        {IS_HOST ? (
          <button
            disabled={players.length < 2}
            className="w-full bg-kok-green hover:brightness-110 hover:-translate-y-1 hover:shadow-lg active:translate-y-0.5 disabled:opacity-40 disabled:pointer-events-none text-white font-bold text-xl uppercase py-3.5 rounded-2xl shadow-md transition-all select-none"
          >
            Start Game
          </button>
        ) : (
          <p className="text-gray-500 font-medium text-sm">
            Waiting for host to start&hellip;
          </p>
        )}
        <button
          onClick={() => router.push("/")}
          className="text-sm text-gray-400 hover:text-gray-600 underline underline-offset-2 transition-colors"
        >
          Leave room
        </button>
      </div>
    </div>
  );
}
