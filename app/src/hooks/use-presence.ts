import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { PlayerPresence } from "@/types/presence";
import { PRESENCE_THROTTLE_MS } from "@/lib/constants";

export function usePresence(roomId: string, myPresence: PlayerPresence) {
  const [presences, setPresences] = useState<Record<string, PlayerPresence>>({});
  const supabaseRef = useRef(createClient());
  const channelRef = useRef<RealtimeChannel | null>(null);
  const currentStateRef = useRef<PlayerPresence>(myPresence);
  const pendingUpdateRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const supabase = supabaseRef.current;

    const channel = supabase.channel(`presence:${roomId}`, {
      config: { presence: { key: myPresence.userId } },
    });

    channelRef.current = channel;

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<PlayerPresence>();
        const flattened: Record<string, PlayerPresence> = {};
        for (const [userId, presenceList] of Object.entries(state)) {
          if (userId !== myPresence.userId && presenceList.length > 0) {
            flattened[userId] = presenceList[0];
          }
        }
        setPresences(flattened);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track(myPresence);
        }
      });

    return () => {
      if (pendingUpdateRef.current) {
        clearTimeout(pendingUpdateRef.current);
      }
      channel.unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, myPresence.userId]); // myPresence omitted: reconnecting on every cursor update would drop the channel

  const updatePresence = (update: Partial<PlayerPresence>) => {
    const merged = { ...currentStateRef.current, ...update };
    currentStateRef.current = merged;

    if (pendingUpdateRef.current) {
      clearTimeout(pendingUpdateRef.current);
    }

    pendingUpdateRef.current = setTimeout(() => {
      if (channelRef.current) {
        channelRef.current.track(merged);
      }
      pendingUpdateRef.current = null;
    }, PRESENCE_THROTTLE_MS);
  };

  return { presences, updatePresence };
}
