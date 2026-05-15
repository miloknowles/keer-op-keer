"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RoomChatRow } from "@/types/game";

export function useRoomChat(roomId: string, playerId: string) {
  const supabase = useRef(createClient()).current;
  const [messages, setMessages] = useState<RoomChatRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("room_chats")
      .select("*")
      .eq("room_id", roomId)
      .order("created_at", { ascending: true })
      .limit(50)
      .then(({ data }) => {
        if (data) setMessages(data);
        setLoading(false);
      });

    const channel = supabase
      .channel(`chat:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "room_chats",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as RoomChatRow]);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function sendMessage(text: string) {
    if (!text) return;
    await supabase
      .from("room_chats")
      .insert({ room_id: roomId, player_id: playerId, message: text });
  }

  return { messages, loading, sendMessage };
}
