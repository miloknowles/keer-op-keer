import type { Color } from "@/boards/board.types";

export const SEAT_COLORS: [string, string][] = [
  ["#E8437C", "#ffffff"], // pink
  ["#4264D4", "#ffffff"], // blue
  ["#E8C43A", "#ffffff"], // yellow
  ["#2FAD50", "#ffffff"], // green
  ["#E87820", "#ffffff"], // orange
];

export const COLOR_NAMES: Record<string, string> = {
  p: "pink",
  o: "orange",
  y: "yellow",
  g: "green",
  b: "blue",
};

export const COLOR_BG: Record<Color, string> = {
  p: "bg-kok-pink",
  o: "bg-kok-orange",
  y: "bg-kok-yellow",
  g: "bg-kok-green",
  b: "bg-kok-blue",
};
