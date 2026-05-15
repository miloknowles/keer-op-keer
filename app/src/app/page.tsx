"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { generateRoomCode } from "@/lib/utils";

const ROWS = [
  {
    letters: ["K", "E", "E", "R"],
    colors: ["bg-kok-pink", "bg-kok-blue", "bg-kok-yellow", "bg-kok-green"],
    stars: [false, false, true, false],
  },
  {
    letters: ["O", "P"],
    colors: ["bg-kok-orange", "bg-kok-pink"],
    stars: [false, false],
  },
  {
    letters: ["K", "E", "E", "R"],
    colors: ["bg-kok-blue", "bg-kok-green", "bg-kok-yellow", "bg-kok-orange"],
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
    <div className="flex flex-1 flex-col items-center justify-center gap-10 bg-gray-200 min-h-screen">
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

      <p className="text-center text-gray-600 text-sm italic">
        &ldquo;het blifft nooit bij 1 spelletej&rdquo;
        <br />
        <span className="not-italic text-gray-500">&ldquo;it never stops at just one game&rdquo;</span>
      </p>

      <div className="flex flex-col items-center gap-3">
        <button
          onClick={() => router.push(`/room/${generateRoomCode()}`)}
          className="bg-kok-orange hover:brightness-110 hover:-translate-y-1 hover:shadow-lg active:translate-y-0.5 text-white font-bold text-xl uppercase px-14 py-3.5 rounded-xl shadow-md transition-all select-none"
        >
          New game
        </button>

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
            className="bg-kok-blue hover:brightness-110 active:translate-y-0.5 disabled:opacity-40 disabled:pointer-events-none text-white font-bold text-xl uppercase px-6 py-3 rounded-xl shadow-md transition-all select-none"
          >
            Join
          </button>
        </form>
      </div>
      <a
        href="https://www.999games.nl/product/keer-op-keer/8719214421847"
        target="_blank"
        rel="noopener noreferrer"
        className="text-gray-500 hover:text-gray-700 text-xs underline underline-offset-2 transition-colors"
      >
        Buy the original game
      </a>
    </div>
  );
}
