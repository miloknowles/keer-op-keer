import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DEV_MULTI_SEAT } from "@/lib/devFlags";
import {
  validateColorNumberPick,
  validateSpecialPick,
  canPass,
} from "@/lib/game/rules";
import {
  isRowComplete,
  isColumnComplete,
  colorsCompleted,
  getCell,
} from "@/lib/game/sheet";
import { isColorWildcard, isNumberWildcard } from "@/lib/game/dice";
import type {
  GamePick,
  DiceRoll,
  DiceColorFace,
  DiceNumberFace,
  RoomPlayerRow,
} from "@/types/game";
import type { BoardConfig } from "@/boards/board.types";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const supabase = await createClient();

  // ── 1–2. Auth + room lookup ───────────────────────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: room } = await supabase
    .from("rooms")
    .select("id, status, current_player_index, round_number")
    .eq("code", code.toLowerCase())
    .maybeSingle();
  if (!room)
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  if (room.status !== "in_progress")
    return NextResponse.json(
      { error: "Game is not in progress" },
      { status: 409 },
    );

  // ── 3. Player lookup ──────────────────────────────────────────────────────
  // Parse body early so DEV_MULTI_SEAT can use _dev_player_id to disambiguate
  // when all players share one user_id.
  let rawBody: Record<string, unknown>;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  let meQuery = supabase
    .from("room_players")
    .select(
      "id, seat_index, crossed_cells, hearts, boxes_unlocked, boxes_spent, wildcards, column_heart_bonuses",
    )
    .eq("room_id", room.id);

  if (DEV_MULTI_SEAT && typeof rawBody._dev_player_id === "string") {
    meQuery = meQuery.eq("id", rawBody._dev_player_id);
  } else {
    meQuery = meQuery.eq("user_id", user.id);
  }

  const { data: me } = await meQuery.maybeSingle();
  if (!me)
    return NextResponse.json({ error: "Not in room" }, { status: 403 });

  const isActivePlayer = me.seat_index === room.current_player_index;

  // ── 4. Load current round history ─────────────────────────────────────────
  const { data: history } = await supabase
    .from("room_history")
    .select(
      "id, dice_colors, dice_numbers, dice_special, active_pick, player_picks",
    )
    .eq("room_id", room.id)
    .eq("round_number", room.round_number)
    .maybeSingle();
  if (!history)
    return NextResponse.json(
      { error: "No dice rolled for this round yet" },
      { status: 409 },
    );

  // ── 5. Guard against duplicate submissions ────────────────────────────────
  if (isActivePlayer && history.active_pick !== null)
    return NextResponse.json(
      { error: "Already submitted pick for this round" },
      { status: 409 },
    );
  if (!isActivePlayer && me.id in (history.player_picks ?? {}))
    return NextResponse.json(
      { error: "Already submitted pick for this round" },
      { status: 409 },
    );

  // ── 6. Load board config ──────────────────────────────────────────────────
  const { data: boardRow } = await supabase
    .from("room_boards")
    .select("config")
    .eq("room_id", room.id)
    .maybeSingle();
  if (!boardRow)
    return NextResponse.json({ error: "Board not found" }, { status: 500 });
  const config = boardRow.config as unknown as BoardConfig;

  // ── 7. Parse pick from already-read body ──────────────────────────────────
  const pick = rawBody as unknown as GamePick;
  if (!pick?.type)
    return NextResponse.json({ error: "Missing pick type" }, { status: 400 });

  // ── 8. Reconstruct DiceRoll from history ──────────────────────────────────
  const roll: DiceRoll = {
    colors: history.dice_colors as [
      DiceColorFace,
      DiceColorFace,
      DiceColorFace,
    ],
    numbers: history.dice_numbers as [
      DiceNumberFace,
      DiceNumberFace,
      DiceNumberFace,
    ],
    special: history.dice_special,
  };

  const playerRow = me as unknown as RoomPlayerRow;
  const activePick = history.active_pick as GamePick | null;

  // ── 9. Server-side validation ─────────────────────────────────────────────
  if (pick.type === "color_number") {
    const result = validateColorNumberPick(
      config,
      pick,
      roll,
      playerRow,
      activePick,
      isActivePlayer,
      room.round_number,
    );
    if (!result.valid)
      return NextResponse.json({ error: result.error }, { status: 400 });
  } else if (pick.type === "special") {
    if (!isActivePlayer)
      return NextResponse.json(
        { error: "Only the active player can use the special die" },
        { status: 403 },
      );
    const result = validateSpecialPick(config, pick, roll, playerRow);
    if (!result.valid)
      return NextResponse.json({ error: result.error }, { status: 400 });
  } else if (pick.type === "pass") {
    const canPassNow = canPass(
      config,
      roll,
      playerRow,
      activePick,
      isActivePlayer,
      room.round_number,
    );
    if (!canPassNow)
      return NextResponse.json(
        { error: "Cannot pass — a legal move exists" },
        { status: 400 },
      );
  } else {
    return NextResponse.json({ error: "Unknown pick type" }, { status: 400 });
  }

  // ── 10. Write pick to room_history ────────────────────────────────────────
  if (isActivePlayer) {
    const { error: historyErr } = await supabase
      .from("room_history")
      .update({ active_pick: pick })
      .eq("id", history.id);
    if (historyErr) {
      console.error("[pick] update active_pick failed:", historyErr);
      return NextResponse.json(
        { error: historyErr.message },
        { status: 500 },
      );
    }
  } else {
    const mergedPicks = {
      ...(history.player_picks ?? {}),
      [me.id]: pick,
    };
    const { error: historyErr } = await supabase
      .from("room_history")
      .update({ player_picks: mergedPicks })
      .eq("id", history.id);
    if (historyErr) {
      console.error("[pick] update player_picks failed:", historyErr);
      return NextResponse.json(
        { error: historyErr.message },
        { status: 500 },
      );
    }
  }

  // ── 11. Compute updated player state ──────────────────────────────────────
  const pickedCells =
    pick.type === "pass" ? [] : (pick.cells ?? []);
  const bombCells =
    pick.type !== "pass" && pick.bomb_cells ? pick.bomb_cells : [];
  const newCrossedCells = [...me.crossed_cells, ...pickedCells, ...bombCells];
  const prevCrossedSet = new Set(me.crossed_cells);

  // Wildcard deduction
  let newWildcards = me.wildcards;
  if (pick.type === "color_number") {
    if (isColorWildcard(roll.colors[pick.color_die])) newWildcards -= 1;
    if (isNumberWildcard(roll.numbers[pick.number_die])) newWildcards -= 1;
  }

  // Box cells gained
  const boxCellsEarned = newCrossedCells.filter(
    (key) =>
      !prevCrossedSet.has(key) && getCell(config, key)?.special === "box",
  ).length;
  let newBoxesUnlocked = me.boxes_unlocked + boxCellsEarned;

  // Special pick effects
  let newBoxesSpent = me.boxes_spent;
  let newHearts = me.hearts;
  if (pick.type === "special") {
    newBoxesSpent += 1;
    if (roll.special === "heart") {
      newHearts = Math.min(
        me.hearts + 1,
        config.scoring.heartTrack.size,
      );
    }
  }

  // ── 12. Row completion bonuses ────────────────────────────────────────────
  const { data: allPlayers } = await supabase
    .from("room_players")
    .select("id, crossed_cells")
    .eq("room_id", room.id);

  const otherPlayers = (allPlayers ?? []).filter((p) => p.id !== me.id);

  for (const row of config.grid.rows) {
    if (isRowComplete(config, row, me.crossed_cells)) continue;
    if (!isRowComplete(config, row, newCrossedCells)) continue;
    const alreadyCompletedByOther = otherPlayers.some((p) =>
      isRowComplete(config, row, p.crossed_cells as string[]),
    );
    if (alreadyCompletedByOther) continue;

    const item = (config.scoring.rowItems as Record<string, string>)[row];
    if (item === "heart") {
      newHearts = Math.min(
        newHearts + 1,
        config.scoring.heartTrack.size,
      );
    } else if (item === "box") {
      newBoxesUnlocked = Math.min(
        newBoxesUnlocked + 1,
        config.scoring.boxTrack.size,
      );
    }
  }

  // ── 13. Column completion → record heart bonus ─────────────────────────────
  const currentHeartBonuses = (me.column_heart_bonuses ?? {}) as Record<
    string,
    number
  >;
  const newHeartBonuses = { ...currentHeartBonuses };

  for (const col of config.grid.columns) {
    if (col in newHeartBonuses) continue;
    if (isColumnComplete(config, col, me.crossed_cells)) continue;
    if (!isColumnComplete(config, col, newCrossedCells)) continue;
    newHeartBonuses[col] = newHearts;
    if (col === "H") {
      newBoxesUnlocked = Math.min(
        newBoxesUnlocked + 1,
        config.scoring.boxTrack.size,
      );
    }
  }

  // ── 14. Write updated player row ──────────────────────────────────────────
  const { error: playerErr } = await supabase
    .from("room_players")
    .update({
      crossed_cells: newCrossedCells,
      wildcards: newWildcards,
      boxes_unlocked: newBoxesUnlocked,
      boxes_spent: newBoxesSpent,
      hearts: newHearts,
      column_heart_bonuses: newHeartBonuses,
    })
    .eq("id", me.id);
  if (playerErr) {
    console.error("[pick] update room_players failed:", playerErr);
    return NextResponse.json({ error: playerErr.message }, { status: 500 });
  }

  // ── 15. Check if all players have submitted this round ────────────────────
  const { data: freshHistory } = await supabase
    .from("room_history")
    .select("active_pick, player_picks")
    .eq("id", history.id)
    .maybeSingle();

  const { count: totalPlayers } = await supabase
    .from("room_players")
    .select("id", { count: "exact", head: true })
    .eq("room_id", room.id);

  const nonActiveCount = (totalPlayers ?? 0) - 1;
  const submittedNonActive = Object.keys(
    (freshHistory?.player_picks as Record<string, unknown>) ?? {},
  ).length;
  const activeSubmitted = freshHistory?.active_pick !== null;

  const roundComplete = activeSubmitted && submittedNonActive >= nonActiveCount;

  if (roundComplete) {
    const { error: roomErr } = await supabase
      .from("rooms")
      .update({
        round_number: room.round_number + 1,
        current_player_index:
          ((room.current_player_index + 1) % (totalPlayers ?? 1)),
      })
      .eq("id", room.id);
    if (roomErr) {
      console.error("[pick] advance round failed:", roomErr);
      return NextResponse.json(
        { error: roomErr.message },
        { status: 500 },
      );
    }
  }

  // ── 16. Check game end condition ──────────────────────────────────────────
  const myCompletedColors = colorsCompleted(config, newCrossedCells).length;
  if (myCompletedColors >= config.scoring.gameEnd.colorsCompleted) {
    await supabase
      .from("rooms")
      .update({
        status: "finished",
        finished_at: new Date().toISOString(),
      })
      .eq("id", room.id);
  }

  return NextResponse.json({ ok: true });
}
