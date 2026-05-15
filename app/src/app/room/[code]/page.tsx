export default async function RoomPage(props: PageProps<"/room/[code]">) {
  const { code } = await props.params;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
      <h1 className="text-2xl font-semibold">Room: {code.toUpperCase()}</h1>
      <p className="text-muted-foreground">Game coming soon.</p>
    </div>
  );
}
