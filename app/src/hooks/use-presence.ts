import { useEffect, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { PlayerPresence } from "@/types/presence";

export function usePresence(roomId: string, myPresence: PlayerPresence) {
  const [presences, setPresences] = useState<Record<string, PlayerPresence>>({});
  const channelRef = useRef<any>(null);
  const currentStateRef = useRef<PlayerPresence>(myPresence);
  const pendingUpdateRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

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
  }, [roomId, myPresence.userId]);

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
    }, 150);
  };

  return { presences, updatePresence };
}
