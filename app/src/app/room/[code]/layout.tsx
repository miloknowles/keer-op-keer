import type { ReactNode } from "react";
import { RoomProvider } from "@/lib/context/room";

export default async function RoomLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <RoomProvider code={code}>{children}</RoomProvider>;
}
