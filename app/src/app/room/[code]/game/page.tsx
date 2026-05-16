"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Avatar from "boring-avatars";
import { isRowComplete, isColumnComplete, isValidPlacement } from "@/lib/game/sheet";
import { isColorWildcard, isNumberWildcard } from "@/lib/game/dice";
import { ScoreSheet } from "@/components/game/ScoreSheet";
import { GameDice } from "@/components/game/GameDice";
import { ResourceTracks } from "@/components/game/ResourceTracks";
import { ChatWindow } from "@/components/game/ChatWindow";
import { useRoomContext } from "@/lib/context/room";
import { createClient } from "@/lib/supabase/client";
import { usePresence } from "@/hooks/use-presence";
import { useRoomChat } from "@/hooks/use-room-chat";
import { DEV_MULTI_SEAT } from "@/lib/devFlags";
import type {
  DiceColorFace,
  DiceNumberFace,
  BoardConfig,
  RoomHistoryRow,
  Color,
} from "@/types/game";
import type { PlayerPresence } from "@/types/presence";

const COLOR_NAMES: Record<string, string> = {
  p: "pink",
  o: "orange",
  y: "yellow",
  g: "green",
  b: "blue",
};

const SEAT_COLORS: [string, string][] = [
  ["#E8437C", "#ffffff"],
  ["#4264D4", "#ffffff"],
  ["#E8C43A", "#ffffff"],
  ["#2FAD50", "#ffffff"],
  ["#E87820", "#ffffff"],
];

const SEAT_TO_COLOR: Record<number, Color> = {
  0: "p",
  1: "b",
  2: "y",
  3: "g",
  4: "o",
};

