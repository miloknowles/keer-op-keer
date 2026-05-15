import { cn } from '@/lib/utils'

interface ResourceTracksProps {
  hearts: number
  heartSize: number
  boxesUnlocked: number
  boxesSpent: number
  boxSize: number
  wildcards: number
  wildcardStart: number
}

export function ResourceTracks({
  hearts,
  heartSize,
  boxesUnlocked,
  boxesSpent,
  boxSize,
  wildcards,
  wildcardStart,
}: ResourceTracksProps) {
  return (
    <div className="flex gap-6">
      {/* Hearts */}
      <div>
        <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Hearts</div>
        <div className="flex gap-1">
          {Array.from({ length: heartSize }).map((_, i) => (
            <div
              key={i}
              className={cn(
                'w-6 h-6 rounded-full flex items-center justify-center text-sm',
                i < hearts ? 'bg-red-500 text-white' : 'bg-gray-100 border border-gray-300 text-gray-300',
              )}
            >
              ♥
            </div>
          ))}
        </div>
      </div>

      {/* Box track */}
      <div>
        <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
          Boxes <span className="text-gray-500 normal-case font-normal">({boxesUnlocked - boxesSpent} avail)</span>
        </div>
        <div className="flex gap-1 flex-wrap max-w-[160px]">
          {Array.from({ length: boxSize }).map((_, i) => {
            const spent = i < boxesSpent
            const unlocked = i < boxesUnlocked
            return (
              <div
                key={i}
                className={cn(
                  'w-6 h-6 rounded flex items-center justify-center text-xs font-bold',
                  spent && 'bg-gray-300 text-gray-500',
                  !spent && unlocked && 'bg-kok-orange text-white',
                  !unlocked && 'bg-gray-100 border border-gray-300 text-gray-300',
                )}
              >
                {spent ? '✕' : unlocked ? '◈' : '·'}
              </div>
            )
          })}
        </div>
      </div>

      {/* Wildcards */}
      <div>
        <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
          Wildcards <span className="text-gray-500 normal-case font-normal">({wildcards} left)</span>
        </div>
        <div className="flex gap-1">
          {Array.from({ length: wildcardStart }).map((_, i) => (
            <div
              key={i}
              className={cn(
                'w-6 h-6 rounded flex items-center justify-center text-xs font-bold',
                i < wildcards ? 'bg-gray-800 text-white' : 'bg-gray-100 border border-gray-300 text-gray-300',
              )}
            >
              ✕
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
