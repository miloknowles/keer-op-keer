"use client";

import { cn } from "@/lib/utils";
import type {
  DiceColorFace,
  DiceNumberFace,
  DiceSpecialFace,
} from "@/types/game";

// 3×3 pip grid: [TL, TC, TR, ML, MC, MR, BL, BC, BR]
const T = true,
  F = false;
const PIPS: Record<string, boolean[]> = {
  "1": [F, F, F, F, T, F, F, F, F],
  "2": [F, F, T, F, F, F, T, F, F],
  "3": [F, F, T, F, T, F, T, F, F],
  "4": [T, F, T, F, F, F, T, F, T],
  "5": [T, F, T, F, T, F, T, F, T],
};

const SPECIAL_LABEL: Record<DiceSpecialFace, string> = {
  heart: "❤️",
  fill: "≋",
  three_in_a_row: "|||",
  bomb: "💣",
  two_stars: "★★",
};

const SPECIAL_DESCRIPTION: Record<DiceSpecialFace, string> = {
  heart: "Heart (+1 heart track)",
  fill: "Fill (connected section)",
  three_in_a_row: "3-in-a-row",
  bomb: "Bomb (any 2×2)",
  two_stars: "Two stars (any 2 ★)",
};

const COLOR_FACE_TEXT: Record<DiceColorFace, string> = {
  p: "text-kok-pink",
  o: "text-kok-orange",
  y: "text-kok-yellow",
  g: "text-kok-green",
  b: "text-kok-blue",
  "✕": "text-gray-800",
};

function Die({
  className,
  selected,
  onClick,
  title,
  children,
}: {
  className?: string;
  selected?: boolean;
  onClick?: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      title={title}
      className={cn(
        "w-12 h-12 rounded-2xl relative flex items-center justify-center shrink-0 transition-all",
        "shadow-[0_4px_0_0_rgba(0,0,0,0.18)]",
        selected &&
          "shadow-[0_1px_0_0_rgba(0,0,0,0.12)] translate-y-[3px] ring-2 ring-black/50 ring-offset-1",
        !selected &&
          onClick &&
          "hover:shadow-[0_5px_0_0_rgba(0,0,0,0.22)] hover:-translate-y-px cursor-pointer",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

function NumberFace({ value }: { value: string }) {
  const pips = PIPS[value];
  if (!pips) {
    return <span className="font-black text-xl text-gray-400">?</span>;
  }
  return (
    <div className="grid grid-cols-3 grid-rows-3 gap-0.5 p-2 w-full h-full">
      {pips.map((active, i) => (
        <div key={i} className="flex items-center justify-center">
          {active && <div className="w-2.5 h-2.5 flex-shrink-0 aspect-square rounded-full bg-gray-800" />}
        </div>
      ))}
    </div>
  );
}

interface GameDiceProps {
  colors: [DiceColorFace, DiceColorFace, DiceColorFace];
  numbers: [DiceNumberFace, DiceNumberFace, DiceNumberFace];
  special: DiceSpecialFace;
  selectedColor?: 0 | 1 | 2;
  selectedNumber?: 0 | 1 | 2;
  selectedSpecial?: boolean;
  onSelectColor?: (i: 0 | 1 | 2) => void;
  onSelectNumber?: (i: 0 | 1 | 2) => void;
  onSelectSpecial?: () => void;
  disabledColors?: (0 | 1 | 2)[];
  disabledNumbers?: (0 | 1 | 2)[];
  disabledTooltip?: string;
  noWildcardsLeft?: boolean;
}

export function GameDice({
  colors,
  numbers,
  special,
  selectedColor,
  selectedNumber,
  selectedSpecial,
  onSelectColor,
  onSelectNumber,
  onSelectSpecial,
  disabledColors,
  disabledNumbers,
  disabledTooltip,
  noWildcardsLeft,
}: GameDiceProps) {
  return (
    <div className="flex flex-col gap-3">
      {/* Color dice */}
      <div>
        <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
          Color
        </div>
        <div className="flex gap-2">
          {colors.map((face, i) => {
            const isDisabled = disabledColors?.includes(i as 0 | 1 | 2);
            const isWildcardFace = face === "✕";
            const title = isDisabled
              ? (isWildcardFace && noWildcardsLeft ? "No wildcards remaining" : disabledTooltip)
              : (isWildcardFace ? "Wildcard — select any color" : undefined);
            return (
              <Die
                key={i}
                selected={selectedColor === i}
                onClick={
                  onSelectColor && !isDisabled
                    ? () => onSelectColor(i as 0 | 1 | 2)
                    : undefined
                }
                title={title}
                className={cn(
                  "bg-white border border-gray-200",
                  COLOR_FACE_TEXT[face],
                  "font-black text-xl",
                  isDisabled && "opacity-40",
                )}
              >
                ✕
              </Die>
            );
          })}
        </div>
      </div>

      {/* Number dice */}
      <div>
        <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
          Number
        </div>
        <div className="flex gap-2">
          {numbers.map((face, i) => {
            const isDisabled = disabledNumbers?.includes(i as 0 | 1 | 2);
            const isWildcardFace = face === "?";
            const title = isDisabled
              ? (isWildcardFace && noWildcardsLeft ? "No wildcards remaining" : disabledTooltip)
              : (isWildcardFace ? "Wildcard — select any number of cells" : undefined);
            return (
              <Die
                key={i}
                selected={selectedNumber === i}
                onClick={
                  onSelectNumber && !isDisabled
                    ? () => onSelectNumber(i as 0 | 1 | 2)
                    : undefined
                }
                title={title}
                className={cn(
                  "bg-white border border-gray-200",
                  isDisabled && "opacity-40",
                )}
              >
                <NumberFace value={face} />
              </Die>
            );
          })}
        </div>
      </div>

      {/* Special die */}
      <div>
        <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
          Special Die
        </div>
        <div className="flex items-center gap-2.5">
          <Die
            className="bg-amber-100 text-amber-800 text-xl"
            selected={selectedSpecial}
            onClick={onSelectSpecial}
          >
            {SPECIAL_LABEL[special]}
          </Die>
          <span className="text-xs text-gray-500 leading-snug">
            {SPECIAL_DESCRIPTION[special]}
          </span>
        </div>
      </div>
    </div>
  );
}
