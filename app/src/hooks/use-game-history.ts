import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RoomHistoryRow } from "@/types/game";

export function useGameHistory(roomId: string, roundNumber: number) {
  const supabase = useRef(createClient()).current;
  const [currentHistory, setCurrentHistory] = useState<RoomHistoryRow | null>(null);

  useEffect(() => {
    supabase
      .from("room_history")
      .select("*")
      .eq("room_id", roomId)
      .eq("round_number", roundNumber)
      .maybeSingle()
      .then(({ data }) => setCurrentHistory(data ?? null));

    const channel = supabase
      .channel(`history:${roomId}:${roundNumber}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "room_history",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const row = payload.new as RoomHistoryRow;
          if (row.round_number === roundNumber) setCurrentHistory(row);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "room_history",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const row = payload.new as RoomHistoryRow;
          if (row.round_number === roundNumber) setCurrentHistory(row);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, roundNumber]); // eslint-disable-line react-hooks/exhaustive-deps

  return currentHistory;
}
