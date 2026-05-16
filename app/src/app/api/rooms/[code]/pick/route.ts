import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DEV_MULTI_SEAT } from "@/lib/devFlags";
import {
  validateColorNumberPick,
  validateSpecialPick,
  canPass,
} from "@/lib/game/rules";
import { colorsCompleted } from "@/lib/game/sheet";
import { computePickResult } from "@/lib/game/effects";
import { computeScore } from "@/lib/game/scoring";
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
    const result = validateSpecialPick(config, pick, roll, playerRow, activePick, isActivePlayer, room.round_number);
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
    const { error: historyErr } = await supabase.rpc("merge_player_pick", {
      p_history_id: history.id,
      p_player_id: me.id,
      p_pick: pick,
    });
    if (historyErr) {
      console.error("[pick] merge_player_pick failed:", historyErr);
      return NextResponse.json(
        { error: historyErr.message },
        { status: 500 },
      );
    }
  }

  // ── 11. Load other players for row-completion bonus check ────────────────
  const { data: allPlayers } = await supabase
    .from("room_players")
    .select("id, crossed_cells")
    .eq("room_id", room.id);
  const otherPlayers = (allPlayers ?? []).filter((p) => p.id !== me.id);

  // ── 12. Compute updated player state (pure) ───────────────────────────────
  const result = computePickResult(config, playerRow, pick, roll, otherPlayers);

  // ── 13. Write updated player row ──────────────────────────────────────────
  const { error: playerErr } = await supabase
    .from("room_players")
    .update(result)
    .eq("id", me.id);
  if (playerErr) {
    console.error("[pick] update room_players failed:", playerErr);
    return NextResponse.json({ error: playerErr.message }, { status: 500 });
  }

  // ── 14. Check if all players have submitted this round ───────────────────
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
    // Load all players' full state — current player's update already committed in step 13
    const { data: allFull } = await supabase
      .from("room_players")
      .select("*")
      .eq("room_id", room.id);

    const allFullPlayers = (allFull ?? []) as RoomPlayerRow[];
    const threshold = config.scoring.gameEnd.colorsCompleted;
    const gameEnds = allFullPlayers.some(
      (p) => colorsCompleted(config, p.crossed_cells).length >= threshold,
    );

    if (gameEnds) {
      // ── 15. Compute and persist final scores ────────────────────────────
      for (const player of allFullPlayers) {
        const breakdown = computeScore(config, player, allFullPlayers);
        const { error: scoreErr } = await supabase
          .from("room_players")
          .update({ score: breakdown.total, score_breakdown: breakdown })
          .eq("id", player.id);
        if (scoreErr) {
          console.error("[pick] write score failed:", scoreErr);
        }
      }
      await supabase
        .from("rooms")
        .update({
          status: "finished",
          finished_at: new Date().toISOString(),
        })
        .eq("id", room.id);
    } else {
      // ── 15. Advance to next round ───────────────────────────────────────
      const { error: roomErr } = await supabase
        .from("rooms")
        .update({
          round_number: room.round_number + 1,
          current_player_index:
            (room.current_player_index + 1) % (totalPlayers ?? 1),
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
  }

  return NextResponse.json({ ok: true });
}
