import { cn } from "@/lib/utils";

interface ResourceTracksProps {
  hearts: number;
  heartSize: number;
  boxesUnlocked: number;
  boxesSpent: number;
  wildcards: number;
  wildcardStart: number;
}

export function ResourceTracks({
  hearts,
  heartSize,
  boxesUnlocked,
  boxesSpent,
  wildcards,
  wildcardStart,
}: ResourceTracksProps) {
  return (
    <div className="flex gap-3">
      {/* Hearts column */}
      <div className="flex flex-col items-center">
        <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
          Hearts
        </div>
        <div className="flex flex-col gap-1">
          {Array.from({ length: heartSize }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-base",
                i < hearts
                  ? "bg-red-500 text-white"
                  : "bg-gray-100 border border-gray-200 opacity-30",
              )}
            >
              ❤️
            </div>
          ))}
        </div>
      </div>

      {/* Wildcards column */}
      <div className="flex flex-col items-center">
        <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
          ? / ✕
        </div>
        <div className="flex flex-col gap-1">
          {Array.from({ length: wildcardStart }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "w-7 h-7 rounded flex items-center justify-center text-xs font-bold",
                i < wildcards
                  ? "bg-gray-800 text-white"
                  : "bg-gray-100 border border-gray-300 text-gray-300",
              )}
            >
              ✕
            </div>
          ))}
        </div>
      </div>

      {/* Boxes column */}
      <div className="flex flex-col items-center">
        <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
          Boxes
        </div>
        <div className="flex flex-col gap-1">
          {Array.from({ length: boxesUnlocked }).map((_, i) => {
            const spent = i < boxesSpent;
            return (
              <div
                key={i}
                className={cn(
                  "w-8 h-8 rounded flex items-center justify-center text-sm font-bold",
                  spent ? "bg-amber-700/40 text-amber-900" : "bg-amber-700 text-white",
                )}
              >
                {spent ? "✕" : "📦"}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
