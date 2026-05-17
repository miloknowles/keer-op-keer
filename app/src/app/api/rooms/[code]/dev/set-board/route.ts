import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { code } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { player_id, crossed_cells, hearts, boxes_unlocked, boxes_spent, wildcards } = body as {
    player_id: string;
    crossed_cells: string[];
    hearts: number;
    boxes_unlocked: number;
    boxes_spent: number;
    wildcards: number;
  };

  if (!player_id || !Array.isArray(crossed_cells)) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const { data: room } = await supabase
    .from("rooms")
    .select("id")
    .eq("code", code.toLowerCase())
    .maybeSingle();
  if (!room)
    return NextResponse.json({ error: "Room not found" }, { status: 404 });

  const { count: callerCount } = await supabase
    .from("room_players")
    .select("id", { count: "exact", head: true })
    .eq("room_id", room.id)
    .eq("user_id", user.id);
  if (!callerCount || callerCount === 0)
    return NextResponse.json({ error: "Not in room" }, { status: 403 });

  const { count: targetCount } = await supabase
    .from("room_players")
    .select("id", { count: "exact", head: true })
    .eq("id", player_id)
    .eq("room_id", room.id);
  if (!targetCount || targetCount === 0)
    return NextResponse.json({ error: "Player not in room" }, { status: 400 });

  const { error } = await supabase
    .from("room_players")
    .update({ crossed_cells, hearts, boxes_unlocked, boxes_spent, wildcards })
    .eq("id", player_id)
    .eq("room_id", room.id);

  if (error) {
    console.error("[dev/set-board] update failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
