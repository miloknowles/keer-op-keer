"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RoomChatRow } from "@/types/game";

export function useRoomChat(roomId: string, playerId: string) {
  const supabase = useRef(createClient()).current;
  const [messages, setMessages] = useState<RoomChatRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

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

    const channel = supabase.channel(`chat:${roomId}`);

    channel
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "room_chats",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const newMessage = payload.new as RoomChatRow;
          setMessages((prev) => [...prev, newMessage]);
          if (newMessage.player_id !== playerId) {
            setUnreadCount((prev) => prev + 1);
          }
        },
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [roomId, playerId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function sendMessage(text: string) {
    if (!text) return;
    await supabase
      .from("room_chats")
      .insert({ room_id: roomId, player_id: playerId, message: text });
  }

  const resetUnreadCount = useCallback(() => setUnreadCount(0), []);

  return { messages, loading, sendMessage, unreadCount, resetUnreadCount };
}
