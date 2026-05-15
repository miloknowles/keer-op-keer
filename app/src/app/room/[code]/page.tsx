import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function RoomPage(props: PageProps<'/room/[code]'>) {
  const { code } = await props.params
  const supabase = await createClient()

  const { data: room } = await supabase
    .from('rooms')
    .select('status')
    .eq('code', code)
    .maybeSingle()

  if (!room) notFound()

  if (room.status === 'lobby') redirect(`/room/${code}/lobby`)
  if (room.status === 'in_progress') redirect(`/room/${code}/game`)
  redirect(`/room/${code}/finished`)
}
