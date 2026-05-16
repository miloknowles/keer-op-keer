"use client";

import { Settings2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Props {
  isHost: boolean;
}

export function SettingsDialog({ isHost }: Props) {
  return (
    <Dialog>
      <DialogTrigger
        className="text-gray-400 hover:text-gray-700 hover:bg-white/60 rounded-lg p-2 transition-colors"
        title="Game settings"
      >
        <Settings2 size={18} />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Game Settings</DialogTitle>
          <DialogDescription>
            {isHost
              ? "Configure options for this game."
              : "Current game settings (host controls these)."}
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground text-center py-4">
          No settings yet — more options coming soon.
        </p>
        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}
