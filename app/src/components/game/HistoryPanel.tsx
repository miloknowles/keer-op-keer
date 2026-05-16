"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  RoomHistoryRow,
  RoomPlayerRow,
  GamePick,
  ColorNumberPick,
} from "@/types/game";

const COLOR_DISPLAY: Record<string, string> = {
  p: "Pink",
  o: "Orange",
  y: "Yellow",
  g: "Green",
  b: "Blue",
};

const SPECIAL_DISPLAY: Record<string, string> = {
  heart: "Heart",
  fill: "Fill",
  three_in_a_row: "Three in a Row",
  bomb: "Bomb",
  two_stars: "Two Stars",
};

interface Props {
  roomId: string;
  players: RoomPlayerRow[];
  onClose?: () => void;
}

export function HistoryPanel({ roomId, players, onClose }: Props) {
  const supabase = useRef(createClient()).current;
  const [history, setHistory] = useState<RoomHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;

    supabase
      .from("room_history")
      .select("*")
      .eq("room_id", roomId)
      .order("round_number", { ascending: true })
      .then(({ data }) => {
        if (mounted && data) {
          setHistory(data as RoomHistoryRow[]);
          setLoading(false);
        }
      });

    const channel = supabase
      .channel(`history-panel:${roomId}:${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "room_history",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          if (!mounted) return;
          setHistory((prev) => {
            const incoming = payload.new as RoomHistoryRow;
            if (prev.some((r) => r.id === incoming.id)) {
              return prev.map((r) => (r.id === incoming.id ? incoming : r));
            }
            return [...prev, incoming].sort(
              (a, b) => a.round_number - b.round_number,
            );
          });
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [roomId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [history]);

  function describeAction(pick: GamePick, diceSpecial: string): string {
    if (pick.type === "color_number") {
      const p = pick as ColorNumberPick;
      const color = COLOR_DISPLAY[p.declared_color] ?? p.declared_color;
      return `picked ${p.declared_number} ${color}`;
    }
    if (pick.type === "special") {
      const special = SPECIAL_DISPLAY[diceSpecial] ?? diceSpecial;
      return `picked ${special}`;
    }
    return "passed";
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 pt-3 pb-2 shrink-0 flex items-center justify-between">
        <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
          History
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close history"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <line x1="1" y1="1" x2="13" y2="13" />
              <line x1="13" y1="1" x2="1" y2="13" />
            </svg>
          </button>
        )}
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-3 pb-3 flex flex-col gap-4 min-h-0"
      >
        {loading && (
          <div className="flex items-center justify-center mt-4 gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-bounce [animation-delay:-0.3s]" />
            <div className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-bounce [animation-delay:-0.15s]" />
            <div className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-bounce" />
          </div>
        )}
        {!loading && history.length === 0 && (
          <p className="text-xs text-gray-300 italic text-center mt-4">
            No rounds yet
          </p>
        )}
        {history.map((row) => {
          const activeFirst = [
            ...players.filter((p) => p.id === row.active_player_id),
            ...players
              .filter((p) => p.id !== row.active_player_id)
              .sort((a, b) => a.seat_index - b.seat_index),
          ];
          return (
          <div key={row.id} className="flex flex-col gap-1">
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
              Round {row.round_number + 1}
            </div>
            <div className="flex flex-col gap-0.5">
              {activeFirst.map((player) => {
                let pick: GamePick | null = null;
                if (player.id === row.active_player_id) {
                  pick = row.active_pick;
                } else {
                  pick = row.player_picks[player.id] ?? null;
                }
                if (!pick) return null;
                const action = describeAction(pick, row.dice_special);
                return (
                  <div key={player.id} className="text-xs text-gray-700">
                    <span className="font-semibold">{player.display_name}</span>{" "}
                    <span className="text-gray-500">{action}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
        })}
      </div>
    </div>
  );
}
