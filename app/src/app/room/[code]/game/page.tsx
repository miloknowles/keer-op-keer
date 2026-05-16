"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Avatar from "boring-avatars";
import { isRowComplete, isColumnComplete, getConnectedRegion } from "@/lib/game/sheet";
import { isColorWildcard, isNumberWildcard } from "@/lib/game/dice";
import { getValidCells } from "@/lib/game/rules";
import { SEAT_COLORS, COLOR_NAMES } from "@/lib/constants";
import { ScoreSheet } from "@/components/game/ScoreSheet";
import { GameDice } from "@/components/game/GameDice";
import { ResourceTracks } from "@/components/game/ResourceTracks";
import { ChatWindow } from "@/components/game/ChatWindow";
import { useRoomContext } from "@/lib/context/room";
import { createClient } from "@/lib/supabase/client";
import { usePresence } from "@/hooks/use-presence";
import { useRoomChat } from "@/hooks/use-room-chat";
import { DEV_MULTI_SEAT } from "@/lib/devFlags";
import { toast } from "sonner";
import type {
  DiceColorFace,
  DiceNumberFace,
  BoardConfig,
  RoomHistoryRow,
  Color,
} from "@/types/game";
import type { PlayerPresence } from "@/types/presence";

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
  const [selectedSpecial, setSelectedSpecial] = useState(false);

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
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
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
  const isActivePlayer = effectiveMe.seat_index === room.current_player_index;
  const availableBoxes = effectiveMe.boxes_unlocked - effectiveMe.boxes_spent;
  const canUseSpecial = isActivePlayer && availableBoxes > 0 && !!dice;

  const openRound = room.round_number <= 2;
  const activePick = currentHistory?.active_pick ?? null;
  const allPicksSubmitted = !!currentHistory &&
    !!currentHistory.active_pick &&
    Object.keys((currentHistory.player_picks as Record<string, unknown>) ?? {}).length >= players.length - 1;
  const disabledColorDice: (0 | 1 | 2)[] = (() => {
    if (isActivePlayer || openRound) return [];
    if (!activePick) return [0, 1, 2];
    if (activePick.type === "color_number") return [activePick.color_die];
    return [];
  })();
  const disabledNumberDice: (0 | 1 | 2)[] = (() => {
    if (isActivePlayer || openRound) return [];
    if (!activePick) return [0, 1, 2];
    if (activePick.type === "color_number") return [activePick.number_die];
    return [];
  })();

  const validCells = useMemo<Set<string> | undefined>(() => {
    if (!isMyBoard || !dice) return undefined;
    return getValidCells(
      boardConfig,
      effectiveMe.crossed_cells as string[],
      dice,
      selectedSpecial,
      selectedColor,
      selectedNumber,
      selectedCells,
    );
  }, [isMyBoard, dice, boardConfig, effectiveMe.crossed_cells, selectedSpecial, selectedColor, selectedNumber, selectedCells]);

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

    if (selectedSpecial && dice) {
      if (dice.special === "heart") return;

      if (dice.special === "fill") {
        const cell = boardConfig.cells[key];
        if (!cell) return;
        if (selectedCells.includes(key)) { setSelectedCells([]); return; }
        const region = getConnectedRegion(boardConfig, cell.color, key, effectiveMe.crossed_cells as string[]);
        setSelectedCells(region);
        return;
      }

      if (dice.special === "three_in_a_row") {
        if (selectedCells.includes(key)) { setSelectedCells((p) => p.filter((k) => k !== key)); return; }
        if (selectedCells.length >= 3) return;
        if (selectedCells.length > 0 && key.split("-")[1] !== selectedCells[0].split("-")[1]) return;
        setSelectedCells((p) => [...p, key]);
        return;
      }

      if (dice.special === "bomb") {
        if (selectedCells.includes(key)) { setSelectedCells((p) => p.filter((k) => k !== key)); return; }
        if (selectedCells.length >= 4) return;
        const newSel = [...selectedCells, key];
        const idxs = newSel.map((k) => {
          const [col, row] = k.split("-");
          return [boardConfig.grid.columns.indexOf(col), boardConfig.grid.rows.indexOf(row)] as [number, number];
        });
        const cSpan = Math.max(...idxs.map(([c]) => c)) - Math.min(...idxs.map(([c]) => c));
        const rSpan = Math.max(...idxs.map(([, r]) => r)) - Math.min(...idxs.map(([, r]) => r));
        if (cSpan > 1 || rSpan > 1) return;
        setSelectedCells(newSel);
        return;
      }

      if (dice.special === "two_stars") {
        if (selectedCells.includes(key)) { setSelectedCells((p) => p.filter((k) => k !== key)); return; }
        if (selectedCells.length >= 2) return;
        setSelectedCells((p) => [...p, key]);
        return;
      }
    }

    setSelectedCells((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  }

  function handleColorPick(i: 0 | 1 | 2) {
    setSelectedSpecial(false);
    setSelectedColor((prev) => (prev === i ? undefined : i));
  }

  function handleNumberPick(i: 0 | 1 | 2) {
    setSelectedSpecial(false);
    setSelectedNumber((prev) => (prev === i ? undefined : i));
  }

  function handleSpecialSelect() {
    setSelectedSpecial((prev) => {
      if (!prev) {
        setSelectedColor(undefined);
        setSelectedNumber(undefined);
        setSelectedCells([]);
      }
      return !prev;
    });
  }

  async function handleRoll() {
    setRolling(true);
    await fetch(`/api/rooms/${room.code}/roll`, { method: "POST" });
    setRolling(false);
  }

  async function handleAdvanceRound() {
    const res = await fetch(`/api/rooms/${room.code}/advance`, { method: "POST" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error ?? "Failed to advance round");
    }
  }

  function clearPick() {
    setSelectedColor(undefined);
    setSelectedNumber(undefined);
    setSelectedCells([]);
    setSelectedSpecial(false);
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
        toast.error(body.error ?? "Failed to confirm pick");
        // Pick was already recorded — clear selection so the UI doesn't suggest
        // the player can submit again this round.
        if (res.status === 409) clearPick();
      }
    } catch (err) {
      console.error("[handleConfirmPick] network error:", err);
      toast.error("Network error — please try again");
    } finally {
      setConfirming(false);
    }
  }

  async function handleConfirmSpecialPick() {
    if (!canConfirmSpecial) return;
    setConfirming(true);
    try {
      const res = await fetch(`/api/rooms/${room.code}/pick`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "special",
          cells: selectedCells,
          ...(DEV_MULTI_SEAT && { _dev_player_id: effectiveMe.id }),
        }),
      });
      if (res.ok) {
        clearPick();
      } else {
        const body = await res.json().catch(() => ({}));
        toast.error(body.error ?? "Failed to confirm special pick");
      }
    } catch (err) {
      console.error("[handleConfirmSpecialPick] network error:", err);
      toast.error("Network error — please try again");
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
      return selectedCells.length > 0;
    }

    const required = parseInt(declaredNumberFace, 10);
    return selectedCells.length === required;
  }, [isMyBoard, selectedColor, selectedNumber, selectedCells, dice]);

  const canConfirmSpecial = useMemo(() => {
    if (!selectedSpecial || !dice) return false;
    switch (dice.special) {
      case "heart": return true;
      case "fill": return selectedCells.length > 0;
      case "three_in_a_row": return selectedCells.length === 3;
      case "bomb": return selectedCells.length === 4;
      case "two_stars": return selectedCells.length === 2;
      default: return false;
    }
  }, [selectedSpecial, dice, selectedCells]);

  const hintText = useMemo<string | null>(() => {
    if (!isMyBoard || !dice) return null;

    if (selectedSpecial) {
      switch (dice.special) {
        case "heart": return "Spend 1 box — gain 1 heart";
        case "fill":
          return selectedCells.length > 0
            ? "Region selected — click Confirm"
            : "Click a cell to fill its connected color region";
        case "three_in_a_row": {
          const rem = 3 - selectedCells.length;
          return rem > 0 ? `Pick ${rem} more adjacent cell${rem === 1 ? "" : "s"} in the same row` : null;
        }
        case "bomb": {
          const rem = 4 - selectedCells.length;
          return rem > 0 ? `Pick ${rem} more cell${rem === 1 ? "" : "s"} to complete the 2×2` : null;
        }
        case "two_stars": {
          const rem = 2 - selectedCells.length;
          return rem > 0 ? `Pick ${rem} more star cell${rem === 1 ? "" : "s"}` : null;
        }
      }
    }

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
  }, [isMyBoard, dice, selectedSpecial, selectedColor, selectedNumber, selectedCells]);

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
          {allPicksSubmitted ? (
            <button
              onClick={handleAdvanceRound}
              className="px-3 py-1 rounded-lg bg-kok-green text-white text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              Next round →
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-kok-green animate-pulse" />
              <span className="font-medium text-kok-green">
                {activePlayer?.display_name ?? "—"}'s turn
              </span>
            </div>
          )}
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
                const activePlayerHasPicked = !!currentHistory?.active_pick;
                const thisPlayerHasPicked = currentHistory
                  ? isActive
                    ? !!currentHistory.active_pick
                    : p.id in (currentHistory.player_picks ?? {})
                  : false;
                const pickStatus = currentHistory
                  ? thisPlayerHasPicked
                    ? "done"
                    : isActive || activePlayerHasPicked
                      ? "waiting"
                      : "blocked"
                  : null;
                return (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between px-2.5 py-2 rounded-lg text-sm ${
                      isActive
                        ? "bg-kok-green/10 border border-kok-green/25"
                        : "bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar
                        name={p.display_name}
                        variant="beam"
                        size={24}
                        colors={SEAT_COLORS[p.seat_index % SEAT_COLORS.length]}
                      />
                      <div className="min-w-0">
                        <span className="font-medium text-gray-800 truncate block">
                          {p.display_name}
                          {p.id === me.id && (
                            <span className="text-gray-400 text-xs font-normal">
                              {" "}
                              (you)
                            </span>
                          )}
                        </span>
                        {pickStatus && pickStatus !== "done" && (
                          <span className="text-[10px] text-gray-400 leading-none">
                            {pickStatus === "waiting" ? "Waiting for their pick" : "Can't pick yet"}
                          </span>
                        )}
                      </div>
                    </div>
                    {pickStatus === "done" ? (
                      <svg className="shrink-0 text-kok-green" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="2.5,8.5 6,12 13.5,4" />
                      </svg>
                    ) : (
                      <span className="font-bold text-gray-700 tabular-nums shrink-0">
                        {p.score ?? 0}
                      </span>
                    )}
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
                selectedSpecial={isMyBoard ? selectedSpecial : undefined}
                onSelectColor={isMyBoard ? handleColorPick : undefined}
                onSelectNumber={isMyBoard ? handleNumberPick : undefined}
                onSelectSpecial={isMyBoard && canUseSpecial ? handleSpecialSelect : undefined}
                disabledColors={isMyBoard ? disabledColorDice : undefined}
                disabledNumbers={isMyBoard ? disabledNumberDice : undefined}
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
                {selectedSpecial && dice ? (
                  <>
                    <div>
                      Special:{" "}
                      <span className="font-semibold text-amber-700">
                        {dice.special.replace(/_/g, " ")}
                      </span>
                    </div>
                    <div>
                      Cells:{" "}
                      {selectedCells.length > 0 ? (
                        <span className="font-semibold text-gray-700">
                          {selectedCells.join(", ")}
                        </span>
                      ) : dice.special === "heart" ? (
                        <span className="italic">none needed</span>
                      ) : (
                        <span className="italic">none selected</span>
                      )}
                    </div>
                  </>
                ) : (
                  <>
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
                  </>
                )}
              </div>
              <button
                onClick={selectedSpecial ? handleConfirmSpecialPick : handleConfirmPick}
                disabled={!(selectedSpecial ? canConfirmSpecial : canConfirm) || confirming}
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
