"use client";

import Avatar from "boring-avatars";
import { SEAT_COLORS } from "@/lib/constants";

interface PlayerAvatarProps {
  name: string;
  seatIndex: number;
  size?: number;
}

export function PlayerAvatar({ name, seatIndex, size = 32 }: PlayerAvatarProps) {
  return (
    <Avatar
      name={name}
      variant="beam"
      size={size}
      colors={SEAT_COLORS[seatIndex % SEAT_COLORS.length]}
    />
  );
}
