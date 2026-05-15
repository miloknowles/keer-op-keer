import { LobbyView } from "./LobbyView";

export default async function RoomPage(props: PageProps<"/room/[code]">) {
  const { code } = await props.params;
  return <LobbyView code={code} />;
}
