import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleBotRound } from "@/lib/bots/runner";

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
    .select("id, status")
    .eq("code", code.toLowerCase())
    .maybeSingle();
  if (!room)
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  if (room.status !== "in_progress")
    return NextResponse.json({ error: "Game is not in progress" }, { status: 409 });

  const { count } = await supabase
    .from("room_players")
    .select("id", { count: "exact", head: true })
    .eq("room_id", room.id)
    .eq("user_id", user.id);
  if (!count || count === 0)
    return NextResponse.json({ error: "Not in room" }, { status: 403 });

  await handleBotRound(room.id);

  return NextResponse.json({ ok: true });
}
