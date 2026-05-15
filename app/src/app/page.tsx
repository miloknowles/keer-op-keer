"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const ROWS = [
  {
    letters: ["K", "E", "E", "R"],
    colors: ["bg-red-500", "bg-blue-500", "bg-yellow-400", "bg-green-500"],
    stars: [false, false, true, false],
  },
  {
    letters: ["O", "P"],
    colors: ["bg-orange-500", "bg-red-400"],
    stars: [false, false],
  },
  {
    letters: ["K", "E", "E", "R"],
    colors: ["bg-blue-500", "bg-green-500", "bg-yellow-400", "bg-orange-500"],
    stars: [false, true, false, false],
  },
];

export default function Home() {
  const router = useRouter();
  const [code, setCode] = useState("");

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim();
    if (trimmed) router.push(`/room/${trimmed.toLowerCase()}`);
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-10 bg-gray-300 min-h-screen">
      <div className="flex flex-col items-center gap-2">
        {ROWS.map((row, ri) => (
          <div key={ri} className="flex gap-2">
            {row.letters.map((char, ci) => (
              <div
                key={ci}
                className={`${row.colors[ci]} relative flex w-16 h-16 items-center justify-center rounded-xl text-white font-bold text-3xl shadow-md select-none`}
              >
                {row.stars[ci] && (
                  <span className="absolute top-1 right-1.5 text-white/70 text-xs leading-none">★</span>
                )}
                {char}
              </div>
            ))}
          </div>
        ))}
      </div>

      <p className="text-gray-600 font-medium text-lg">Roll-and-write &middot; 1–6 players</p>

      <div className="flex flex-col items-center gap-3">
        <Link
          href="/room/demo"
          className="bg-orange-500 hover:bg-orange-400 active:translate-y-0.5 text-white font-bold text-xl px-14 py-3.5 rounded-xl shadow-md transition-all select-none"
        >
          New game
        </Link>

        <p className="text-gray-500 text-sm font-medium">or</p>

        <form onSubmit={handleJoin} className="flex gap-2">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Enter room code"
            maxLength={12}
            className="w-44 rounded-xl border-2 border-white/60 bg-white/70 px-4 py-3 text-center font-bold text-gray-700 uppercase tracking-widest placeholder:normal-case placeholder:tracking-normal placeholder:text-gray-400 shadow-sm outline-none focus:border-blue-400 focus:bg-white transition-all"
          />
          <button
            type="submit"
            disabled={!code.trim()}
            className="bg-blue-500 hover:bg-blue-400 active:translate-y-0.5 disabled:opacity-40 disabled:pointer-events-none text-white font-bold text-xl px-6 py-3 rounded-xl shadow-md transition-all select-none"
          >
            Join
          </button>
        </form>
      </div>
    </div>
  );
}
