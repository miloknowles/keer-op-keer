import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function RoomPage(props: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await props.params;
  const supabase = await createClient();

  const { data: room } = await supabase
    .from("rooms")
    .select("status")
    .eq("code", code)
    .maybeSingle();

  if (!room) notFound();

  if (room.status === "lobby") redirect(`/room/${code}/lobby`);
  redirect(`/room/${code}/game`);
}
