import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateBoard } from "@/lib/game/generate-board";
import standardBoard from "@/boards/kok2-standard.json";

export async function PATCH(
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

  const body = await req.json();
  const randomize: boolean = !!body.randomize;

  const { data: room } = await supabase
    .from("rooms")
    .select("id, status, host_id")
    .eq("code", code.toLowerCase())
    .maybeSingle();
  if (!room)
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  if (room.status !== "lobby")
    return NextResponse.json(
      { error: "Board can only be changed in lobby" },
      { status: 409 },
    );

  const { data: meList } = await supabase
    .from("room_players")
    .select("id")
    .eq("room_id", room.id)
    .eq("user_id", user.id)
    .limit(1);
  const me = meList?.[0] ?? null;
  if (!me) return NextResponse.json({ error: "Not in room" }, { status: 403 });
  if (me.id !== room.host_id)
    return NextResponse.json(
      { error: "Only the host can change the board" },
      { status: 403 },
    );

  const seed = Math.floor(Math.random() * 1_000_000);
  const config = randomize ? generateBoard(seed) : standardBoard;
  const templateId = randomize ? `kok2-generated-${seed}` : "kok2-standard";

  const { error } = await supabase
    .from("room_boards")
    .update({ config, template_id: templateId })
    .eq("room_id", room.id);
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
