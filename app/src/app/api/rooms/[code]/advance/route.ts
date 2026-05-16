import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const supabase = await createClient();

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

  // Must be a player in the room (use count to avoid maybeSingle() failing when
  // DEV_MULTI_SEAT is on and multiple rows share the same user_id)
  const { count: playerCount } = await supabase
    .from("room_players")
    .select("id", { count: "exact", head: true })
    .eq("room_id", room.id)
    .eq("user_id", user.id);
  if (!playerCount || playerCount === 0)
    return NextResponse.json({ error: "Not in room" }, { status: 403 });

  // Check all picks are in for this round
  const { data: history } = await supabase
    .from("room_history")
    .select("id, active_pick, player_picks")
    .eq("room_id", room.id)
    .eq("round_number", room.round_number)
    .maybeSingle();
  if (!history)
    return NextResponse.json(
      { error: "No dice rolled for this round yet" },
      { status: 409 },
    );

  const { count: totalPlayers } = await supabase
    .from("room_players")
    .select("id", { count: "exact", head: true })
    .eq("room_id", room.id);

  const nonActiveCount = (totalPlayers ?? 0) - 1;
  const submittedNonActive = Object.keys(
    (history.player_picks as Record<string, unknown>) ?? {},
  ).length;
  const activeSubmitted = history.active_pick !== null;
  const allPicksIn = activeSubmitted && submittedNonActive >= nonActiveCount;

  if (!allPicksIn)
    return NextResponse.json(
      { error: "Not all players have submitted picks yet" },
      { status: 409 },
    );

  // Conditional update: only advances if round_number hasn't changed since we read it
  // (guards against double-click / concurrent calls)
  const { error: roomErr } = await supabase
    .from("rooms")
    .update({
      round_number: room.round_number + 1,
      current_player_index:
        (room.current_player_index + 1) % (totalPlayers ?? 1),
    })
    .eq("id", room.id)
    .eq("round_number", room.round_number);

  if (roomErr) {
    console.error("[advance] update failed:", roomErr);
    return NextResponse.json({ error: roomErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
