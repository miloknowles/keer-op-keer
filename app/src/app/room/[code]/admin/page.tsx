"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useRoomContext } from "@/lib/context/room";
import { ScoreSheet } from "@/components/game/ScoreSheet";
import { colorsCompleted } from "@/lib/game/sheet";
import { DEV_ADMIN_BOARD } from "@/lib/devFlags";
import { toast } from "sonner";
import type { BoardConfig } from "@/boards/board.types";

export default function AdminPage() {
  const { room, players, board } = useRoomContext();
  const router = useRouter();
  const boardConfig = board.config as unknown as BoardConfig;

  const [selectedPlayerId, setSelectedPlayerId] = useState<string>(players[0]?.id ?? "");
  const [localCrossed, setLocalCrossed] = useState<Set<string>>(
    new Set(players[0]?.crossed_cells ?? []),
  );
  const [localHearts, setLocalHearts] = useState<number>(players[0]?.hearts ?? 0);
  const [localBoxesUnlocked, setLocalBoxesUnlocked] = useState<number>(
    players[0]?.boxes_unlocked ?? 1,
  );
  const [localBoxesSpent, setLocalBoxesSpent] = useState<number>(players[0]?.boxes_spent ?? 0);
  const [localWildcards, setLocalWildcards] = useState<number>(players[0]?.wildcards ?? 6);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const p = players.find((p) => p.id === selectedPlayerId);
    if (!p) return;
    setLocalCrossed(new Set(p.crossed_cells));
    setLocalHearts(p.hearts);
    setLocalBoxesUnlocked(p.boxes_unlocked);
    setLocalBoxesSpent(p.boxes_spent);
    setLocalWildcards(p.wildcards);
  }, [selectedPlayerId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!DEV_ADMIN_BOARD) {
    router.replace(`/room/${room.code}/game`);
    return null;
  }

  function handleCellToggle(key: string) {
    setLocalCrossed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleReset() {
    const p = players.find((p) => p.id === selectedPlayerId);
    if (!p) return;
    setLocalCrossed(new Set(p.crossed_cells));
    setLocalHearts(p.hearts);
    setLocalBoxesUnlocked(p.boxes_unlocked);
    setLocalBoxesSpent(p.boxes_spent);
    setLocalWildcards(p.wildcards);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/rooms/${room.code}/dev/set-board`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          player_id: selectedPlayerId,
          crossed_cells: Array.from(localCrossed),
          hearts: localHearts,
          boxes_unlocked: localBoxesUnlocked,
          boxes_spent: localBoxesSpent,
          wildcards: localWildcards,
        }),
      });
      if (res.ok) {
        toast.success("Board saved");
      } else {
        const body = await res.json().catch(() => ({}));
        toast.error((body as { error?: string }).error ?? "Save failed");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSaving(false);
    }
  }

  const allCellKeys = Object.keys(boardConfig.cells);
  const completed = colorsCompleted(boardConfig, Array.from(localCrossed));
  const threshold = boardConfig.scoring.gameEnd.colorsCompleted;
  const atThreshold = completed.length >= threshold;

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      <header className="bg-white border-b border-gray-200 px-5 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-black text-kok-orange tracking-wide uppercase">
            Admin Board Editor
          </span>
          <span className="text-gray-300">|</span>
          <span className="font-mono font-bold text-gray-600 tracking-widest text-sm">
            {room.code.toUpperCase()}
          </span>
        </div>
        <Link
          href={`/room/${room.code}/game`}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 7H2M6 3l-4 4 4 4" />
          </svg>
          Back to game
        </Link>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 p-5 overflow-auto">
          <div className="flex gap-1.5 mb-4">
            {players.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedPlayerId(p.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                  selectedPlayerId === p.id
                    ? "bg-kok-orange text-white shadow-sm"
                    : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-200"
                }`}
              >
                {p.display_name}
              </button>
            ))}
          </div>

          <ScoreSheet
            config={boardConfig}
            crossedCells={Array.from(localCrossed)}
            onCellClick={handleCellToggle}
          />
        </main>

        <aside className="w-64 bg-white border-l border-gray-200 p-4 flex flex-col gap-5 overflow-auto shrink-0">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Colors completed
            </p>
            <p className={`text-lg font-black ${atThreshold ? "text-kok-green" : "text-gray-800"}`}>
              {completed.length} / {threshold}
            </p>
            {atThreshold && (
              <p className="text-xs text-kok-green font-semibold mt-0.5">Game ends on save</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Resources
            </p>
            {[
              {
                label: "Hearts",
                value: localHearts,
                set: setLocalHearts,
                min: 0,
                max: boardConfig.scoring.heartTrack.size,
              },
              {
                label: "Boxes unlocked",
                value: localBoxesUnlocked,
                set: setLocalBoxesUnlocked,
                min: 0,
                max: boardConfig.scoring.boxTrack.size,
              },
              {
                label: "Boxes spent",
                value: localBoxesSpent,
                set: setLocalBoxesSpent,
                min: 0,
                max: localBoxesUnlocked,
              },
              {
                label: "Wildcards",
                value: localWildcards,
                set: setLocalWildcards,
                min: 0,
                max: boardConfig.scoring.wildcardTrack.starting,
              },
            ].map(({ label, value, set, min, max }) => (
              <label key={label} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-gray-700">{label}</span>
                <input
                  type="number"
                  value={value}
                  min={min}
                  max={max}
                  onChange={(e) => set(Math.max(min, Math.min(max, Number(e.target.value))))}
                  className="w-16 border border-gray-300 rounded px-2 py-0.5 text-right text-sm"
                />
              </label>
            ))}
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Shortcuts
            </p>
            <button
              onClick={() => setLocalCrossed(new Set(allCellKeys))}
              className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors text-left"
            >
              Cross all
            </button>
            <button
              onClick={() => setLocalCrossed(new Set())}
              className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors text-left"
            >
              Clear all
            </button>
            <button
              onClick={handleReset}
              className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors text-left"
            >
              Reset to saved
            </button>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="mt-auto px-4 py-2 rounded-lg bg-kok-orange text-white font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </aside>
      </div>
    </div>
  );
}
