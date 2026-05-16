import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { COLOR_NAMES } from "@/lib/constants";
import type { ScoreBreakdown, Color } from "@/types/game";

export default async function FinishedPage(props: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await props.params;
  const supabase = await createClient();

  const { data: room } = await supabase
    .from("rooms")
    .select("id, status, code")
    .eq("code", code.toLowerCase())
    .maybeSingle();

  if (!room) notFound();
  if (room.status === "lobby") redirect(`/room/${code}/lobby`);
  if (room.status === "in_progress") redirect(`/room/${code}/game`);

  const { data: players } = await supabase
    .from("room_players")
    .select("id, display_name, seat_index, score, score_breakdown")
    .eq("room_id", room.id)
    .order("score", { ascending: false, nullsFirst: false });

  const rows = (players ?? []).map((p, rank) => ({
    rank: rank + 1,
    name: p.display_name,
    score: p.score ?? 0,
    breakdown: (p.score_breakdown ?? {
      columns: {},
      rows: {},
      colors: {},
      stars: 0,
      total: 0,
    }) as ScoreBreakdown,
  }));

  const columnTotal = (bd: ScoreBreakdown) =>
    Object.values(bd.columns).reduce((a, b) => a + b, 0);
  const rowTotal = (bd: ScoreBreakdown) =>
    Object.values(bd.rows).reduce((a, b) => a + b, 0);
  const colorTotal = (bd: ScoreBreakdown) =>
    Object.values(bd.colors).reduce((a, b) => a + b, 0);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center px-4 py-12">
      <div className="w-full max-w-3xl">
        <h1 className="text-3xl font-bold text-gray-900 mb-1">Final Scores</h1>
        <p className="text-sm text-gray-500 mb-8">Room {code.toUpperCase()}</p>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide">
                <th className="text-left px-6 py-3 font-medium">#</th>
                <th className="text-left px-4 py-3 font-medium">Player</th>
                <th className="text-right px-4 py-3 font-medium">Columns</th>
                <th className="text-right px-4 py-3 font-medium">Rows</th>
                <th className="text-right px-4 py-3 font-medium">Colors</th>
                <th className="text-right px-4 py-3 font-medium">Stars</th>
                <th className="text-right px-6 py-3 font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={row.name}
                  className={
                    i < rows.length - 1 ? "border-b border-gray-50" : ""
                  }
                >
                  <td className="px-6 py-4 text-gray-400 font-medium">
                    {row.rank === 1 ? "🥇" : row.rank === 2 ? "🥈" : row.rank === 3 ? "🥉" : row.rank}
                  </td>
                  <td className="px-4 py-4 font-semibold text-gray-900">
                    {row.name}
                  </td>
                  <td className="px-4 py-4 text-right text-gray-700">
                    {columnTotal(row.breakdown)}
                  </td>
                  <td className="px-4 py-4 text-right text-gray-700">
                    {rowTotal(row.breakdown)}
                  </td>
                  <td className="px-4 py-4 text-right text-gray-700">
                    {colorTotal(row.breakdown)}
                  </td>
                  <td className="px-4 py-4 text-right text-red-500">
                    {row.breakdown.stars}
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-gray-900 text-base">
                    {row.score}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {rows.length > 0 && (
          <div className="mt-8 space-y-4">
            <h2 className="text-lg font-semibold text-gray-800">Color completions</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {rows.map((row) => {
                const completedColors = Object.entries(row.breakdown.colors) as [
                  Color,
                  number,
                ][];
                if (completedColors.length === 0) return null;
                return (
                  <div
                    key={row.name}
                    className="bg-white rounded-xl border border-gray-200 px-5 py-4"
                  >
                    <p className="text-sm font-semibold text-gray-700 mb-2">
                      {row.name}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {completedColors.map(([color, pts]) => (
                        <span
                          key={color}
                          className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-700 rounded-full px-2.5 py-1"
                        >
                          {COLOR_NAMES[color] ?? color}
                          <span className="font-semibold text-gray-900">
                            +{pts}
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