export default function GamePage() {
  const { room, me, players, board } = useRoomContext();
  const boardConfig = board.config as unknown as BoardConfig;

  const supabase = useRef(createClient()).current;
  const [currentHistory, setCurrentHistory] = useState<RoomHistoryRow | null>(
    null,
  );

  const [viewingId, setViewingId] = useState(me.id);
  const [chatOpen, setChatOpen] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [selectedColor, setSelectedColor] = useState<0 | 1 | 2 | undefined>();
  const [selectedNumber, setSelectedNumber] = useState<0 | 1 | 2 | undefined>();
  const [selectedCells, setSelectedCells] = useState<string[]>([]);
  const [hoveredCell, setHoveredCell] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const { unreadCount, resetUnreadCount } = useRoomChat(room.id, me.id);

  useEffect(() => {
    if (chatOpen) {
      resetUnreadCount();
    }
  }, [chatOpen, resetUnreadCount]);

  const { presences, updatePresence } = usePresence(room.id, {
    userId: me.id,
    displayName: me.display_name,
    color: SEAT_TO_COLOR[me.seat_index] ?? "p",
    cursor: { cellKey: hoveredCell, boardOwnerId: viewingId },
  });

  useEffect(() => {
    supabase
      .from("room_history")
      .select("*")
      .eq("room_id", room.id)
      .eq("round_number", room.round_number)
      .maybeSingle()
      .then(({ data }) => setCurrentHistory(data ?? null));

    const channel = supabase
      .channel(`history:${room.id}:${room.round_number}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "room_history",
          filter: `room_id=eq.${room.id}`,
        },
        (payload) => {
          const row = payload.new as RoomHistoryRow;
          if (row.round_number === room.round_number) setCurrentHistory(row);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [room.id, room.round_number]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    updatePresence({
      cursor: { cellKey: hoveredCell, boardOwnerId: viewingId },
    });
  }, [hoveredCell, viewingId]); // eslint-disable-line react-hooks/exhaustive-deps

  const dice = currentHistory
    ? {
        colors: currentHistory.dice_colors as [
          DiceColorFace,
          DiceColorFace,
          DiceColorFace,
        ],
        numbers: currentHistory.dice_numbers as [
          DiceNumberFace,
          DiceNumberFace,
          DiceNumberFace,
        ],
        special: currentHistory.dice_special,
      }
    : null;

  const cellCursors = useMemo(() => {
    const result: Record<string, { color: Color; displayName: string }[]> = {};
    for (const p of Object.values(presences)) {
      if (!p.cursor || p.cursor.boardOwnerId !== viewingId || !p.cursor.cellKey) continue;
      const key = p.cursor.cellKey;
      result[key] = [...(result[key] ?? []), { color: p.color, displayName: p.displayName }];
    }
    return result;
  }, [presences, viewingId]);

  const viewing = players.find((p) => p.id === viewingId) ?? players[0];
  const activePlayer = players.find(
    (p) => p.seat_index === room.current_player_index,
  );
  // In DEV_MULTI_SEAT all players share one user_id, so act as whichever player
  // is currently being viewed rather than only the active player.
  const effectiveMe = DEV_MULTI_SEAT
    ? (players.find((p) => p.id === viewingId) ?? me)
    : me;
  const isMyBoard = viewingId === effectiveMe.id;

  const validCells = useMemo<Set<string> | undefined>(() => {
    if (!isMyBoard || selectedColor === undefined || !dice) return undefined;

    const declaredColorFace = dice.colors[selectedColor];
    const declaredNumberFace = dice.numbers[selectedNumber ?? 0];
    const isWild = isColorWildcard(declaredColorFace);
    const occupiedCells = [...(effectiveMe.crossed_cells as string[]), ...selectedCells];
    const occupiedSet = new Set(occupiedCells);

    const result = new Set<string>();

    // If number is selected and it's not a wildcard, limit to that count
    const hasNumberLimit = selectedNumber !== undefined && !isNumberWildcard(declaredNumberFace);
    const required = hasNumberLimit ? parseInt(declaredNumberFace, 10) : Infinity;
    const canSelectMore = selectedCells.length < required;

    for (const [key, cell] of Object.entries(boardConfig.cells)) {
      if (occupiedSet.has(key)) continue;
      if (!isWild && cell.color !== (declaredColorFace as string)) continue;
      if (isValidPlacement(boardConfig, key, occupiedCells)) {
        if (canSelectMore) result.add(key);
      }
    }
    return result;
  }, [selectedColor, selectedNumber, selectedCells, effectiveMe.crossed_cells, dice, boardConfig, isMyBoard]); // eslint-disable-line react-hooks/exhaustive-deps

  const scoring = boardConfig.scoring;
  const { grid } = boardConfig;

  const myCompletedRows = grid.rows.filter((r) =>
    isRowComplete(boardConfig, r, viewing.crossed_cells),
  );
  const myCompletedCols = grid.columns.filter((c) =>
    isColumnComplete(boardConfig, c, viewing.crossed_cells),
  );
  const firstTakenRows = grid.rows.filter((r) =>
    players.some((p) => isRowComplete(boardConfig, r, p.crossed_cells)),
  );
  const firstTakenCols = grid.columns.filter((c) =>
    players.some((p) => isColumnComplete(boardConfig, c, p.crossed_cells)),
  );

  function handleCellClick(key: string) {
    if (!isMyBoard) return;
    setSelectedCells((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  }

  function handleColorPick(i: 0 | 1 | 2) {
    setSelectedColor((prev) => (prev === i ? undefined : i));
  }

  function handleNumberPick(i: 0 | 1 | 2) {
    setSelectedNumber((prev) => (prev === i ? undefined : i));
  }

  async function handleRoll() {
    setRolling(true);
    await fetch(`/api/rooms/${room.code}/roll`, { method: "POST" });
    setRolling(false);
  }

  function clearPick() {
    setSelectedColor(undefined);
    setSelectedNumber(undefined);
    setSelectedCells([]);
  }

  async function handleConfirmPick() {
    if (!canConfirm || !dice || selectedColor === undefined || selectedNumber === undefined) return;
    setConfirming(true);
    try {
      const colorFace = dice.colors[selectedColor];
      const numberFace = dice.numbers[selectedNumber];
      // Wildcard color: infer declared_color from first selected cell
      const declaredColor = colorFace === "✕"
        ? ((boardConfig.cells as any)[selectedCells[0]]?.color ?? colorFace)
        : colorFace;
      // Wildcard number: declared_number = cell count
      const declaredNumber = numberFace === "?" ? selectedCells.length : parseInt(numberFace, 10);

      const res = await fetch(`/api/rooms/${room.code}/pick`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "color_number",
          color_die: selectedColor,
          number_die: selectedNumber,
          declared_color: declaredColor,
          declared_number: declaredNumber,
          cells: selectedCells,
          ...(DEV_MULTI_SEAT && { _dev_player_id: effectiveMe.id }),
        }),
      });
      if (res.ok) {
        clearPick();
      } else {
        const body = await res.json().catch(() => ({}));
        console.error("[handleConfirmPick]", body.error ?? res.status);
      }
    } catch (err) {
      console.error("[handleConfirmPick] network error:", err);
    } finally {
      setConfirming(false);
    }
  }

  const canConfirm = useMemo(() => {
    if (!isMyBoard || selectedColor === undefined || selectedNumber === undefined) {
      return false;
    }
    if (!dice) return false;

    const declaredNumberFace = dice.numbers[selectedNumber];
    if (isNumberWildcard(declaredNumberFace)) {
      // For wildcard number, just need at least 1 cell
      return selectedCells.length > 0;
    }

    // For non-wildcard, need exactly the specified count
    const required = parseInt(declaredNumberFace, 10);
    return selectedCells.length === required;
  }, [isMyBoard, selectedColor, selectedNumber, selectedCells, dice]);

  const hintText = useMemo<string | null>(() => {
    if (!isMyBoard || !dice) return null;
    if (selectedColor === undefined) return "Pick a color die";
    if (selectedNumber === undefined) return "Pick a number die";

    const declaredColorFace = dice.colors[selectedColor];
    const declaredNumberFace = dice.numbers[selectedNumber];
    const colorName = isColorWildcard(declaredColorFace)
      ? "any"
      : (COLOR_NAMES[declaredColorFace] ?? declaredColorFace);

    if (isNumberWildcard(declaredNumberFace)) {
      return `Select ${colorName} squares, then confirm`;
    }

    const required = parseInt(declaredNumberFace, 10);
    const remaining = required - selectedCells.length;
    if (remaining === 0) return null;
    return `Pick ${remaining} more ${colorName} square${remaining === 1 ? "" : "s"}`;
  }, [isMyBoard, dice, selectedColor, selectedNumber, selectedCells]);

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-5 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-black text-kok-orange tracking-wide uppercase">
            Keer op Keer 2
          </span>
          <span className="text-gray-300">|</span>
          <span className="font-mono font-bold text-gray-600 tracking-widest text-sm">
            {room.code.toUpperCase()}
          </span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-gray-500">
            Round{" "}
            <span className="font-bold text-gray-800">{room.round_number}</span>
          </span>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-kok-green animate-pulse" />
            <span className="font-medium text-kok-green">
              {activePlayer?.display_name ?? "—"}'s turn
            </span>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Board area */}
        <main className="flex-1 p-5 overflow-auto">
          {/* Player tabs */}
          <div className="flex gap-1.5 mb-4">
            {players.map((p) => (
              <button
                key={p.id}
                onClick={() => setViewingId(p.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                  viewingId === p.id
                    ? "bg-kok-blue text-white shadow-sm"
                    : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-200"
                }`}
              >
                <Avatar
                  name={p.display_name}
                  variant="beam"
                  size={20}
                  colors={SEAT_COLORS[p.seat_index % SEAT_COLORS.length]}
                />
                {p.display_name}
                {p.id === me.id && " (you)"}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-3 w-fit">
            {/* Score sheet */}
            <div className="bg-white rounded-xl shadow-sm p-4">
              <ScoreSheet
                config={boardConfig}
                crossedCells={viewing.crossed_cells}
                selectedCells={isMyBoard ? selectedCells : []}
                onCellClick={isMyBoard ? handleCellClick : undefined}
                validCells={isMyBoard ? validCells : undefined}
                myCompletedRows={myCompletedRows}
                myCompletedCols={myCompletedCols}
                firstTakenRows={firstTakenRows}
                firstTakenCols={firstTakenCols}
                columnHeartBonuses={
                  (viewing.column_heart_bonuses as Record<
                    string,
                    number
                  > | null) ?? {}
                }
                onCellHover={setHoveredCell}
                cellCursors={cellCursors}
              />
            </div>

            {/* Resource tracks for viewed player */}
            <div className="bg-white rounded-xl shadow-sm px-4 py-3">
              <ResourceTracks
                hearts={viewing.hearts}
                heartSize={scoring.heartTrack.size}
                boxesUnlocked={viewing.boxes_unlocked}
                boxesSpent={viewing.boxes_spent}
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
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Players
            </div>
            <div className="flex flex-col gap-1">
              {players.map((p) => {
                const isActive = p.seat_index === room.current_player_index;
                return (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between px-2.5 py-2 rounded-lg text-sm ${
                      isActive
                        ? "bg-kok-green/10 border border-kok-green/25"
                        : "bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Avatar
                        name={p.display_name}
                        variant="beam"
                        size={24}
                        colors={SEAT_COLORS[p.seat_index % SEAT_COLORS.length]}
                      />
                      <span className="font-medium text-gray-800">
                        {p.display_name}
                        {p.id === me.id && (
                          <span className="text-gray-400 text-xs font-normal">
                            {" "}
                            (you)
                          </span>
                        )}
                      </span>
                    </div>
                    <span className="font-bold text-gray-700 tabular-nums">
                      {p.score ?? 0}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Dice roll */}
          <div className="p-4 border-b border-gray-100">
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Dice Roll
            </div>
            {dice ? (
              <GameDice
                colors={dice.colors}
                numbers={dice.numbers}
                special={dice.special}
                selectedColor={isMyBoard ? selectedColor : undefined}
                selectedNumber={isMyBoard ? selectedNumber : undefined}
                onSelectColor={isMyBoard ? handleColorPick : undefined}
                onSelectNumber={isMyBoard ? handleNumberPick : undefined}
              />
            ) : effectiveMe.seat_index === room.current_player_index ? (
              <button
                onClick={handleRoll}
                disabled={rolling}
                className="w-full py-3 rounded-xl bg-kok-orange text-white font-black text-lg uppercase tracking-wide shadow-sm hover:brightness-110 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 disabled:opacity-50 disabled:pointer-events-none transition-all flex items-center justify-center gap-2"
              >
                {rolling ? (
                  <svg
                    className="animate-spin"
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="2" y="2" width="20" height="20" rx="3" ry="3" />
                    <circle
                      cx="8"
                      cy="8"
                      r="1.5"
                      fill="currentColor"
                      stroke="none"
                    />
                    <circle
                      cx="16"
                      cy="8"
                      r="1.5"
                      fill="currentColor"
                      stroke="none"
                    />
                    <circle
                      cx="8"
                      cy="16"
                      r="1.5"
                      fill="currentColor"
                      stroke="none"
                    />
                    <circle
                      cx="16"
                      cy="16"
                      r="1.5"
                      fill="currentColor"
                      stroke="none"
                    />
                    <circle
                      cx="12"
                      cy="12"
                      r="1.5"
                      fill="currentColor"
                      stroke="none"
                    />
                  </svg>
                ) : (
                  "Roll Dice"
                )}
              </button>
            ) : (
              <p className="text-xs text-gray-400 italic">
                Waiting for {activePlayer?.display_name ?? "—"} to roll…
              </p>
            )}
          </div>

          {/* Pick status + actions */}
          {isMyBoard && (
            <div className="p-4 flex flex-col gap-2">
              <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                Your Pick
              </div>
              <div className="text-xs text-gray-500 space-y-0.5">
                <div>
                  Color:{" "}
                  {selectedColor !== undefined && dice ? (
                    <span className="font-semibold text-gray-700">
                      {dice.colors[selectedColor].toUpperCase()}
                    </span>
                  ) : (
                    <span className="italic">none</span>
                  )}
                </div>
                <div>
                  Number:{" "}
                  {selectedNumber !== undefined && dice ? (
                    <span className="font-semibold text-gray-700">
                      {dice.numbers[selectedNumber]}
                    </span>
                  ) : (
                    <span className="italic">none</span>
                  )}
                </div>
                <div>
                  Cells:{" "}
                  {selectedCells.length > 0 ? (
                    <span className="font-semibold text-gray-700">
                      {selectedCells.join(", ")}
                    </span>
                  ) : (
                    <span className="italic">none selected</span>
                  )}
                </div>
              </div>
              <button
                onClick={handleConfirmPick}
                disabled={!canConfirm || confirming}
                className="mt-1 w-full py-2 rounded-lg bg-kok-blue text-white font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 transition-all"
              >
                {confirming ? "Confirming…" : "Confirm Pick"}
              </button>
              {hintText && (
                <p className="text-xs text-gray-400 italic text-center leading-snug">
                  {hintText}
                </p>
              )}
              <button
                onClick={clearPick}
                className="w-full py-1.5 rounded-lg bg-gray-100 text-gray-600 font-medium text-sm hover:bg-gray-200 transition-all"
              >
                Clear
              </button>
            </div>
          )}
        </aside>

        {/* Chat column — always mounted to preserve messages and subscription */}
        <aside
          className={`w-72 shrink-0 bg-white border-l border-gray-200 flex flex-col overflow-hidden ${chatOpen ? "" : "hidden"}`}
        >
          <ChatWindow
            roomId={room.id}
            playerId={me.id}
            players={players}
            onClose={() => setChatOpen(false)}
          />
        </aside>
      </div>

      {/* Floating chat toggle */}
      {!chatOpen && (
        <button
          onClick={() => setChatOpen(true)}
          className={`fixed bottom-5 right-5 w-12 h-12 rounded-full bg-kok-blue text-white shadow-lg flex items-center justify-center hover:brightness-110 transition-all ${
            unreadCount > 0 ? "animate-bounce" : ""
          }`}
          aria-label="Open chat"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <path d="M2 4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6l-4 3V4z" />
          </svg>
          {unreadCount > 0 && (
            <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </div>
          )}
        </button>
      )}
    </div>
  );
}
