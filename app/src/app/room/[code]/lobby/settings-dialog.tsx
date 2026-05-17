"use client";

import { useState } from "react";
import { RefreshCw, Settings2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { BoardPreview } from "@/components/game/BoardPreview";
import { useRoomContext } from "@/lib/context/room";
import type { BoardConfig } from "@/boards/board.types";

interface Props {
  isHost: boolean;
}

export function SettingsDialog({ isHost }: Props) {
  const { room, board } = useRoomContext();
  const [updating, setUpdating] = useState(false);

  const isRandomized = board.template_id !== "kok2-standard";
  const boardConfig = board.config as unknown as BoardConfig;

  async function handleToggle(randomize: boolean) {
    if (!isHost || updating) return;
    setUpdating(true);
    await fetch(`/api/rooms/${room.code}/board`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ randomize }),
    });
    setUpdating(false);
    // Board updates for all clients via realtime subscription in RoomContext
  }

  return (
    <Dialog>
      <DialogTrigger
        className="text-gray-400 hover:text-gray-700 hover:bg-white/60 rounded-lg p-2 transition-colors"
        title="Game settings"
      >
        <Settings2 size={18} />
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Game Settings</DialogTitle>
          <DialogDescription>
            {isHost
              ? "Configure options for this game."
              : "Current game settings (host controls these)."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-1">
          {/* Toggle row */}
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label htmlFor="randomize-toggle" className="text-sm font-medium">
                Random board
              </Label>
              <p className="text-xs text-muted-foreground">
                Generate a unique color layout for this game instead of using
                the standard board.
              </p>
            </div>
            <Switch
              id="randomize-toggle"
              checked={isRandomized}
              onCheckedChange={handleToggle}
              disabled={!isHost || updating}
            />
          </div>

          {/* Board preview */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Board preview
              </p>
              {isHost && isRandomized && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs gap-1.5"
                  onClick={() => handleToggle(true)}
                  disabled={updating}
                >
                  <RefreshCw size={12} className={updating ? "animate-spin" : ""} />
                  Regenerate
                </Button>
              )}
            </div>
            <div className="bg-gray-100 rounded-lg p-4 flex justify-center">
              <BoardPreview config={boardConfig} />
            </div>
          </div>
        </div>

        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}
