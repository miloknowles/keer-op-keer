"use client";

import { useEffect, useState } from "react";
import { MonitorIcon } from "lucide-react";
import { DESKTOP_BREAKPOINT } from "@/lib/constants";

export function MobileGuard() {
  const [isTooSmall, setIsTooSmall] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${DESKTOP_BREAKPOINT - 1}px)`);
    const update = () => setIsTooSmall(window.innerWidth < DESKTOP_BREAKPOINT);
    mql.addEventListener("change", update);
    update();
    return () => mql.removeEventListener("change", update);
  }, []);

  if (!isTooSmall) return null;

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center gap-6 p-8 text-center">
      <MonitorIcon className="size-12 text-kok-orange" />
      <div className="flex flex-col gap-2">
        <p className="font-black text-kok-orange tracking-wide uppercase text-lg">
          Keer op Keer 2
        </p>
        <p className="text-gray-700 font-medium max-w-xs">
          This game requires a desktop browser.
        </p>
        <p className="text-gray-500 text-sm max-w-xs">
          Please open this link on a larger screen to play.
        </p>
      </div>
    </div>
  );
}
