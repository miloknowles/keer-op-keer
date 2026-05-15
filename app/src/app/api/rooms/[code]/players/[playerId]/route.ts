import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string; playerId: string }> },
) {
  const { code, playerId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: room } = await supabase
    .from('rooms')
    .select('id, status, host_id')
    .eq('code', code.toLowerCase())
    .maybeSingle()
  if (!room) return NextResponse.json({ error: 'Room not found. Make sure your code is valid.' }, { status: 404 })
  if (room.status !== 'lobby') {
    return NextResponse.json({ error: 'Can only kick players in the lobby' }, { status: 409 })
  }

  const { data: me } = await supabase
    .from('room_players')
    .select('id')
    .eq('room_id', room.id)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!me) return NextResponse.json({ error: 'Not in room' }, { status: 403 })
  if (me.id !== room.host_id) {
    return NextResponse.json({ error: 'Only the host can kick players' }, { status: 403 })
  }
  if (playerId === me.id) {
    return NextResponse.json({ error: 'Cannot kick yourself' }, { status: 400 })
  }

  const { error } = await supabase
    .from('room_players')
    .delete()
    .eq('id', playerId)
    .eq('room_id', room.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
