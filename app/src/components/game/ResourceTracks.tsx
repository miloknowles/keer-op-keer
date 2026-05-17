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
    <div className="flex gap-6">
      {/* Hearts */}
      <div>
        <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
          Hearts
        </div>
        <div className="flex gap-1">
          {Array.from({ length: heartSize }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-base",
                i < hearts
                  ? "bg-red-500 text-white"
                  : "bg-gray-100 border border-gray-300 text-gray-300",
              )}
            >
              ❤️
            </div>
          ))}
        </div>
      </div>

      {/* Box track */}
      <div>
        <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
          Boxes{" "}
          <span className="text-gray-500 normal-case font-normal">
            ({boxesUnlocked - boxesSpent} avail)
          </span>
        </div>
        <div className="flex gap-1">
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

      {/* Wildcards */}
      <div>
        <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
          Wildcards{" "}
          <span className="text-gray-500 normal-case font-normal">
            ({wildcards} left)
          </span>
        </div>
        <div className="flex gap-1">
          {Array.from({ length: wildcardStart }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "w-8 h-8 rounded flex items-center justify-center text-sm font-bold",
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
    </div>
  );
}
