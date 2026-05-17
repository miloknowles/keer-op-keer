"use client";

import { useEffect, useRef, useState } from "react";
import { useRoomChat } from "@/hooks/use-room-chat";
import type { RoomChatRow, RoomPlayerRow } from "@/types/game";

interface Props {
  roomId: string;
  playerId: string;
  players: RoomPlayerRow[];
  onClose?: () => void;
  open?: boolean;
}

export function ChatWindow({ roomId, playerId, players, onClose, open }: Props) {
  const { messages, loading, sendMessage } = useRoomChat(roomId, playerId, true);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  function handleSend() {
    const trimmed = input.trim();
    if (!trimmed) return;
    sendMessage(trimmed);
    setInput("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") handleSend();
  }

  function resolveName(msg: RoomChatRow) {
    if (!msg.player_id) return null;
    return (
      players.find((p) => p.id === msg.player_id)?.display_name ?? "Unknown"
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-3 pb-2 shrink-0 flex items-center justify-between">
        <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
          Chat
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close chat"
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
        className="flex-1 overflow-y-auto px-3 pb-2 flex flex-col gap-2 min-h-0"
      >
        {loading && (
          <div className="flex items-center justify-center mt-4 gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-bounce [animation-delay:-0.3s]" />
            <div className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-bounce [animation-delay:-0.15s]" />
            <div className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-bounce" />
          </div>
        )}
        {!loading && messages.length === 0 && (
          <p className="text-xs text-gray-300 italic text-center mt-4">
            No messages yet
          </p>
        )}
        {messages.map((msg) => {
          const name = resolveName(msg);
          const time = new Date(msg.created_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          });
          if (!name) {
            return (
              <p
                key={msg.id}
                className="text-xs text-gray-400 italic text-center"
              >
                {msg.message}
              </p>
            );
          }
          const isMe = msg.player_id === playerId;
          return (
            <div
              key={msg.id}
              className={`flex flex-col gap-0.5 ${isMe ? "items-end" : "items-start"}`}
            >
              <div className="flex items-baseline gap-1.5">
                {!isMe && (
                  <span className="text-[10px] font-semibold text-gray-500">
                    {name}
                  </span>
                )}
                <span className="text-[10px] text-gray-300">{time}</span>
                {isMe && (
                  <span className="text-[10px] font-semibold text-gray-500">
                    you
                  </span>
                )}
              </div>
              <div
                className={`text-xs px-2.5 py-1.5 rounded-xl max-w-[90%] break-words ${
                  isMe
                    ? "bg-kok-blue text-white rounded-tr-sm"
                    : "bg-gray-100 text-gray-800 rounded-tl-sm"
                }`}
              >
                {msg.message}
              </div>
            </div>
          );
        })}
      </div>

      <div className="shrink-0 p-2 border-t border-gray-100 flex gap-1.5">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Say something…"
          className="flex-1 min-w-0 text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:ring-1 focus:ring-kok-blue/50 focus:border-kok-blue/50 placeholder:text-gray-300"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim()}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-kok-blue text-white disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 transition-all shrink-0"
        >
          Send
        </button>
      </div>
    </div>
  );
}
