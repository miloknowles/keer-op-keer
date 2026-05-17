"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { RoomRow, RoomPlayerRow, RoomBoardRow } from "@/types/game";

interface RoomContextValue {
  room: RoomRow;
  players: RoomPlayerRow[];
  board: RoomBoardRow;
  me: RoomPlayerRow;
  isHost: boolean;
  isLoading: false;
}

const RoomContext = createContext<RoomContextValue | null>(null);

export function useRoomContext(): RoomContextValue {
  const ctx = useContext(RoomContext);
  if (!ctx) throw new Error("useRoomContext must be used inside RoomProvider");
  return ctx;
}

export function RoomProvider({
  code,
  children,
}: {
  code: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [room, setRoom] = useState<RoomRow | null>(null);
  const [players, setPlayers] = useState<RoomPlayerRow[]>([]);
  const [board, setBoard] = useState<RoomBoardRow | null>(null);
  const [me, setMe] = useState<RoomPlayerRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Stable ref so subscription effect doesn't re-create the client on every render
  const supabase = useRef(createClient()).current;

  // Initial data fetch
  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { data: roomData, error: roomErr } = await supabase
        .from("rooms")
        .select("*")
        .eq("code", code)
        .maybeSingle();
      if (roomErr || !roomData) {
        router.replace("/");
        return;
      }

      const [{ data: playersData }, { data: boardData }] = await Promise.all([
        supabase
          .from("room_players")
          .select("*")
          .eq("room_id", roomData.id)
          .order("seat_index", { ascending: true }),
        supabase
          .from("room_boards")
          .select("*")
          .eq("room_id", roomData.id)
          .maybeSingle(),
      ]);

      const meRow =
        (playersData ?? []).find((p) => p.user_id === user?.id) ?? null;
      if (!meRow) {
        router.replace("/");
        return;
      }

      setRoom(roomData);
      setPlayers(playersData ?? []);
      if (boardData) setBoard(boardData);
      setMe(meRow);
      setIsLoading(false);
    }

    load().catch(() => {
      setLoadError("Failed to load room");
      setIsLoading(false);
    });
  }, [code]); // eslint-disable-line react-hooks/exhaustive-deps

  // Realtime subscriptions — only set up once room.id is known
  useEffect(() => {
    if (!room) return;

    const channel = supabase.channel(`room:${room.id}`);

    channel
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "rooms",
          filter: `id=eq.${room.id}`,
        },
        (payload) => {
          const updated = payload.new as RoomRow;
          setRoom(updated);
          if (updated.status === "in_progress") {
            router.replace(`/room/${code}/game`);
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "room_players",
          filter: `room_id=eq.${room.id}`,
        },
        (payload) => {
          const newPlayer = payload.new as RoomPlayerRow;
          setPlayers((prev) => {
            if (prev.find((p) => p.id === newPlayer.id)) return prev;
            return [...prev, newPlayer].sort(
              (a, b) => a.seat_index - b.seat_index,
            );
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "room_players",
          filter: `room_id=eq.${room.id}`,
        },
        (payload) => {
          const updated = payload.new as RoomPlayerRow;
          setPlayers((prev) =>
            prev.map((p) => (p.id === updated.id ? updated : p)),
          );
          setMe((prev) => (prev?.id === updated.id ? updated : prev));
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "room_players",
          filter: `room_id=eq.${room.id}`,
        },
        (payload) => {
          const deleted = payload.old as RoomPlayerRow;
          if (deleted.id === me?.id) {
            // Current user was kicked
            router.replace("/");
          } else {
            setPlayers((prev) => prev.filter((p) => p.id !== deleted.id));
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [room?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-screen bg-gray-200">
        <p className="text-gray-400 font-medium text-sm">Loading…</p>
      </div>
    );
  }

  if (loadError || !room || !board || !me) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-screen bg-gray-200">
        <p className="text-gray-500 font-medium">
          {loadError ?? "Room not found. Make sure your code is valid."}
        </p>
      </div>
    );
  }

  return (
    <RoomContext.Provider
      value={{
        room,
        players,
        board,
        me,
        isHost: me.id === room.host_id,
        isLoading: false,
      }}
    >
      {children}
    </RoomContext.Provider>
  );
}
