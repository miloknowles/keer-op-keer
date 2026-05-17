import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { BOT_TYPES } from "@/lib/bots/index";

export async function POST(
  req: NextRequest,
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
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  if (room.status !== "lobby")
    return NextResponse.json({ error: "Game already started" }, { status: 409 });

  // Find the calling player to verify they are the host
  const { data: me } = await supabase
    .from("room_players")
    .select("id")
    .eq("room_id", room.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!me)
    return NextResponse.json({ error: "Not in room" }, { status: 403 });
  if (me.id !== room.host_id)
    return NextResponse.json({ error: "Only the host can add bots" }, { status: 403 });

  // Parse body
  const body = await req.json().catch(() => ({}));
  const bot_type: string = BOT_TYPES.includes(body.bot_type) ? body.bot_type : "greedy";
  const display_name = `Bot (${bot_type.charAt(0).toUpperCase()}${bot_type.slice(1)})`;

  // Count check
  const { count } = await supabase
    .from("room_players")
    .select("id", { count: "exact", head: true })
    .eq("room_id", room.id);
  if ((count ?? 0) >= 6)
    return NextResponse.json({ error: "Room is full" }, { status: 409 });

  // Find next available seat_index
  const { data: seats } = await supabase
    .from("room_players")
    .select("seat_index")
    .eq("room_id", room.id);
  const used = new Set((seats ?? []).map((p) => p.seat_index));
  let seat_index = 0;
  while (used.has(seat_index)) seat_index++;

  // Use service client to insert bot (user_id = null requires bypassing RLS)
  const service = createServiceClient();
  const { data: player, error: insertErr } = await service
    .from("room_players")
    .insert({ room_id: room.id, user_id: null, display_name, seat_index, is_bot: true, bot_type })
    .select("id")
    .single();
  if (insertErr || !player)
    return NextResponse.json({ error: insertErr?.message ?? "Failed to add bot" }, { status: 500 });

  return NextResponse.json({ player_id: player.id });
}
