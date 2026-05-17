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
    .select("id, status, host_id")
    .eq("code", code.toLowerCase())
    .maybeSingle();
  if (!room)
    return NextResponse.json(
      { error: "Room not found. Make sure your code is valid." },
      { status: 404 },
    );
  if (room.status !== "lobby") {
    return NextResponse.json(
      { error: "Game already started" },
      { status: 409 },
    );
  }

  // Verify caller is the host
  const meQuery = supabase
    .from("room_players")
    .select("id")
    .eq("room_id", room.id)
    .eq("user_id", user.id)
    .limit(1);

  const { data: meList } = await meQuery;
  const me = meList?.[0] ?? null;
  if (!me) return NextResponse.json({ error: "Not in room" }, { status: 403 });
  if (me.id !== room.host_id) {
    return NextResponse.json(
      { error: "Only the host can start the game" },
      { status: 403 },
    );
  }

  // Need at least 2 players
  const { count } = await supabase
    .from("room_players")
    .select("id", { count: "exact", head: true })
    .eq("room_id", room.id);
  if ((count ?? 0) < 2) {
    return NextResponse.json(
      { error: "Need at least 2 players to start" },
      { status: 409 },
    );
  }

  const { error } = await supabase
    .from("rooms")
    .update({ status: "in_progress", started_at: new Date().toISOString() })
    .eq("id", room.id);
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
