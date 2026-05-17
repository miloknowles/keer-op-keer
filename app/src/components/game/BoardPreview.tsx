import { cn } from "@/lib/utils";
import { COLOR_BG } from "@/lib/constants";
import type { BoardConfig } from "@/boards/board.types";

interface Props {
  config: BoardConfig;
}

export function BoardPreview({ config }: Props) {
  return (
    <div className="flex flex-col gap-[2px]">
      {config.grid.rows.map(row => (
        <div key={row} className="flex gap-[2px]">
          {config.grid.columns.map(col => {
            const cell = config.cells[`${col}-${row}`];
            return (
              <div
                key={col}
                className={cn(
                  "w-[10px] h-[10px] rounded-[1px]",
                  cell ? COLOR_BG[cell.color] : "bg-gray-200",
                  cell?.special === "star" && "ring-1 ring-inset ring-white/70",
                  cell?.special === "box" && "ring-1 ring-inset ring-black/30",
                )}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
